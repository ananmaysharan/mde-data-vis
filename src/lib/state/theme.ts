import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeId = 'light' | 'dark' | 'blue';

const STORAGE_KEY = 'soundscape-theme';
const THEMES: ThemeId[] = ['light', 'dark', 'blue'];

function getInitialTheme(): ThemeId {
	if (!browser) return 'light';
	const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
	return stored && THEMES.includes(stored) ? stored : 'light';
}

const theme = writable<ThemeId>(getInitialTheme());

function applyTheme(value: ThemeId): void {
	if (!browser) return;
	document.documentElement.setAttribute('data-theme', value);
	localStorage.setItem(STORAGE_KEY, value);
}

export function setTheme(value: ThemeId): void {
	theme.set(value);
	applyTheme(value);
}

theme.subscribe(($theme) => {
	if (browser) {
		const current = document.documentElement.getAttribute('data-theme');
		if (current !== $theme) {
			document.documentElement.setAttribute('data-theme', $theme);
		}
	}
});

export function toggleTheme(): void {
	theme.update((current) => {
		const index = THEMES.indexOf(current);
		const next = THEMES[(index + 1) % THEMES.length];
		applyTheme(next);
		return next;
	});
}

export function initializeTheme(): void {
	const initial = getInitialTheme();
	theme.set(initial);
	applyTheme(initial);
}

export { theme };
