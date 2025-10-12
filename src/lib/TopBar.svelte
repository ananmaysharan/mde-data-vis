<script lang="ts">
	import { canGoBack, goBack } from '$lib/state/navigation';
	import { theme, toggleTheme } from '$lib/state/theme';
	import type { ThemeId } from '$lib/state/theme';

	const themeMeta: Record<ThemeId, { label: string; icon: string }> = {
		dark: { label: 'Dark', icon: '' },
		light: { label: 'Light', icon: '' },
		blue: { label: 'Blue', icon: '' }
	};

	$: currentTheme = $theme;
	$: activeTheme = themeMeta[currentTheme] ?? { label: currentTheme, icon: '🎨' };
</script>

<div
	class="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-3 p-2 backdrop-blur transition-colors duration-200 flex-col"
>
	{#if $canGoBack}
		<button
			type="button"
			on:click={goBack}
			class="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-1.5 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
			aria-label="Go back"
		>
			<span aria-hidden="true">←</span>
			<span>Back</span>
		</button>
	{/if}

	<button
		type="button"
		on:click={toggleTheme}
		class="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-1.5 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
		aria-label={`Switch theme (current: ${activeTheme.label})`}
	>
		<span aria-hidden="true" class="text-lg">{activeTheme.icon}</span>
		<span class="hidden sm:inline">{activeTheme.label}</span>
	</button>
</div>
