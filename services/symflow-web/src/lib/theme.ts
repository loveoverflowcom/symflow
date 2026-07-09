import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'symflow.theme';

function initialTheme(): Theme {
  if (!browser) return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(initialTheme());

if (browser) {
  theme.subscribe((value) => {
    window.localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.setAttribute('data-theme', value);
  });
}

export function setTheme(value: Theme) {
  theme.set(value);
}

export function toggleTheme(current: Theme) {
  setTheme(current === 'light' ? 'dark' : 'light');
}
