<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type {
		Feature,
		FeatureCollection,
		MultiLineString,
		LineString,
		Point
	} from 'geojson';
	import * as turf from '@turf/turf';
	import shippingData from '$lib/assets/shipping_test.geo.json?url';

	// Import styles for MapLibre
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapContainer: HTMLElement;
	let map: maplibregl.Map;

	const LOOP_DURATION_MS = 600_000; // 10 minutes for a full playback loop
	const MAX_TAIL_LENGTH_KM = 20; // maximum visible trail length
	const MIN_LINE_COORDS = 2;
	const MIN_TAIL_LENGTH_KM = 0.05; // ensure at least ~50m of geometry for gradient stability

	interface ShipTrailProperties {
		[key: string]: any;
		startTime: number;
		endTime: number;
		duration: number;
		distance: number;
	}

	interface ProcessedFeature extends Feature<LineString> {
		properties: ShipTrailProperties;
	}

	// This is the main function that runs after the component is mounted
	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://tiles.openfreemap.org/styles/liberty', // Or your preferred map style
			center: [-122.02704159855546, 36.78052915846155],
			zoom: 10
		});

		map.on('load', async () => {
			// 1. Fetch and Process Data
			const response = await fetch(shippingData);
			const geojsonData: FeatureCollection<MultiLineString> = await response.json();

			const processedFeatures: ProcessedFeature[] = geojsonData.features
				.flatMap((feature: Feature<MultiLineString>) => {
					if (!feature.properties) {
						return [];
					}

					const { TrackStartTime, TrackEndTime } = feature.properties;
					const startTime = new Date(TrackStartTime).getTime();
					const endTime = new Date(TrackEndTime).getTime();
					const duration = endTime - startTime;

					if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || duration <= 0) {
						return [];
					}

					return feature.geometry.coordinates
						.map((coordinates) => {
							const line = turf.lineString(coordinates);
							const distance = turf.length(line, { units: 'kilometers' });

							if (!Number.isFinite(distance) || distance === 0) {
								return null;
							}

							return {
								...feature,
								properties: {
									...feature.properties,
									startTime,
									endTime,
									duration,
									distance
								},
								geometry: line.geometry
							} as ProcessedFeature;
						})
						.filter((value): value is ProcessedFeature => value !== null);
				})
				.sort((a, b) => a.properties.startTime - b.properties.startTime);

			if (processedFeatures.length === 0) {
				return;
			}

			const globalStartTime = processedFeatures[0].properties.startTime;
			const globalEndTime = processedFeatures.reduce(
				(max, feature) => Math.max(max, feature.properties.endTime),
				processedFeatures[0].properties.endTime
			);
			const globalDuration = globalEndTime - globalStartTime;

			// Fit map to data bounds for nicer initial view
			const bounds = new maplibregl.LngLatBounds();
			processedFeatures.forEach((feature) => {
				feature.geometry.coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
			});
			if (!bounds.isEmpty()) {
				map.fitBounds(bounds, { padding: 64, maxZoom: 11, duration: 1200 });
			}

			// 2. Add Sources and Layers to Map
			map.addSource('ship-trails', {
				type: 'geojson',
				lineMetrics: true,
				data: {
					type: 'FeatureCollection',
					features: []
				}
			});

			map.addSource('ship-heads', {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features: []
				}
			});

			map.addLayer({
				id: 'ship-trails-layer',
				type: 'line',
				source: 'ship-trails',
				layout: {
					'line-cap': 'round',
					'line-join': 'round'
				},
				paint: {
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						7,
						1.5,
						14,
						5
					],
					'line-gradient': [
						'interpolate',
						['linear'],
						['line-progress'],
						0,
						'rgba(16, 23, 42, 0)',
						0.1,
						'rgba(14, 116, 144, 0.15)',
						0.6,
						'rgba(125, 211, 252, 0.6)',
						1,
						'rgba(240, 249, 255, 1)'
					]
				}
			});

			map.addLayer({
				id: 'ship-heads-layer',
				type: 'circle',
				source: 'ship-heads',
				paint: {
					'circle-radius': [
						'interpolate',
						['linear'],
						['zoom'],
						7,
						3,
						12,
						6
					],
					'circle-color': 'rgba(244, 244, 245, 0.95)',
					'circle-stroke-color': 'rgba(56, 189, 248, 0.9)',
					'circle-stroke-width': 1.5
				}
			});

			// 3. Start the Animation Loop
			let animationStartTime: number;

			const animate = (timestamp: number) => {
				if (animationStartTime === undefined) {
					animationStartTime = timestamp;
				}
				const elapsed = timestamp - animationStartTime;
				const animationProgress = (elapsed % LOOP_DURATION_MS) / LOOP_DURATION_MS;
				const currentTime = globalStartTime + animationProgress * globalDuration;

				const trails: Feature<LineString, ShipTrailProperties & { progress: number }>[] = [];
				const heads: Feature<Point, ShipTrailProperties & { progress: number }>[] = [];

				processedFeatures.forEach((feature) => {
					const { startTime, endTime, duration, distance } = feature.properties;

					if (currentTime < startTime || currentTime > endTime) {
						return;
					}

					const journeyProgress = (currentTime - startTime) / duration;
					const distanceTraveled = Math.min(distance, Math.max(0, distance * journeyProgress));
					const dynamicTail = Math.min(MAX_TAIL_LENGTH_KM, distance * 0.5);
					const visibleTail = Math.max(dynamicTail, MIN_TAIL_LENGTH_KM);
					const tailStartDistance = Math.max(distanceTraveled - visibleTail, 0);

					const headPoint = turf.along(feature.geometry, distanceTraveled, {
						units: 'kilometers'
					});

					const headGeometry = headPoint.geometry;
					if (!headGeometry || headGeometry.type !== 'Point') {
						return;
					}

					const properties = {
						...feature.properties,
						progress: journeyProgress
					};

					headPoint.properties = properties;
					heads.push(headPoint as Feature<Point, ShipTrailProperties & { progress: number }>);

					if (distanceTraveled <= 0) {
						return;
					}

					let tail = turf.lineSliceAlong(
						feature.geometry,
						tailStartDistance,
						distanceTraveled,
						{ units: 'kilometers' }
					);

					let tailCoordinates =
						tail.geometry && tail.geometry.type === 'LineString'
							? tail.geometry.coordinates
							: [];

					if (tailCoordinates.length < MIN_LINE_COORDS) {
						const fallbackTail = turf.lineSliceAlong(
							feature.geometry,
							Math.max(distanceTraveled - MIN_TAIL_LENGTH_KM, 0),
							distanceTraveled,
							{ units: 'kilometers' }
						);
						tailCoordinates =
							fallbackTail.geometry && fallbackTail.geometry.type === 'LineString'
								? fallbackTail.geometry.coordinates
								: [];
					}

					if (tailCoordinates.length < MIN_LINE_COORDS) {
						return;
					}

					tail = {
						...tail,
						geometry: {
							type: 'LineString',
							coordinates: tailCoordinates
						}
					};

					tail.properties = properties;
					trails.push(tail as Feature<LineString, ShipTrailProperties & { progress: number }>);
				});

				(map.getSource('ship-trails') as maplibregl.GeoJSONSource).setData({
					type: 'FeatureCollection',
					features: trails
				});

				(map.getSource('ship-heads') as maplibregl.GeoJSONSource).setData({
					type: 'FeatureCollection',
					features: heads
				});

				requestAnimationFrame(animate);
			};

			requestAnimationFrame(animate);
		});

		// Clean up map instance on component destroy
		return () => map.remove();
	});
</script>

<main>
	<div class="map-container" bind:this={mapContainer}></div>
</main>

<style>
	.map-container {
		width: 100vw;
		height: 100vh;
	}
</style>