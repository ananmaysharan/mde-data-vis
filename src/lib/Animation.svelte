<script>
    // @ts-nocheck
    import { tick } from 'svelte';
    import gsap from 'gsap';
    import { onMount } from 'svelte';
    // import Flip from 'gsap/Flip';
    import data from '../lib/assets/month_level_summary.csv';
    import ShipMap from '$lib/ShipMap.svelte';

    let Flip;

    onMount(async () => {
        const FlipModule = await import('gsap/Flip');
        Flip = FlipModule.default;
        gsap.registerPlugin(Flip);
    });

    
    // Define colors for each sound type
    const colors = {
        ships: '#E44000',
        bluewhale: '#64B3B7',
        finwhale: '#1897EB',
        humpbackwhale: '#E5AA00',
        dolphins: '#ED7BCD',
        bocaccio: '#8964B7',
        plainfinmidshipman: '#81C995',
        explosions: '#EB7E18'
    };

    // Sound type columns (excluding 'time' and 'sonar', 'plainfinmidshipman')
    const soundTypes = ['ships', 'bluewhale', 'finwhale', 'humpbackwhale', 'bocaccio', 'dolphins', 'explosions'];

    let layout = 'grid';
    let containerEl;
    let flipState = null;
    let sizeMultiplier = 1;

    // Function to get circle properties based on value
    function getCircleProps(value, multiplier = 1) {
        if (value === null || value === undefined || value === '') {
            return { size: Math.max(16, 20 * multiplier), color: '#eeeeee' }; // grey for null
        }
        const numValue = parseFloat(value);
        if (numValue === 0) {
            return { size: Math.max(16, 20 * multiplier), color: '#eeeeee' }; // grey for 0
        }
        // Scale size based on value (you can adjust the scaling factor)
        const size = Math.min(20 + Math.sqrt(numValue), 80) * multiplier;
        return { size, color: null }; // color will be determined by sound type
    }

    function toggleLayout() {
        if (!containerEl) return;
        const items = containerEl.querySelectorAll('.month-group');
        flipState = Flip.getState(items);
        layout = layout === 'grid' ? 'row' : 'grid';
    }

    async function animateLayout() {
        await tick();
        if (!flipState) return;
        Flip.from(flipState, {
            duration: 0.5,
            ease: 'power2.inOut',
            stagger: 0.02
        });
        if (layout === 'row' && containerEl) {
            containerEl.scrollTo({ left: 0, behavior: 'smooth' });
        }
        flipState = null;
    }

    $: if (flipState) {
        animateLayout();
    }

    $: sizeMultiplier = layout === 'row' ? 0.65 : 1;
    $: toggleLabel = layout === 'grid' ? 'Show timeline view' : 'Show grid view';
    $: toggleStateLabel = layout === 'grid' ? 'Grid view' : 'Timeline view';
</script>

<div class="legend" aria-label="Sound type legend and layout toggle">
    <div class="legend-items">
        {#each soundTypes as soundType}
            <div class="legend-item">
                <svg width="20" height="20">
                    <circle r="10" cx="10" cy="10" fill={colors[soundType]} />
                </svg>
                <span>{soundType}</span>
            </div>
        {/each}
    </div>
    <button
        class="toggle-button"
        type="button"
        on:click={toggleLayout}
        aria-pressed={layout === 'row'}
        aria-label={`Toggle layout (currently ${toggleStateLabel})`}
    >
        {toggleLabel}
    </button>
</div>

<div class="parent-container">
    <!-- <div class="map-container">
        <ShipMap/>
    </div> -->
<div class="container" bind:this={containerEl} class:row-layout={layout === 'row'}>
    {#each data as row}
        <div class="month-group">
            {#each soundTypes as soundType}
                {@const props = getCircleProps(row[soundType], sizeMultiplier)}
                <svg viewBox="0 0 {props.size} {props.size}" width="{props.size}" height="{props.size}">
                    <circle
                        class="blur-blob"
                        r="{props.size / 2}"
                        cx="{props.size / 2}"
                        cy="{props.size / 2}"
                        fill={props.color || colors[soundType]}
                    />
                </svg>
            {/each}
        </div>
    {/each}
</div>
</div>

<style>

    .parent-container {
        display: flex;
        flex-direction: row;
        gap: 1em;
        justify-content: center;
    }

    .map-container {
        width: 30vw;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
        padding: 1rem;
        background-color: #eee;
        border-radius: 1em;
    }

    .legend-items {
        display: flex;
        flex: 1 1 280px;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .legend-item span {
        font-size: 0.9rem;
        text-transform: capitalize;
    }

    .toggle-button {
        border: none;
        border-radius: 999px;
        background: #222;
        color: #fff;
        padding: 0.45rem 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        white-space: nowrap;
    }

    .toggle-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .toggle-button:focus-visible {
        outline: 2px solid #1897EB;
        outline-offset: 3px;
    }

    .container {
        display: grid;
        grid-template-columns: repeat(13, minmax(0, 1fr));
        gap: 0.5rem;
        transition: all 0.3s ease;
    }

    .container.row-layout {
        display: flex;
        flex-wrap: nowrap;
        /* gap: clamp(0.25rem, 0.8vw, 1rem); */
        justify-content: space-between;
        /* align-items: flex-start; */
    }

    .month-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        /* gap: 0.45rem; */
        min-width: 0;
    }

    .container.row-layout .month-group {
        flex: 1 1 calc(100% / 13);
        max-width: clamp(72px, 7vw, 120px);
    }

    .month-group svg {
        transition: transform 0.3s ease-out;
    }

    .month-group svg:hover {
        scale: 1.05;
        cursor: pointer;
        z-index: 1;
    }

    .blur-blob {
        will-change: transform;
        /* filter: blur(2px); */
        /* filter: drop-shadow(0 2px 3px rgba(228, 64, 0, 0.30)) drop-shadow(0 0.5px 4px #E44000); */
    }

    @media (max-width: 900px) {
        .legend {
            justify-content: center;
        }

        .toggle-button {
            width: 100%;
            text-align: center;
        }

        .container.row-layout {
            flex-wrap: wrap;
        }

        .container.row-layout .month-group {
            flex: 1 1 calc(50% - 0.5rem);
            max-width: none;
        }
    }
</style>