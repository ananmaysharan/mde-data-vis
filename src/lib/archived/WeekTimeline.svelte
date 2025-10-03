<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import dataUrl from '$lib/assets/day_level_summary.csv?url';

	const HUMAN_COLS = ['sonar', 'ships', 'explosions'] as const;
	type HumanColumn = (typeof HUMAN_COLS)[number];
	const METRIC_COLUMNS = ['bluewhale', 'humpbackwhale', 'finwhale', ...HUMAN_COLS] as const;
	type MetricColumn = (typeof METRIC_COLUMNS)[number];

	const DAYS_PER_WEEK = 7;
	const TIMELINE_MARGIN_LEFT = 24;
	const TIMELINE_MARGIN_RIGHT = 24;
	const COLUMN_WIDTH = 38;
	const COLUMN_GAP = 14;
	const TIMELINE_CONTENT_WIDTH =
		DAYS_PER_WEEK * COLUMN_WIDTH + (DAYS_PER_WEEK - 1) * COLUMN_GAP;
	const VIEWBOX_WIDTH = TIMELINE_CONTENT_WIDTH + TIMELINE_MARGIN_LEFT + TIMELINE_MARGIN_RIGHT;

		const circleBaseRadius = COLUMN_WIDTH * 0.48;
		const circleMinDetectRadius = Math.max(6, circleBaseRadius * 0.55);
		const circleMaxDetectRadius = Math.max(circleMinDetectRadius + 6, circleBaseRadius * 1.85);
		const circleZeroRadius = Math.max(4, circleBaseRadius * 0.45);
	const colorEncodingRadius = circleBaseRadius;

	const BAR_WIDTH = TIMELINE_CONTENT_WIDTH;
	const BAR_HEIGHT = Math.max(8, circleBaseRadius * 0.5);
		const BAR_GAP = 6;
		const HUMAN_ROW_Y = 36;
		const BLUE_ROW_Y = HUMAN_ROW_Y + circleMaxDetectRadius * 2;
		const DAY_LABEL_Y = BLUE_ROW_Y + circleMaxDetectRadius + 10;
		const HUMPBACK_BAR_Y = DAY_LABEL_Y + 10;
		const FIN_BAR_Y = HUMPBACK_BAR_Y + BAR_HEIGHT + BAR_GAP;
		const VIEWBOX_HEIGHT = FIN_BAR_Y + BAR_HEIGHT + 20;

	type ValueStatus = 'missing' | 'zero' | 'detect';
	type SeriesStatus = ValueStatus;
	type CircleEncoding = 'size' | 'color';

	interface DataEntry {
		date: Date;
		values: Record<MetricColumn, number | null>;
	}

	interface AggregatedDay {
		date: Date;
		label: string;
		shortLabel: string;
		blueStatus: ValueStatus;
		humanStatus: ValueStatus;
		blueCount: number | null;
		humanCount: number | null;
		withinRange: boolean;
	}

	interface WeekDatum {
		key: string;
		start: Date;
		end: Date;
		label: string;
		humpback: SeriesStatus;
		fin: SeriesStatus;
		days: AggregatedDay[];
		hasData: boolean;
	}

	let { startDate, endDate } = $props<{ startDate: Date; endDate: Date }>();
	let isLoaded = $state(false);
	let hasData = $state(false);
	let rawRows = $state<DataEntry[]>([]);
	let weeks = $state<WeekDatum[]>([]);
	let maxBlueCount = $state(0);
	let maxHumanCount = $state(0);
	let circleEncoding = $state<CircleEncoding>('size');

	const isoDayFormatter = d3.utcFormat('%Y-%m-%d');
	const isoWeekFormatter = d3.utcFormat('%G-W%V');
	const dayLabelFormatter = d3.utcFormat('%a %d');
	const csvDateParser = d3.utcParse('%Y-%m-%d %H:%M:%S%Z');
		const WEEKDAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const intlDayFormatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
	const intlDayFormatterWithYear = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});

	onMount(async () => {
		const rows = await d3.csv<DataEntry>(
			dataUrl,
			(row: Record<string, string | undefined>) => parseRow(row) ?? undefined
		);
		rawRows = rows;
		isLoaded = true;
	});

	$effect(() => {
		if (!isLoaded) return;
		if (!startDate || !endDate || startDate > endDate) {
			weeks = [];
			hasData = false;
			maxBlueCount = 0;
			maxHumanCount = 0;
			return;
		}

		const rangeRows = rawRows.filter((entry) => entry.date >= startDate && entry.date <= endDate);
		const { weeks: nextWeeks, maxBlue, maxHuman } = buildWeeks(rangeRows, startDate, endDate);
		weeks = nextWeeks;
		maxBlueCount = maxBlue;
		maxHumanCount = maxHuman;
		hasData = nextWeeks.some((week) => week.hasData);
	});

	function parseRow(row: Record<string, string | undefined>): DataEntry | null {
		const rawDate = row.time ?? row['time '];
		const date = csvDateParser(rawDate ?? '');
		if (!date || Number.isNaN(date.getTime())) return null;

		const values = METRIC_COLUMNS.reduce<Record<MetricColumn, number | null>>((acc, column) => {
			acc[column] = parseValue(row[column]);
			return acc;
		}, {} as Record<MetricColumn, number | null>);

		return {
			date,
			values
		};
	}

	function parseValue(value: string | undefined): number | null {
		if (value === undefined) return null;
		const text = value.trim();
		if (!text || text.toLowerCase() === 'null') return null;
		const nextValue = Number(text);
		return Number.isNaN(nextValue) ? null : nextValue;
	}

	function buildWeeks(rows: DataEntry[], start: Date, end: Date) {
		const rowsByDay = groupRowsByDay(rows);
		const weeks: WeekDatum[] = [];

		const startUtc = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
		const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

		const firstWeekStart = d3.utcMonday.floor(new Date(startUtc));
		const lastWeekStart = d3.utcMonday.floor(new Date(endUtc));

		let maxBlue = 0;
		let maxHuman = 0;

		for (let cursor = new Date(firstWeekStart); cursor <= lastWeekStart; cursor = d3.utcMonday.offset(cursor, 1)) {
			const weekStart = new Date(cursor);
			const weekEnd = d3.utcDay.offset(new Date(weekStart), DAYS_PER_WEEK - 1);

			const days: AggregatedDay[] = [];
			const weekRows: DataEntry[] = [];

			for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
				const dayDate = d3.utcDay.offset(new Date(weekStart), dayIndex);
				const withinRange = dayDate >= startUtc && dayDate <= endUtc;
				const key = isoDayFormatter(dayDate);
				const entry = rowsByDay.get(key);
				if (entry && withinRange) {
					weekRows.push(entry);
				}

						const dayDatum = buildDay(dayDate, entry, withinRange, dayIndex);

				if (withinRange && dayDatum.blueStatus !== 'missing' && dayDatum.blueCount !== null) {
					maxBlue = Math.max(maxBlue, dayDatum.blueCount);
				}
				if (withinRange && dayDatum.humanStatus !== 'missing' && dayDatum.humanCount !== null) {
					maxHuman = Math.max(maxHuman, dayDatum.humanCount);
				}

				days.push(dayDatum);
			}

			const humpback = getSeriesStatus(weekRows, 'humpbackwhale');
			const fin = getSeriesStatus(weekRows, 'finwhale');
			const hasWeekData = hasWeekContent(days, humpback, fin);

			weeks.push({
				key: isoWeekFormatter(weekStart),
				start: weekStart,
				end: weekEnd,
				label: formatWeekLabel(weekStart, weekEnd),
				humpback,
				fin,
				days,
				hasData: hasWeekData
			});
		}

		return {
			weeks,
			maxBlue,
			maxHuman
		};
	}

	function groupRowsByDay(rows: DataEntry[]) {
		const map = new Map<string, DataEntry>();
		for (const row of rows) {
			map.set(isoDayFormatter(row.date), row);
		}
		return map;
	}

		function buildDay(
			date: Date,
			entry: DataEntry | undefined,
			withinRange: boolean,
			dayIndex: number
		): AggregatedDay {
		const blueCount = withinRange ? entry?.values.bluewhale ?? null : null;
		const humanCount = withinRange ? sumHumanValues(entry) : null;

		return {
			date: new Date(date),
			label: dayLabelFormatter(date),
				shortLabel: WEEKDAY_SHORT_LABELS[dayIndex % WEEKDAY_SHORT_LABELS.length] ?? '—',
			blueStatus: withinRange ? getValueStatus(blueCount) : 'missing',
			humanStatus: withinRange ? getValueStatus(humanCount) : 'missing',
			blueCount,
			humanCount,
			withinRange
		};
	}

	function sumHumanValues(entry: DataEntry | undefined): number | null {
		if (!entry) return null;
		let sum = 0;
		let hasValue = false;
		for (const column of HUMAN_COLS) {
			const value = entry.values[column];
			if (value !== null && value !== undefined) {
				sum += value;
				hasValue = true;
			}
		}
		return hasValue ? sum : null;
	}

	function getValueStatus(value: number | null | undefined): ValueStatus {
		if (value === null || value === undefined) return 'missing';
		if (value > 0) return 'detect';
		return 'zero';
	}

	function getSeriesStatus(rows: DataEntry[], column: MetricColumn): SeriesStatus {
		const values = rows.map((row) => row.values[column]).filter((value) => value !== null);
		if (values.length === 0) return 'missing';
		return values.some((value) => (value ?? 0) > 0) ? 'detect' : 'zero';
	}

	function hasWeekContent(days: AggregatedDay[], humpback: SeriesStatus, fin: SeriesStatus) {
		if (humpback !== 'missing' || fin !== 'missing') return true;
		return days.some((day) => day.withinRange && (day.blueStatus !== 'missing' || day.humanStatus !== 'missing'));
	}

	function formatWeekLabel(start: Date, end: Date) {
		const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
		const startText = sameYear
			? intlDayFormatter.format(start)
			: intlDayFormatterWithYear.format(start);
		const endText = intlDayFormatterWithYear.format(end);
		return `${startText} – ${endText}`;
	}

	function dayToX(dayIndex: number) {
		return TIMELINE_MARGIN_LEFT + dayIndex * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2;
	}

	function lightenColor(color: string, amount: number): string {
		const parsed = d3.color(color);
		if (!parsed) return color;
		const hsl = d3.hsl(parsed);
		hsl.l = Math.min(1, Math.max(0, hsl.l + amount));
		return hsl.formatHex();
	}

	const humpbackColor = '#E8BB48';
	const finColor = '#677336';
	const blueColor = '#5888A6';
	const humanColor = '#C1453F';
	const circleStrokeColor = '#CBD5E1';
	const humpbackZeroFill = lightenColor(humpbackColor, 0.55);
	const humpbackZeroStroke = lightenColor(humpbackColor, 0.35);
	const finZeroFill = lightenColor(finColor, 0.6);
	const finZeroStroke = lightenColor(finColor, 0.4);

	function getCircleVisual(day: AggregatedDay, type: 'blue' | 'human') {
		const status = type === 'blue' ? day.blueStatus : day.humanStatus;
		const baseColor = type === 'blue' ? blueColor : humanColor;
		const count = type === 'blue' ? day.blueCount : day.humanCount;
		const max = type === 'blue' ? maxBlueCount : maxHumanCount;

			if (status === 'missing') {
			return {
				radius: 0,
				fill: 'none',
				stroke: circleStrokeColor,
					opacity: day.withinRange ? 0.18 : 0.12,
					fillOpacity: 0
			};
		}

		if (status === 'zero') {
			return {
				radius: circleZeroRadius,
				fill: 'none',
				stroke: circleStrokeColor,
					opacity: day.withinRange ? 1 : 0.4,
					fillOpacity: 0
			};
		}

		const normalized = max > 0 && count !== null ? Math.min(1, Math.max(0, count / max)) : 0;
		const radius = circleEncoding === 'size'
			? circleMinDetectRadius + normalized * (circleMaxDetectRadius - circleMinDetectRadius)
			: colorEncodingRadius;

		const color = circleEncoding === 'color'
			? d3.interpolateLab('#f8fafc', baseColor)(0.25 + 0.75 * normalized)
			: baseColor;

			const fillOpacity = 0.25 + 0.55 * normalized;

		return {
			radius,
			fill: color,
			stroke: color,
				opacity: day.withinRange ? 1 : 0.4,
				fillOpacity
		};
	}
