# Shipping Layer Reintegration Plan

## Goal
- Restore the deck.gl shipping routes layer on top of the Mapbox map, ensuring perfect geographic alignment, smooth looping animation, and responsive performance on desktop and mobile.

## Constraints & Considerations
- Reuse the existing `shipping_2020_trips.json` payload without blocking initial load; degrade gracefully if assets are missing.
- Keep the map interactive and compatible with current theme switching and navigation state.
- Follow deck.gl best practices for animation and performance (see attached docs).

## Step-by-Step Implementation

1. **Codebase Recon & Cleanup**
	- Inspect the previously commented deck.gl integration in `MapView.svelte` and identify all unused variables, helper functions, and old lifecycle hooks.
	- Document the minimal dependencies required (deck.gl core, MapboxOverlay, TripsLayer) and verify they are installed or add them to `package.json` if missing.

2. **Data Preparation Strategy**
	- Analyze `shipping_2020_trips.json` (size, schema) and design a lazy-loading pathway using dynamic `import()` coupled with requestIdleCallback/fetch prioritization to avoid blocking the intro animation.
	- Create a lightweight transformer (in `src/lib/data/shippingTrips.ts` or similar) that memoizes parsed trips, precomputes timestamps, and supports chunking or progressive streaming if dataset is large.
	- Define TypeScript types for trip segments to ensure clarity in downstream rendering logic.

3. **Map Alignment Architecture**
	- Reintroduce deck.gl via `MapboxOverlay`, guaranteeing the overlay uses the Mapbox map instance from `MapView.svelte`.
	- Ensure the overlay is attached once the Mapbox style is loaded and updated when the style changes (e.g., on theme switch), mirroring `handleStyleLoad` logic.
	- Validate alignment by syncing zoom, center, pitch, and bearing with the active Mapbox camera state (especially during intro fly-to and sidebar transitions).

4. **TripsLayer Configuration**
	- Implement a factory that builds the `TripsLayer` with:
	  - `getPath` and `getTimestamps` derived from the transformed dataset.
	  - A fixed ship color of `#E44000` applied to every trip (reuse `SOUND_TYPE_COLORS.ships`).
	  - A derived `trailLength` tuned for perceptibility without overwhelming the map.
	  - `currentTime` driven by an internal animation clock (in milliseconds) stored in component state.
	- Keep prop updates simple—only add `updateTriggers` where we expect real changes (e.g., dataset refresh), avoiding unnecessary complexity.

5. **Animation Loop & Controls**
	- Replace the manual `requestAnimationFrame` logic with a resilient loop that:
	  - Starts only after data load, map readiness, **and** the map entering `sidebar` mode.
	  - Advances `currentTime` until the maximum trip timestamp, then resets to 0 to create a seamless loop.
    - Prints % of trips completed in the console as animation happens to track the animation length / completion.
	  - Pauses when the component unmounts or when map mode leaves `sidebar` (including while in `intro`).
	- Expose optional hooks for future playback controls (play/pause, speed multiplier).

6. **Performance Optimizations**
	- Minimize data churn by caching the deck layer instance and updating only when dependencies change.
	- Focus on animation-centric tweaks: avoid re-creating layers per frame and keep accessors lightweight.
	- Skip more advanced strategies (chunking, visibility toggles, binary attributes) unless profiling later shows the dataset needs it.
	- Ensure cleanup tears down the overlay, cancels animation frames, and clears references to avoid memory leaks.

7. **Integration with Existing Modes**
	- Ensure the deck overlay honors `applyMode` transitions by updating frame size/radius after GSAP animations complete.
	- Confirm the overlay re-initializes correctly after `updateMapStyle` sets a new style URL.

8. **Testing & Validation**
	- Manually verify map alignment at multiple zoom levels and during `handleEnterClick` fly-to.
	- Test performance in dev build (desktop + throttled mobile profile) and capture FPS metrics or qualitative notes.
	- Add regression notes in `docs/shipping-layer-testing.md` describing test scenarios and expected outcomes.

9. **Follow-Up Enhancements (Optional)**
	- Investigate audio-reactive linkage between ship proximity and sound effects.
	- Add UI toggles for layer visibility and animation speed once baseline performance is confirmed.

