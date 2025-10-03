<script>
	// Import main image and monthly spectrograms
	import mainImage from '$lib/assets/spectrograms/main.png';
	import small1 from '$lib/assets/spectrograms/small_1.png';
	import small2 from '$lib/assets/spectrograms/small_2.png';
	import small3 from '$lib/assets/spectrograms/small_3.png';
	import small4 from '$lib/assets/spectrograms/small_4.png';
	import small5 from '$lib/assets/spectrograms/small_5.png';
	import small6 from '$lib/assets/spectrograms/small_6.png';
	import small7 from '$lib/assets/spectrograms/small_7.png';
	import small8 from '$lib/assets/spectrograms/small_8.png';
	import small9 from '$lib/assets/spectrograms/small_9.png';
	import small10 from '$lib/assets/spectrograms/small_10.png';
	import small11 from '$lib/assets/spectrograms/small_11.png';
	import small12 from '$lib/assets/spectrograms/small_12.png';

	let { year } = $props();
	let showGallery = $state(false);


	// Create array of all monthly images
	const imageList = [
		{ src: small1, name: '1' },
		{ src: small2, name: '2' },
		{ src: small3, name: '3' },
		{ src: small4, name: '4' },
		{ src: small5, name: '5' },
		{ src: small6, name: '6' },
		{ src: small7, name: '7' },
		{ src: small8, name: '8' },
		{ src: small9, name: '9' },
		{ src: small10, name: '10' },
		{ src: small11, name: '11' },
		{ src: small12, name: '12' }
	];

	function toggleGallery() {
		showGallery = !showGallery;
	}

	/** @param {MouseEvent | KeyboardEvent} event */
	function handleBackgroundClick(event) {
		// Only toggle the gallery if the click is on the wrapper itself, not on the images.
		if (event.currentTarget === event.target) {
			toggleGallery();
		}
	}
</script>

<div class="year-container my-6">
	<h1>{year}</h1>
	{#if !showGallery}
		<!-- Main spectrogram view -->
		<div class="spectrogram-container" onclick={toggleGallery} onkeydown={(e) => e.key === 'Enter' && toggleGallery()} tabindex="0" role="button" aria-label="Click to view monthly spectrograms">
			<img
				src={mainImage}
				alt="Main Spectrogram - Click to view monthly data"
				class="w-full h-full object-cover"
			/>
		</div>
	{:else}
		<!-- Monthly spectrograms gallery -->
		<div 
			onclick={handleBackgroundClick} 
			class="gallery-wrapper" 
			role="button" 
			tabindex="0" 
			aria-label="Click to go back to main spectrogram" 
			onkeydown={(e) => {if (e.key === 'Enter' || e.key === ' ') { handleBackgroundClick(e); }}}
		>
			<div class="spectrogram-container gallery-mode">
				{#each imageList as image}
					<div class="month-card">
						<img
							src={image.src}
							alt="Spectrogram Month {image.name}"
							class="w-full h-full object-cover"
						/>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
.spectrogram-container {
    width: 1000px;
    height: 150px;
    border-radius: 0.5rem;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
}

/* Hover effect for main image */
.spectrogram-container:not(.gallery-mode):hover {
    transform: scale(1.01);
}

.gallery-mode {
    display: flex;
    gap: 0;
}

.month-card {
    flex: 1;
    height: 100%;
    overflow: hidden;
    transition: flex 0.4s ease-in-out;
    cursor: pointer;
    border-right: 2px solid rgba(255, 255, 255, 0.1);
}

.month-card:last-child {
    border-right: none;
}

.month-card:hover {
    flex: 2;
}

.month-card img {
    min-width: 100%;
    height: 100%;
    object-fit: cover;
}

.gallery-wrapper {
	cursor: pointer;
}
</style>