<script lang="ts">
	// @ts-nocheck
	// import { onMount } from 'svelte';
	// import maplibregl from 'maplibre-gl';

	// // Import styles for MapLibre
	// import 'maplibre-gl/dist/maplibre-gl.css';

	// let mapContainer: HTMLElement;
	// let map: maplibregl.Map;

	// // This is the main function that runs after the component is mounted
	// onMount(() => {
	// 	map = new maplibregl.Map({
	// 		container: mapContainer,
	// 		style: 'https://tiles.openfreemap.org/styles/positron', // Or your preferred map style
	// 		center: [-122.02704159855546, 36.78052915846155],
	// 		zoom: 10
	// 	});
	// });

	import { onMount, onDestroy } from "svelte";
	import mapboxgl from "mapbox-gl";
	import "mapbox-gl/dist/mapbox-gl.css";
	import sensors from "$lib/assets/sensors.geo.json";
	import { TripsLayer } from "@deck.gl/geo-layers";
	import { MapboxOverlay } from "@deck.gl/mapbox";
	import shipping_2020_trips from "$lib/assets/shipping_2020_trips.json";


	// --- Mapbox Setup ---
	const MAPBOX_TOKEN =
		"pk.eyJ1IjoiYW5hbm1heSIsImEiOiJjbDk0azNmY3oxa203M3huMzhyZndlZDRoIn0.1L-fBYplQMuwz0LGctNeiA"; // ⚠️ PASTE YOUR TOKEN HERE
	let mapContainer;
	let map;
	let deckOverlay;
	let animationId;
	const TRAIL_LENGTH = 15;


	// Animation variables ORIGINAL NYC TRIPS

    const step = 20; // Increase step for a faster/smoother animation
    const loopLength = 400000; // Increase loopLength to cover the longest trip duration
    let time = 0;
    let loopRunning = false;
	let tripsLayer;



	// Colors for different vendors
	const BLUE = [23, 184, 190];
	const RED = [253, 128, 93];


	onMount(() => {
		map = new mapboxgl.Map({
			accessToken: MAPBOX_TOKEN,
			container: mapContainer,
			style: "mapbox://styles/ananmay/cmg5ux9ie005v01qib744fnsn", // "mapbox://styles/ananmay/cmg5utiiy000x01qw2d2f1r7s", // Dark style for contrast
			center: [-122.02704, 36.7805],
			zoom: 9,
		});

		map.on("load", () => {
			const firstLabelLayerId = map
				.getStyle()
				.layers.find((layer) => layer.type === "symbol").id;

			map.addSource("sensors", {
				type: "geojson",
				data: sensors,
			});

			map.addLayer({
				id: "sensors-layer",
				type: "circle",
				source: "sensors",
				paint: {
					"circle-radius": 6,
					"circle-color": "#222",
					"circle-stroke-width": 2,
					"circle-stroke-color": "#fff",
				},
			});

			map.addSource("shipping-tracks", {
				type: "vector",
				url: "mapbox://ananmay.ahrwa6zx",
			});

			// map.addLayer(
			// 	{
			// 		id: "animated-tracks",
			// 		type: "line",
			// 		source: "shipping-tracks",
			// 		"source-layer": "shipping_2020", // layer name in your tileset
			// 		layout: {
			// 			"line-cap": "round",
			// 			"line-join": "round",
			// 		},
			// 		paint: {
			// 			"line-color": "#E44000",
			// 			"line-width": 1,
			// 			"line-opacity": 0.7,
			// 		},
			// 		filter: [
			// 			"all",
			// 			[
			// 				"<=",
			// 				["get", "TrackStartTime"],
			// 				new Date().toISOString(),
			// 			],
			// 			[">", ["get", "DurationMinutes"], 10], // Only show tracks longer than 10 minutes
			// 		],
			// 	},
			// 	"sensors-layer",
			// );

			// // Simple time-based animation
			// function animateByTime() {
			// 	const startDate = new Date("2019-12-31T00:00:00Z");
			// 	const endDate = new Date("2020-12-31T00:00:00Z");
			// 	const duration = endDate - startDate;

			// 	let start = performance.now();

			// 	function frame(time) {
			// 		const elapsed = time - start;
			// 		const progress = Math.min(elapsed / 30000, 1); // 10 second animation

			// 		const currentTime = new Date(
			// 			startDate.getTime() + duration * progress,
			// 		);

			// 		map.setFilter("animated-tracks", [
			// 			"<=",
			// 			["get", "TrackStartTime"],
			// 			currentTime.toISOString(),
			// 		]);

			// 		if (progress < 1) {
			// 			requestAnimationFrame(frame);
			// 		}
			// 	}

			// 	requestAnimationFrame(frame);
			// }

			// animateByTime();

			tripsLayer = new TripsLayer({
						id: 'trips',
						data: shipping_2020_trips,
						getPath: d => d.path,
						getTimestamps: d => d.timestamps,
						getColor: [228, 65, 0, 255],
						opacity: 0.8,
						widthMinPixels: 5,
						rounded: true,
						trailLength: 300,
						currentTime: time,
					})


			const deckOverlay = new MapboxOverlay({
				interleaved: true,
				layers: [tripsLayer],
			});

			console.log("Adding DeckGL overlay...", deckOverlay);
			map.addControl(deckOverlay);
			console.log("DeckGL overlay added successfully");

			// Animation function
			const animate = () => {
                if (loopRunning) {
                    time = (time + step) % loopLength;
                    
                    // ** STEP 3: Clone your managed layer, then re-assign it **
                    tripsLayer = tripsLayer.clone({ currentTime: time });

                    // ** Pass the new cloned layer to the overlay **
                    deckOverlay.setProps({ layers: [tripsLayer] });
                    
                    animationId = requestAnimationFrame(animate);
                }
            };

            // Start the animation
            loopRunning = true;
            animate();
        });
	});

	// Clean up the map instance to prevent memory leaks
	onDestroy(() => {
		loopRunning = false;
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		if (map) map.remove();
	});
</script>

<main>
	<div class="map-container" bind:this={mapContainer}></div>
</main>

<style>
	.map-container {
		width: 100%;
		height: 100vh;
		border-radius: 1em;
	}
</style>
