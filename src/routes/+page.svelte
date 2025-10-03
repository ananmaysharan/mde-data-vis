<script>
	import {Squares, HourSquares, ShipMap, Animation} from '$lib';
	import Tabs from '$lib/Tabs.svelte';
	import DayTimeline from '$lib/DayTimeline.svelte';
	
	// Example: Date range spanning multiple years (18 months)
	const startDate = new Date('2019-11-01');
	const endDate = new Date('2021-11-13');

	const tabs = [
		// { label: 'Squares', component: Squares, props: { startDate, endDate } },
		// { label: 'Hour Squares', component: HourSquares, props: { startDate, endDate } },	
		// { label: 'Day Timeline', component: DayTimeline, props: { startDate, endDate } },
		// { label: 'Map', component: ShipMap, prop228, 65, 0s: {} },
		{ label: 'Animation', component: Animation, props: {} },
		// { label: 'Map', component: Map, props: {} }
	];
</script>

<!-- <Tabs {tabs} /> -->

<Animation/>