</script>

<div
	class="timeline"
	style={`--color-humpback:${humpbackColor};--color-fin:${finColor};--color-blue:${blueColor};--color-human:${humanColor};--circle-stroke:${circleStrokeColor};--color-humpback-zero-fill:${humpbackZeroFill};--color-humpback-zero-stroke:${humpbackZeroStroke};--color-fin-zero-fill:${finZeroFill};--color-fin-zero-stroke:${finZeroStroke};`}
>
	<div class="toolbar">
		<div class="legend">
			<div class="legend-item">
				<span class="swatch" style={`background:${humpbackColor}`}></span>
				<span>Weekly humpback whale</span>
			</div>
			<div class="legend-item">
				<span class="swatch" style={`background:${finColor}`}></span>
				<span>Weekly fin whale</span>
			</div>
			<div class="legend-item">
				<span class="circle-swatch blue"></span>
				<span>Daily blue whale detections</span>
			</div>
			<div class="legend-item">
				<span class="circle-swatch human"></span>
				<span>Daily human noise activity</span>
			</div>
		</div>

		<div class="encoding-toggle" role="group" aria-label="Circle encoding mode">
			<span class="toggle-label">Circle encoding:</span>
					<button
						type="button"
						class={circleEncoding === 'size' ? 'active' : ''}
						onclick={() => (circleEncoding = 'size')}
					>
				Relative size
			</button>
					<button
						type="button"
						class={circleEncoding === 'color' ? 'active' : ''}
						onclick={() => (circleEncoding = 'color')}
					>
				Color intensity
			</button>
		</div>
	</div>

	{#if isLoaded && !hasData}
		<p class="empty">No detections found in this period.</p>
	{/if}

	{#if weeks.length}
		<div class="weeks">
			{#each weeks as week}
				<section class={`week ${week.hasData ? '' : 'empty-week'}`}>
					<h3>{week.label}</h3>
					<svg
						viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
						role="img"
						aria-label={`Week of ${week.label}`}
					>
						{#if week.humpback !== 'missing'}
							<rect
								x={TIMELINE_MARGIN_LEFT}
								y={HUMPBACK_BAR_Y}
								width={BAR_WIDTH}
								height={BAR_HEIGHT}
								rx={BAR_HEIGHT / 2}
								class={`bar humpback ${week.humpback}`}
							/>
						{/if}
						{#if week.fin !== 'missing'}
							<rect
								x={TIMELINE_MARGIN_LEFT}
								y={FIN_BAR_Y}
								width={BAR_WIDTH}
								height={BAR_HEIGHT}
								rx={BAR_HEIGHT / 2}
								class={`bar fin ${week.fin}`}
							/>
						{/if}

						{#each week.days as day, index}
							{@const blueVisual = getCircleVisual(day, 'blue')}
							{@const humanVisual = getCircleVisual(day, 'human')}

							<circle
								cx={dayToX(index)}
								cy={HUMAN_ROW_Y}
								r={humanVisual.radius}
								class={`circle human ${day.humanStatus}`}
												style={`fill:${humanVisual.fill};stroke:${humanVisual.stroke};opacity:${humanVisual.opacity};fill-opacity:${humanVisual.fillOpacity ?? 1};`}
							/>
							<circle
								cx={dayToX(index)}
								cy={BLUE_ROW_Y}
								r={blueVisual.radius}
								class={`circle blue ${day.blueStatus}`}
												style={`fill:${blueVisual.fill};stroke:${blueVisual.stroke};opacity:${blueVisual.opacity};fill-opacity:${blueVisual.fillOpacity ?? 1};`}
							/>

							<text
								x={dayToX(index)}
								y={DAY_LABEL_Y}
								class={`day-label ${day.withinRange ? '' : 'muted'}`}
							>
								{day.shortLabel}
							</text>
						{/each}
					</svg>
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		align-items: flex-start;
		justify-content: space-between;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
		font-size: 0.875rem;
		align-items: center;
	}

	.legend-item {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
	}

	.swatch {
		width: 1.25rem;
		height: 0.75rem;
		border-radius: 999px;
		display: inline-block;
	}

	.circle-swatch {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 50%;
		border: 2px solid currentColor;
	}

	.circle-swatch.blue {
		color: var(--color-blue);
	}

	.circle-swatch.human {
		color: var(--color-human);
	}

	.encoding-toggle {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		font-size: 0.85rem;
	}

	.encoding-toggle button {
		border: 1px solid #cbd5e1;
		background: #f8fafc;
		color: #1f2937;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
	}

	.encoding-toggle button.active {
		background: #1f2937;
		color: #f8fafc;
		border-color: #1f2937;
	}

	.encoding-toggle button:not(.active):hover {
		border-color: #94a3b8;
	}

	.toggle-label {
		font-weight: 500;
		color: #334155;
	}

	.weeks {
		display: grid;
		gap: 1.25rem;
	}

	.week {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.week h3 {
		font-size: 1.05rem;
		font-weight: 600;
		margin: 0;
		color: #1f2937;
	}

	.week.empty-week svg {
		opacity: 0.45;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
		background: #ffffff;
	}

	.bar.detect.humpback {
		fill: var(--color-humpback);
	}

	.bar.zero.humpback {
		fill: var(--color-humpback-zero-fill);
		stroke: var(--color-humpback-zero-stroke);
		stroke-width: 1;
	}

	.bar.detect.fin {
		fill: var(--color-fin);
	}

	.bar.zero.fin {
		fill: var(--color-fin-zero-fill);
		stroke: var(--color-fin-zero-stroke);
		stroke-width: 1;
	}

	.circle {
		fill: none;
		stroke: var(--circle-stroke);
		stroke-width: 1.6;
	}

	.circle.zero {
		fill: none;
	}

	.circle.missing {
		stroke: none;
		fill: none;
	}

	.empty {
		font-size: 0.95rem;
		color: #64748b;
	}

	.day-label {
		font-size: 0.78rem;
		font-weight: 500;
		text-anchor: middle;
		fill: #334155;
	}

	.day-label.muted {
		fill: #94a3b8;
	}

	@media (min-width: 980px) {
		.weeks {
			grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
		}
	}
</style>
