<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import dataUrl from '$lib/assets/day_level_summary.csv?url';

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

	type Matrix = MatrixCell[][][][]; // month -> week -> category -> day

	interface CellDatum extends MatrixCell {
		weekIndex: number;
		categoryIndex: number;
		dayIndex: number;
		categoryMeta: CategoryMeta;
	}

	interface MonthDatum {
		monthIndex: number;
		label: string;
		year: number;
		month: number;
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
	const WEEKS_PER_MONTH = 4;
	const DAYS_PER_WEEK = 7;
	const CATEGORY_COUNT = CATEGORY_META.length;
	const CELL_SIZE = 18;
	const CELL_PADDING = 2;
	const CELL_DRAW = CELL_SIZE - CELL_PADDING;
	const PLOT_MARGIN = { top: 40, right: 28, bottom: 32, left: 80 };
	const LEGEND_BLOCK_HEIGHT = 64;
	const ZERO_STROKE = '#ddd';
	const monthFormatter = d3.utcFormat('%b');
	const tooltipFormatter = d3.utcFormat('%b %d, %Y');
	const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
			months.push({
				monthIndex,
				label: monthFormatter(current),
				year: current.getUTCFullYear(),
				month: current.getUTCMonth(),
				cells: createEmptyCells()
			});
			current.setUTCMonth(current.getUTCMonth() + 1);
			monthIndex++;
		}
		return months;
	}

	function createEmptyCells(): CellDatum[] {
		const cells: CellDatum[] = [];
		for (let week = 0; week < WEEKS_PER_MONTH; week += 1) {
			for (let category = 0; category < CATEGORY_COUNT; category += 1) {
				for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
					cells.push({
						status: 'null',
						date: null,
						weekIndex: week,
						categoryIndex: category,
						dayIndex: day,
						categoryMeta: CATEGORY_META[category]
					});
				}
			}
		}
		return cells;
	}

	function buildDateRangeGrid(rows: DataEntry[], startDate: Date, endDate: Date): MonthDatum[] {
		const monthsMap = new Map<string, { year: number; month: number; monthIndex: number; entries: DataEntry[] }>();
		let globalMonthIndex = 0;
		
		// Create month buckets
		const current = new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
		const end = new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1);
		
		while (current <= end) {
			const key = `${current.getUTCFullYear()}-${current.getUTCMonth()}`;
			monthsMap.set(key, {
				year: current.getUTCFullYear(),
				month: current.getUTCMonth(),
				monthIndex: globalMonthIndex++,
				entries: []
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
			const matrix = createMatrix();
			
			for (const entry of monthData.entries) {
				const weekIndex = Math.min(3, Math.floor((entry.date.getUTCDate() - 1) / 7));
				const dayIndex = (entry.date.getUTCDay() + 6) % 7;

				const humanValues = HUMAN_COLS.map((column) => entry.values[column]);
				const humanNull = humanValues.every((value) => value === null);
				if (!humanNull) {
					const humanDetected = humanValues.some((value) => (value ?? 0) > 0);
					setCell(matrix, 0, weekIndex, 'human', dayIndex, humanDetected ? 'detect' : 'zero', entry.date);
				}

				for (const column of ANIMAL_COLS) {
					const value = entry.values[column];
					if (value === null) continue;
					setCell(matrix, 0, weekIndex, column, dayIndex, value > 0 ? 'detect' : 'zero', entry.date);
				}
			}
			
			return {
				monthIndex: monthData.monthIndex,
				label: monthFormatter(new Date(Date.UTC(monthData.year, monthData.month, 1))),
				year: monthData.year,
				month: monthData.month,
				cells: flattenWeeks(matrix[0])
			};
		});
	}

		function createMatrix(): Matrix {
			return [
				Array.from({ length: WEEKS_PER_MONTH }, () =>
					Array.from({ length: CATEGORY_COUNT }, () =>
						Array.from({ length: DAYS_PER_WEEK }, () => ({ status: 'null', date: null }))
					)
				)
			];
		}

		function setCell(
			matrix: Matrix,
			monthIndex: number,
			weekIndex: number,
			categoryKey: CategoryKey,
			dayIndex: number,
			status: CellStatus,
			date: Date
		): void {
			const categoryIndex = CATEGORY_INDEX.get(categoryKey);
			if (categoryIndex === undefined) return;
			const cell = matrix[0]?.[weekIndex]?.[categoryIndex]?.[dayIndex];
			if (!cell) return;
			cell.status = status;
			cell.date = date;
		}

		function flattenWeeks(weeks: Matrix[0]): CellDatum[] {
			const cells: CellDatum[] = [];
			for (let week = 0; week < WEEKS_PER_MONTH; week += 1) {
				for (let category = 0; category < CATEGORY_COUNT; category += 1) {
					for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
						const cell = weeks[week][category][day];
						cells.push({
							...cell,
							weekIndex: week,
							categoryIndex: category,
							dayIndex: day,
							categoryMeta: CATEGORY_META[category]
						});
					}
				}
			}
			return cells;
		}

	type DayLabel = { label: string; index: number };

	function render(dataset: MonthDatum[]): void {
		if (dataset.length === 0) return;
		
		// Calculate responsive layout with year breaks
		const baseMonthsPerRow = 6;
		const effectiveWidth = Math.max(containerWidth, 400);
		const maxMonthsPerRow = Math.max(1, Math.min(baseMonthsPerRow, Math.floor(baseMonthsPerRow * (effectiveWidth / 1200))));
		
		// Group months by rows, forcing new years to start new rows
		const monthRows: MonthDatum[][] = [];
		let currentRow: MonthDatum[] = [];
		let currentYear = dataset[0]?.year;
		
		for (const month of dataset) {
			// Start new row if year changes or current row is full
			if (month.year !== currentYear || currentRow.length >= maxMonthsPerRow) {
				if (currentRow.length > 0) {
					monthRows.push(currentRow);
					currentRow = [];
				}
				currentYear = month.year;
			}
			currentRow.push(month);
		}
		
		// Add the last row
		if (currentRow.length > 0) {
			monthRows.push(currentRow);
		}
		
		// Reassign monthIndex based on new layout
		let globalIndex = 0;
		for (const row of monthRows) {
			for (const month of row) {
				month.monthIndex = globalIndex++;
			}
		}
		
		const maxMonthsInRow = Math.max(...monthRows.map(row => row.length));
		const rows = monthRows.length;
		
		// Layout constants
		const monthInnerWidth = WEEKS_PER_MONTH * CATEGORY_COUNT * CELL_SIZE;
		const monthSpacing = 16; // Gap between months
		const rowSpacing = 32; // Gap between rows
		const yearLabelWidth = 60; // Space for year labels
		
		const plotWidth = maxMonthsInRow * monthInnerWidth + (maxMonthsInRow - 1) * monthSpacing;
		const plotHeight = DAYS_PER_WEEK * CELL_SIZE;
		const totalWidth = plotWidth + PLOT_MARGIN.left + PLOT_MARGIN.right + yearLabelWidth;
		const totalHeight = PLOT_MARGIN.top + LEGEND_BLOCK_HEIGHT + 20 + 
			rows * (plotHeight + rowSpacing) + PLOT_MARGIN.bottom;
		
		const chartRoot = container;
		if (!chartRoot) return;

		const svg = d3
			.select(chartRoot)
			.selectAll('svg')
			.data([null])
			.join('svg')
			.attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
			.attr('preserveAspectRatio', 'xMidYMid meet')
			.style('width', '100%')
			.style('height', 'auto')
			.style('display', 'block')
			.attr('role', 'img')
			.attr('aria-label', `Daily sound detections from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

		// Legend at the top
		const legendGroup = svg
			.selectAll('g.legend')
			.data([null])
			.join('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${PLOT_MARGIN.left + yearLabelWidth}, ${PLOT_MARGIN.top})`);

		const legendItemsSelection = legendGroup
			.selectAll('g.legend-item')
			.data(CATEGORY_META);

		legendItemsSelection.exit().remove();

		const legendItemsEnter = legendItemsSelection.enter().append('g').attr('class', 'legend-item');
		legendItemsEnter.append('rect').attr('rx', 3).attr('ry', 3);
		legendItemsEnter.append('text').attr('dominant-baseline', 'middle').attr('font-size', 12);

		const legendItems = legendItemsEnter.merge(legendItemsSelection);
		legendItems.attr('transform', (_: CategoryMeta, index: number) => `translate(${index * 180}, 0)`);

		legendItems
			.select('rect')
			.attr('width', 20)
			.attr('height', 20)
			.attr('fill', (d: CategoryMeta) => d.color)
			.attr('opacity', 0.9);

		legendItems
			.select('text')
			.attr('x', 26)
			.attr('y', 9)
			.text((d: CategoryMeta) => d.label);

		// legendGroup
		// 	.selectAll('text.legend-note')
		// 	.data(['Outlined squares represent days with no detections; blank squares indicate missing data.'])
		// 	.join('text')
		// 	.attr('class', 'legend-note')
		// 	.attr('x', 0)
		// 	.attr('y', 32)
		// 	.attr('font-size', 11)
		// 	.attr('fill', '#64748B')
		// 	.text((d: string) => d);

		// Main plot area
		const plotAreaY = PLOT_MARGIN.top + LEGEND_BLOCK_HEIGHT + 20;
		
		// Create month groups with hover areas
		const monthGroups = svg
			.selectAll('g.month-group')
			.data(dataset, (d: MonthDatum) => `${d.year}-${d.month}`);
		
		monthGroups.exit().remove();
		
		const monthGroupsEnter = monthGroups
			.enter()
			.append('g')
			.attr('class', 'month-group');
		
		// Add hover background for each month
		monthGroupsEnter
			.append('rect')
			.attr('class', 'month-hover')
			.attr('fill', 'transparent')
			.attr('stroke', 'none')
			.style('cursor', 'pointer')
			.on('mouseenter', function(this: SVGRectElement) {
				d3.select(this).attr('fill', '#eee');
			})
			.on('mouseleave', function(this: SVGRectElement) {
				d3.select(this).attr('fill', 'transparent');
			});
		
		const allMonthGroups = monthGroupsEnter.merge(monthGroups);
		
		// Position month groups based on their row and column
		allMonthGroups.attr('transform', (d: MonthDatum) => {
			let rowIndex = -1;
			let colIndex = -1;
			
			// Find which row and column this month is in
			for (let r = 0; r < monthRows.length; r++) {
				const col = monthRows[r].findIndex(m => m.year === d.year && m.month === d.month);
				if (col !== -1) {
					rowIndex = r;
					colIndex = col;
					break;
				}
			}
			
			const x = PLOT_MARGIN.left + yearLabelWidth + colIndex * (monthInnerWidth + monthSpacing);
			const y = plotAreaY + rowIndex * (plotHeight + rowSpacing);
			return `translate(${x}, ${y})`;
		});
		
		// Update hover areas with padding and extend to include month labels
		const hoverPadding = 6;
		const monthLabelHeight = 20; // Height for month label area
		allMonthGroups.select('.month-hover')
			.attr('x', -hoverPadding)
			.attr('y', -hoverPadding)
			.attr('width', monthInnerWidth + 2 * hoverPadding)
			.attr('height', plotHeight + monthLabelHeight + 2 * hoverPadding)
			.attr('rx', 6);
		
		// Create cells for each month
		const cellsInMonths = allMonthGroups
			.selectAll('rect.cell')
			.data((d: MonthDatum) => d.cells, (cell: CellDatum) => `${cell.weekIndex}-${cell.categoryIndex}-${cell.dayIndex}`);
		
		cellsInMonths.exit().remove();
		
		const cellsEnter = cellsInMonths
			.enter()
			.append('rect')
			.attr('class', 'cell')
			.attr('rx', 2)
			.attr('ry', 2);
		
		cellsEnter.append('title');
		
		const allCells = cellsEnter.merge(cellsInMonths);
		
		allCells
			.attr('width', CELL_DRAW)
			.attr('height', CELL_DRAW)
			.attr('x', (d: CellDatum) => 
				d.weekIndex * CATEGORY_COUNT * CELL_SIZE + 
				d.categoryIndex * CELL_SIZE + 
				CELL_PADDING / 2
			)
			.attr('y', (d: CellDatum) => d.dayIndex * CELL_SIZE + CELL_PADDING / 2)
			.attr('fill', (d: CellDatum) => (d.status === 'detect' ? d.categoryMeta.color : 'transparent'))
			.attr('fill-opacity', (d: CellDatum) => (d.status === 'detect' ? 0.9 : 1))
			.attr('stroke', (d: CellDatum) => {
				if (d.status === 'detect') return 'none';
				if (d.status === 'zero') return ZERO_STROKE;
				return 'none';
			})
			.attr('stroke-width', (d: CellDatum) => (d.status === 'zero' ? 1 : 0))
			.style('cursor', 'pointer')
			.on('mouseenter', function(this: SVGRectElement) {
				// Find the parent month group and trigger its hover
				const monthGroup = d3.select(this.parentNode);
				monthGroup.select('.month-hover').attr('fill', '#f1f5f9');
			})
			.on('mouseleave', function(this: SVGRectElement) {
				// Find the parent month group and remove its hover
				const monthGroup = d3.select(this.parentNode);
				monthGroup.select('.month-hover').attr('fill', 'transparent');
			});
		
		allCells.select('title').text((d: CellDatum) => buildTooltip(d));
		
		// Add month labels
		allMonthGroups
			.selectAll('text.month-label')
			.data((d: MonthDatum) => [d])
			.join('text')
			.attr('class', 'month-label')
			.attr('x', monthInnerWidth / 2)
			.attr('y', plotHeight + 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
			.attr('font-weight', 500)
			.attr('fill', '#1f2937')
			.style('cursor', 'pointer')
			.text((d: MonthDatum) => d.label)
			.on('mouseenter', function(this: SVGTextElement) {
				// Find the parent month group and trigger its hover
				const monthGroup = d3.select(this.parentNode);
				monthGroup.select('.month-hover').attr('fill', '#f1f5f9');
			})
			.on('mouseleave', function(this: SVGTextElement) {
				// Find the parent month group and remove its hover
				const monthGroup = d3.select(this.parentNode);
				monthGroup.select('.month-hover').attr('fill', 'transparent');
			});
		
		// Add day labels (only for the first month in each row)
		const dayLabelsData = monthRows.map((row, rowIndex) => ({ row, rowIndex }));
		
		const dayLabelGroups = svg
			.selectAll('g.day-labels-row')
			.data(dayLabelsData, (d: { row: MonthDatum[], rowIndex: number }) => d.rowIndex);
		
		dayLabelGroups.exit().remove();
		
		const dayLabelGroupsEnter = dayLabelGroups
			.enter()
			.append('g')
			.attr('class', 'day-labels-row');
		
		const allDayLabelGroups = dayLabelGroupsEnter.merge(dayLabelGroups);
		
		allDayLabelGroups.attr('transform', (d: { row: MonthDatum[], rowIndex: number }) => {
			const y = plotAreaY + d.rowIndex * (plotHeight + rowSpacing);
			return `translate(0, ${y})`;
		});
		
		const dayLabelData = DAY_LABELS.map((label, index) => ({ label, index }));
		
		allDayLabelGroups
			.selectAll('text.day-label')
			.data(dayLabelData)
			.join('text')
			.attr('class', 'day-label')
			.attr('x', PLOT_MARGIN.left + yearLabelWidth - 12)
			.attr('y', (d: { label: string, index: number }) => d.index * CELL_SIZE + CELL_SIZE / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', 11)
			.attr('fill', '#475569')
			.text((d: { label: string, index: number }) => d.label);
		
		// Add year labels (only when year changes from previous row)
		const yearLabelsData: { year: number, rowIndex: number }[] = [];
		monthRows.forEach((row, rowIndex) => {
			const firstMonth = row[0];
			if (firstMonth) {
				// Show year label only at start or when year changes from previous row
				if (rowIndex === 0 || (rowIndex > 0 && monthRows[rowIndex - 1][0].year !== firstMonth.year)) {
					yearLabelsData.push({ year: firstMonth.year, rowIndex });
				}
			}
		});
		
		const yearLabels = svg
			.selectAll('text.year-label')
			.data(yearLabelsData, (d: { year: number, rowIndex: number }) => `${d.year}-${d.rowIndex}`);
		
		yearLabels.exit().remove();
		
		yearLabels
			.enter()
			.append('text')
			.attr('class', 'year-label')
			.merge(yearLabels)
			.attr('x', PLOT_MARGIN.left + yearLabelWidth - 70)
			.attr('y', (d: { year: number, rowIndex: number }) => {
				const y = plotAreaY + d.rowIndex * (plotHeight + rowSpacing);
				return y + plotHeight / 2;
			})
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', 14)
			.attr('font-weight', 600)
			.attr('fill', '#1f2937')
			.text((d: { year: number, rowIndex: number }) => d.year);
	}

	function buildTooltip(cell: CellDatum): string {
		const category = cell.categoryMeta.label;
		if (!cell.date) return `${category}: no data`;
		const date = tooltipFormatter(cell.date);
		if (cell.status === 'detect') return `${category}: detection on ${date}`;
		if (cell.status === 'zero') return `${category}: no detection on ${date}`;
		return `${category}: no data`;
	}
</script>

<section class="squares-wrapper">
	<!-- <header class="squares-header">
		<h2>{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</h2>
	</header> -->
	{#if months.length}
		{#if hasData}
			{#if !hasDetections}
				<p class="empty-hint">No detections recorded for this date range in the selected categories.</p>
			{/if}
		{:else}
			<p class="empty-hint">No monitoring data is available for this date range.</p>
		{/if}
	{/if}
	<div class="chart" bind:this={container} aria-hidden={!months.length}></div>
</section>

<style>
.squares-wrapper {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.empty-hint {
	color: #475569;
	font-size: 0.9rem;
}

.chart {
	width: 100%;
	overflow-y: auto;
	/* max-height: 80vh; */
	border: 1px solid #ddd;
	border-radius: 8px;
	background: white;
}
</style>
