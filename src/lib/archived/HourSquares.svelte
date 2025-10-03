<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import dataUrl from '$lib/assets/hour_level_summary.csv?url';

	const HUMAN_COLS = ['sonar', 'ships', 'explosions'] as const;
	type HumanColumn = (typeof HUMAN_COLS)[number];
	const ANIMAL_COLS = ['bluewhale', 'humpbackwhale', 'finwhale'] as const;
	type AnimalColumn = (typeof ANIMAL_COLS)[number];
	const METRIC_COLUMNS = [...HUMAN_COLS, ...ANIMAL_COLS] as const;
	type MetricColumn = (typeof METRIC_COLUMNS)[number];
	type CategoryKey = 'human' | AnimalColumn;

	type CellStatus = 'null' | 'detect' | 'zero';

	interface CategoryMeta {
		key: CategoryKey;
		label: string;
		color: string;
	}

	interface MatrixCell {
		status: CellStatus;
		date: Date | null;
	}

	type Matrix = MatrixCell[][][]; // hour -> day -> category

	interface CellDatum extends MatrixCell {
		hourIndex: number;
		dayIndex: number;
		categoryIndex: number;
		categoryMeta: CategoryMeta;
	}

	interface MonthDatum {
		monthIndex: number;
		label: string;
		year: number;
		month: number;
		daysInMonth: number;
		cells: CellDatum[];
	}

	interface DataEntry {
		date: Date;
		year: number;
		values: Record<MetricColumn, number | null>;
	}

	const CATEGORY_META: CategoryMeta[] = [
		{ key: 'human', label: 'Human activity', color: '#C1453F' },
		{ key: 'bluewhale', label: 'Blue whale', color: '#5888A6' },
		{ key: 'humpbackwhale', label: 'Humpback whale', color: '#E8BB48' },
		{ key: 'finwhale', label: 'Fin whale', color: '#677336' }
	];
	const CATEGORY_INDEX = new Map<CategoryKey, number>(
		CATEGORY_META.map((category, index) => [category.key, index] as const)
	);
	const HOURS_PER_DAY = 24;
	const CATEGORY_COUNT = CATEGORY_META.length;
	const CELL_SIZE = 12; // Smaller for more days
	const CELL_PADDING = 1;
	const CELL_DRAW = CELL_SIZE - CELL_PADDING;
	const PLOT_MARGIN = { top: 50, right: 28, bottom: 32, left: 80 };
	const LEGEND_BLOCK_HEIGHT = 64;
	const ZERO_STROKE = '#ddd';
	const monthFormatter = d3.utcFormat('%b');
	const tooltipFormatter = (date: Date) => {
		return `${d3.utcFormat('%b %d')(date)}, ${String(date.getUTCHours()).padStart(2, '0')}:00 ${date.getUTCFullYear()}`;
	};
	const DAY_WIDTH = CATEGORY_COUNT * CELL_SIZE + CELL_SIZE; // Extra space between days

	let { startDate, endDate } = $props<{ startDate: Date; endDate: Date }>();
	let container: HTMLDivElement | null = null;
	let containerWidth = $state(0);
	let rawRows = $state<DataEntry[]>([]);
	let months = $state<MonthDatum[]>([]);
	let hasDetections = $state(false);
	let hasData = $state(false);

	onMount(async () => {
		const rows = await d3.csv<DataEntry>(dataUrl, (row: CsvRow) => parseRow(row) ?? undefined);
		rawRows = rows;
	});

	$effect(() => {
		const dateRangeRows: DataEntry[] = rawRows.filter((entry) => 
			entry.date >= startDate && entry.date <= endDate
		);
		const hasDateData = dateRangeRows.length > 0;
		const nextMonths: MonthDatum[] = hasDateData ? buildDateRangeGrid(dateRangeRows, startDate, endDate) : createEmptyMonths(startDate, endDate);
		months = nextMonths;
		hasData = hasDateData;
		hasDetections = hasDateData
			? nextMonths.some((month: MonthDatum) =>
					month.cells.some((cell: CellDatum) => cell.status === 'detect')
				)
			: false;
	});

	$effect(() => {
		if (!container) return;
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
			}
		});
		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	});

	$effect(() => {
		if (!container || !months.length) return;
		render(months);
	});

	type CsvRow = Record<string, string | undefined>;

	function parseRow(row: CsvRow): DataEntry | null {
		const date = new Date(row.time ?? '');
		if (Number.isNaN(date.getTime())) return null;

		const values = METRIC_COLUMNS.reduce<Record<MetricColumn, number | null>>((acc, column) => {
			acc[column] = parseValue(row[column]);
			return acc;
		}, {} as Record<MetricColumn, number | null>);

		return {
			date,
			year: date.getUTCFullYear(),
			values
		};
	}

	function parseValue(raw: string | null | undefined): number | null {
		if (raw === undefined || raw === null) return null;
		const text = String(raw).trim();
		if (!text || text.toLowerCase() === 'null') return null;
		const value = Number(text);
		return Number.isNaN(value) ? null : value;
	}

	function createEmptyMonths(startDate: Date, endDate: Date): MonthDatum[] {
		const months: MonthDatum[] = [];
		const current = new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
		const end = new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1);
		let monthIndex = 0;
		
		while (current <= end) {
			const daysInMonth = new Date(current.getUTCFullYear(), current.getUTCMonth() + 1, 0).getUTCDate();
			months.push({
				monthIndex,
				label: monthFormatter(current),
				year: current.getUTCFullYear(),
				month: current.getUTCMonth(),
				daysInMonth,
				cells: createEmptyCells(daysInMonth)
			});
			current.setUTCMonth(current.getUTCMonth() + 1);
			monthIndex++;
		}
		return months;
	}

	function createEmptyCells(daysInMonth: number): CellDatum[] {
		const cells: CellDatum[] = [];
		for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
			for (let day = 0; day < daysInMonth; day += 1) {
				for (let category = 0; category < CATEGORY_COUNT; category += 1) {
					cells.push({
						status: 'null',
						date: null,
						hourIndex: hour,
						dayIndex: day,
						categoryIndex: category,
						categoryMeta: CATEGORY_META[category]
					});
				}
			}
		}
		return cells;
	}

	function buildDateRangeGrid(rows: DataEntry[], startDate: Date, endDate: Date): MonthDatum[] {
		const monthsMap = new Map<string, { year: number; month: number; monthIndex: number; entries: DataEntry[]; daysInMonth: number }>();
		let globalMonthIndex = 0;
		
		// Create month buckets
		const current = new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
		const end = new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1);
		
		while (current <= end) {
			const key = `${current.getUTCFullYear()}-${current.getUTCMonth()}`;
			const daysInMonth = new Date(current.getUTCFullYear(), current.getUTCMonth() + 1, 0).getUTCDate();
			monthsMap.set(key, {
				year: current.getUTCFullYear(),
				month: current.getUTCMonth(),
				monthIndex: globalMonthIndex++,
				entries: [],
				daysInMonth
			});
			current.setUTCMonth(current.getUTCMonth() + 1);
		}
		
		// Group entries by month
		for (const entry of rows) {
			const key = `${entry.date.getUTCFullYear()}-${entry.date.getUTCMonth()}`;
			const monthData = monthsMap.get(key);
			if (monthData) {
				monthData.entries.push(entry);
			}
		}
		
		// Build grid for each month
		return Array.from(monthsMap.values()).map(monthData => {
			const matrix = createMatrix(monthData.daysInMonth);
			
			for (const entry of monthData.entries) {
				const hourIndex = entry.date.getUTCHours();
				const dayIndex = entry.date.getUTCDate() - 1;

				const humanValues = HUMAN_COLS.map((column) => entry.values[column]);
				const humanHasData = humanValues.some((value) => value !== null);
				if (humanHasData) {
					const humanDetected = humanValues.some((value) => (value ?? 0) > 0);
					setCell(matrix, hourIndex, dayIndex, 'human', humanDetected ? 'detect' : 'zero', entry.date);
				}

				for (const column of ANIMAL_COLS) {
					const value = entry.values[column];
					if (value !== null) {
						setCell(matrix, hourIndex, dayIndex, column, value > 0 ? 'detect' : 'zero', entry.date);
					}
				}
			}
			
			return {
				monthIndex: monthData.monthIndex,
				label: monthFormatter(new Date(Date.UTC(monthData.year, monthData.month, 1))),
				year: monthData.year,
				month: monthData.month,
				daysInMonth: monthData.daysInMonth,
				cells: flattenMatrix(matrix)
			};
		});
	}

	function createMatrix(daysInMonth: number): Matrix {
		return Array.from({ length: HOURS_PER_DAY }, () =>
			Array.from({ length: daysInMonth }, () =>
				Array.from({ length: CATEGORY_COUNT }, () => ({ status: 'null', date: null }))
			)
		);
	}

	function setCell(
		matrix: Matrix,
		hourIndex: number,
		dayIndex: number,
		categoryKey: CategoryKey,
		status: CellStatus,
		date: Date
	): void {
		const categoryIndex = CATEGORY_INDEX.get(categoryKey);
		if (categoryIndex === undefined) return;
		const cell = matrix[hourIndex]?.[dayIndex]?.[categoryIndex];
		if (!cell) return;
		if (cell.status === 'null' || (cell.status === 'zero' && status === 'detect')) {
			cell.status = status;
			cell.date = date;
		}
	}

	function flattenMatrix(matrix: Matrix): CellDatum[] {
		const cells: CellDatum[] = [];
		for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
			for (let day = 0; day < matrix[0].length; day += 1) {
				for (let category = 0; category < CATEGORY_COUNT; category += 1) {
					const cell = matrix[hour][day][category];
					cells.push({
						...cell,
						hourIndex: hour,
						dayIndex: day,
						categoryIndex: category,
						categoryMeta: CATEGORY_META[category]
					});
				}
			}
		}
		return cells;
	}

	function render(dataset: MonthDatum[]): void {
		if (dataset.length === 0) return;
		
		const svg = d3.select(container).selectAll('svg').data([null]).join('svg');
		const maxDays = 31;
		const totalWidth = maxDays * DAY_WIDTH + PLOT_MARGIN.left + PLOT_MARGIN.right;
		const monthHeight = HOURS_PER_DAY * CELL_SIZE + PLOT_MARGIN.top + PLOT_MARGIN.bottom;
		const totalHeight = dataset.length * monthHeight + LEGEND_BLOCK_HEIGHT;
		
		svg.attr('width', totalWidth).attr('height', totalHeight);
		
		const g = svg.selectAll('.month').data(dataset).join('g').attr('class', 'month')
			.attr('transform', (d: MonthDatum) => `translate(0, ${d.monthIndex * monthHeight})`);
		
		// Month labels
		g.selectAll('.month-label').data((d: MonthDatum) => [d]).join('text').attr('class', 'month-label')
			.attr('x', PLOT_MARGIN.left - 15).attr('y', PLOT_MARGIN.top + (HOURS_PER_DAY * CELL_SIZE) / 2)
			.attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
			.attr('font-size', '14px').attr('font-weight', 'bold')
			.text((d: MonthDatum) => `${d.label} ${d.year}`);
		
		// Day labels
		g.selectAll('.day-label').data((d: MonthDatum) => Array.from({ length: d.daysInMonth }, (_, i) => ({ day: i + 1, monthIndex: d.monthIndex }))).join('text').attr('class', 'day-label')
			.attr('x', (d: { day: number; monthIndex: number }) => PLOT_MARGIN.left + (d.day - 1) * DAY_WIDTH + (CATEGORY_COUNT * CELL_SIZE) / 2)
			.attr('y', PLOT_MARGIN.top - 15)
			.attr('text-anchor', 'middle')
			.attr('font-size', '10px')
			.text((d: { day: number; monthIndex: number }) => d.day);
		
		// Cells
		const cellGroups = g.selectAll('.cell').data((d: MonthDatum) => d.cells).join('g').attr('class', 'cell')
			.attr('transform', (d: CellDatum) => `translate(${PLOT_MARGIN.left + d.dayIndex * DAY_WIDTH + d.categoryIndex * CELL_SIZE}, ${PLOT_MARGIN.top + d.hourIndex * CELL_SIZE})`);
		
		cellGroups.selectAll('rect').data((d: CellDatum) => [d]).join('rect')
			.attr('width', CELL_DRAW).attr('height', CELL_DRAW)
			.attr('fill', (d: CellDatum) => d.status === 'detect' ? d.categoryMeta.color : d.status === 'zero' ? 'white' : 'transparent')
			.attr('stroke', (d: CellDatum) => d.status === 'zero' ? ZERO_STROKE : 'none')
			.attr('stroke-width', 1)
			.attr('rx', 1);
		
		// Day separators
		g.selectAll('.day-separator').data((d: MonthDatum) => Array.from({ length: d.daysInMonth - 1 }, (_, i) => i + 1)).join('line').attr('class', 'day-separator')
			.attr('x1', (day: number) => PLOT_MARGIN.left + day * DAY_WIDTH)
			.attr('x2', (day: number) => PLOT_MARGIN.left + day * DAY_WIDTH)
			.attr('y1', PLOT_MARGIN.top)
			.attr('y2', PLOT_MARGIN.top + HOURS_PER_DAY * CELL_SIZE)
			.attr('stroke', '#ccc')
			.attr('stroke-width', 1);
		
		// Tooltip
		const tooltip = d3.select(container).selectAll('.tooltip').data([null]).join('div')
			.attr('class', 'tooltip')
			.style('position', 'absolute')
			.style('pointer-events', 'none')
			.style('background', 'rgba(0,0,0,0.8)')
			.style('color', 'white')
			.style('padding', '5px')
			.style('border-radius', '3px')
			.style('font-size', '12px')
			.style('visibility', 'hidden');
		
		cellGroups.on('mouseover', function(event: MouseEvent, d: CellDatum) {
			if (d.date) {
				tooltip.style('visibility', 'visible')
					.text(tooltipFormatter(d.date));
			}
		}).on('mousemove', function(event: MouseEvent) {
			tooltip.style('top', (event.pageY - 10) + 'px')
				.style('left', (event.pageX + 10) + 'px');
		}).on('mouseout', function() {
			tooltip.style('visibility', 'hidden');
		});
	}
</script>

<div bind:this={container} class="container"></div>

<style>
	.container {
		width: 100%;
		height: auto;
	}
</style>