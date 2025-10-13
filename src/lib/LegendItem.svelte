<script>
    // @ts-nocheck
    
    import { playSound, stopSound } from '$lib/utils/soundEffects';
    import { setSoundHighlight, clearSoundHighlight } from '$lib/state/audio';

    /**
     * @type {'ships' | 'bluewhale' | 'finwhale' | 'humpbackwhale' | 'dolphins' | 'bocaccio' | 'explosions'}
     */
    export let type;
    
    /**
     * @type {string}
     */
    export let status = 'STATUS';
    
    /**
     * @type {number | string}
     */
    export let count = null;
    
    // Define colors for each sound type (matching Animation.svelte)
    const colors = {
        ships: '#E44000',
        explosions: '#FE7C1F',
        bluewhale: '#73CBE9',
        finwhale: '#E5AA00',
        humpbackwhale: '#E656E1',
        dolphins: '#81C995',
        bocaccio: '#9F6FF8',
    };

    
    // Map types to image filenames
    const imageMap = {
        ships: 'ship.png',
        bluewhale: 'blue.png',
        finwhale: 'fin.png',
        humpbackwhale: 'humpback.png',
        dolphins: 'dolphin.png',
        bocaccio: 'boccacio.png',
        explosions: 'explosion.png'
    };
    
    // Map types to display names
    const displayNames = {
        ships: 'Ship',
        bluewhale: 'Blue Whale',
        finwhale: 'Fin Whale',
        humpbackwhale: 'Humpback',
        dolphins: 'Dolphin',
        bocaccio: 'Boccacio',
        explosions: 'Explosion'
    };
    
    $: color = colors[type] || '#999';
    $: imageSrc = `/src/lib/assets/legend/${imageMap[type]}`;
    $: displayName = displayNames[type] || type;
</script>

<div
    class="legend-item"
    role="button"
    tabindex="0"
    aria-label={`Play ${displayName} sound`}
    on:mouseenter={() => { playSound(type); setSoundHighlight(type); }}
    on:focus={() => { playSound(type); setSoundHighlight(type); }}
    on:mouseleave={() => { stopSound(type); clearSoundHighlight(); }}
    on:blur={() => { stopSound(type); clearSoundHighlight(); }}
    on:keydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            playSound(type);
            setSoundHighlight(type);
        }
    }}
>
    <div class="content">
        <div class="type-name font-mono text-xs">{displayName}</div>
         <div class="count font-mono text-xs">{count}</div>
        <div class="visual">
            <div class="circle" style="background-color: {color};"></div>
            <img src={imageSrc} alt={displayName} class="illustration" />
        </div>
        <div class="status text-xs">{status}</div>
    </div>
</div>

<style>
    .legend-item {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem 0 1rem;
    }
    
    .content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
    }
    
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        font-size: 1rem;
        font-weight: 400;
    }
    
    .type-name {
        text-transform: capitalize;
    }
    
    .count {
        font-weight: 600;
    }
    
    .visual {
        position: relative;
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .circle {
        position: absolute;
        left: 10px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        z-index: 0;
    }
    
    .illustration {
        position: relative;
        max-height: 200px;
        object-fit: contain;
        z-index: 1;
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
    }

    .illustration:hover{
        transform: scale(1.1);
        transition: 0.3s ease;
        cursor: pointer;
    }
    
    .status {
        color: var(--text-secondary);
        text-transform: uppercase;
        opacity: 0.7;
    }
</style>
