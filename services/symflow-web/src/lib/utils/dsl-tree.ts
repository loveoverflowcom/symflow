export interface DslStep {
  id: string;
  type: string;
  needs?: string[];
  with?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DslFlow {
  flow_id: string;
  name: string;
  steps: DslStep[];
}

export interface TaskMeta {
  name: string;
  label: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export function reorderSteps(steps: DslStep[], fromIndex: number, toIndex: number): DslStep[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= steps.length ||
    toIndex >= steps.length
  ) {
    return steps;
  }

  const previousOrder = steps.map((step) => step.id);
  const reordered = [...steps];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  return reordered.map((step, index) => {
    const oldIndex = previousOrder.indexOf(step.id);
    const oldPrevious = oldIndex > 0 ? previousOrder[oldIndex - 1] : undefined;
    const wasInferred =
      !step.needs ||
      step.needs.length === 0 ||
      (step.needs.length === 1 && step.needs[0] === oldPrevious);

    if (!wasInferred) return step;
    return index === 0
      ? { ...step, needs: [] }
      : { ...step, needs: [reordered[index - 1].id] };
  });
}

export function appendSequentialStep(steps: DslStep[], step: DslStep): DslStep[] {
  return [
    ...steps,
    {
      ...step,
      needs: steps.length > 0 ? [steps[steps.length - 1].id] : []
    }
  ];
}

export function defaultTaskConfig(task: TaskMeta): Record<string, unknown> {
  const schema = task.input_schema as Record<string, unknown> | undefined;
  const properties =
    schema && typeof schema.properties === 'object' && schema.properties
      ? (schema.properties as Record<string, { type?: string; default?: unknown }>)
      : (task.input_schema as Record<string, { type?: string; default?: unknown }>);

  return Object.fromEntries(
    Object.entries(properties ?? {}).map(([name, field]) => [
      name,
      field?.default ?? defaultForType(field?.type)
    ])
  );
}

export function uniqueStepId(taskName: string, steps: DslStep[]): string {
  const ids = new Set(steps.map((step) => step.id));
  let index = 1;
  let candidate = `${taskName}_${index}`;
  while (ids.has(candidate)) {
    index += 1;
    candidate = `${taskName}_${index}`;
  }
  return candidate;
}

export function configSummary(step: DslStep): string {
  const entry = Object.entries(step.with ?? {})[0];
  if (!entry) return '';
  const [key, value] = entry;
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  return `${key}: ${rendered.length > 80 ? `${rendered.slice(0, 77)}…` : rendered}`;
}

export function nestedStepGroups(
  step: DslStep
): Array<{ label: string; steps: DslStep[] }> {
  const config = step.with ?? {};
  if (step.type === 'if') {
    return [
      { label: 'then', steps: asSteps(config.then) },
      { label: 'else', steps: asSteps(config.else) }
    ];
  }
  if (step.type === 'foreach') {
    return [{ label: 'steps', steps: asSteps(config.steps) }];
  }
  if (step.type === 'parallel') {
    return Array.isArray(config.branches)
      ? config.branches.map((branch, index) => ({
          label: `branch ${index + 1}`,
          steps: asSteps(branch)
        }))
      : [];
  }
  if (step.type === 'try') {
    return [
      { label: 'try', steps: asSteps(config.steps) },
      { label: 'catch', steps: asSteps(config.catch) }
    ];
  }
  return [];
}

function asSteps(value: unknown): DslStep[] {
  return Array.isArray(value) ? (value as DslStep[]) : [];
}

function defaultForType(type?: string): unknown {
  if (type === 'array') return [];
  if (type === 'object') return {};
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return false;
  return '';
}
