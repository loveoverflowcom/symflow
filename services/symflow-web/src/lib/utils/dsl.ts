export const DEFAULT_FLOW_DSL = JSON.stringify(
  {
    flow_id: 'new-flow',
    name: 'New flow',
    steps: [
      {
        id: 'receive_input',
        type: 'manual_trigger',
        with: {
          message: 'Hello from Symflow'
        }
      }
    ]
  },
  null,
  2
);

export function parseJsonDsl(source: string): unknown {
  return JSON.parse(source);
}

export function formatJsonDsl(source: string): string {
  return JSON.stringify(parseJsonDsl(source), null, 2);
}

export function formatJsonDslIfValid(source: string): string {
  try {
    return formatJsonDsl(source);
  } catch {
    return source;
  }
}
