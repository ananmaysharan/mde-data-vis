<script lang="ts">
	import { theme, setTheme } from '$lib/state/theme';
	import type { ThemeId } from '$lib/state/theme';

	$: currentTheme = $theme;

	function handleThemeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		setTheme(target.value as ThemeId);
	}
</script>

<div class="theme-toggle-container">
	<div class="toggle-group">
		<!-- Dark -->
		<input
			type="radio"
			name="theme"
			id="dark"
			value="dark"
			checked={currentTheme === 'dark'}
			on:change={handleThemeChange}
		/>
		<label for="dark" title="Dark theme">
			<span aria-hidden="true">🌙</span>
		</label>

		<!-- Light -->
		<input
			type="radio"
			name="theme"
			id="light"
			value="light"
			checked={currentTheme === 'light'}
			on:change={handleThemeChange}
		/>
		<label for="light" title="Light theme">
			<span aria-hidden="true">☀️</span>
		</label>

		<!-- Blue -->
		<input
			type="radio"
			name="theme"
			id="blue"
			value="blue"
			checked={currentTheme === 'blue'}
			on:change={handleThemeChange}
		/>
		<label for="blue" title="Blue theme">
			<span aria-hidden="true">🌊</span>
		</label>
	</div>
</div>

<style>
	.theme-toggle-container {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 50;
	}

	.toggle-group {
		display: inline-flex;
		border-radius: 0.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-3);
		backdrop-filter: blur(12px);
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.toggle-group input[type='radio'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.toggle-group label {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		background: transparent;
		transition: all 0.2s ease;
		border-right: 1px solid var(--border-subtle);
		min-width: 3rem;
	}

	.toggle-group label:last-child {
		border-right: none;
	}

	.toggle-group label:hover {
		background: var(--surface-2);
		color: var(--text-primary);
	}

	.toggle-group input[type='radio']:checked + label {
		background: var(--accent);
		color: var(--text-on-accent, #fff);
		font-weight: 600;
	}

	.toggle-group input[type='radio']:focus-visible + label {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		z-index: 1;
	}
</style>
