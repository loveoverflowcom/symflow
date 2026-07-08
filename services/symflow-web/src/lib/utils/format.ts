import type { AgentLogEvent } from '$lib/types/symflow';

export function formatDate(value?: string | null): string {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function prettyJson(value: unknown): string {
  if (value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

export function normalizeLogEntries(raw: unknown): AgentLogEvent[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((item): item is AgentLogEvent => typeof item === 'object' && item !== null);
}

export function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
