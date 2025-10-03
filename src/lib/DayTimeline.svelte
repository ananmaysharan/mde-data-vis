<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import dataUrl from '$lib/assets/hour_level_summary.csv?url';

  let { startDate, endDate, showDates = false } = $props<{ startDate: Date; endDate: Date; showDates?: boolean }>();

  const HUMAN_COLS = ['sonar', 'ships', 'explosions'] as const;
  type HumanColumn = (typeof HUMAN_COLS)[number];
  const METRIC_COLUMNS = ['bluewhale', 'humpbackwhale', 'finwhale', 'bocaccio', 'dolphins', ...HUMAN_COLS] as const;
  type MetricColumn = (typeof METRIC_COLUMNS)[number];

  const HOURS_PER_DAY = 24;
  const TIMELINE_MARGIN_LEFT = 16;
  const TIMELINE_MARGIN_RIGHT = 16;
  const COLUMN_WIDTH = 26;
  const COLUMN_GAP = 10;
  const TIMELINE_CONTENT_WIDTH =
    HOURS_PER_DAY * COLUMN_WIDTH + (HOURS_PER_DAY - 1) * COLUMN_GAP;
  const VIEWBOX_WIDTH = TIMELINE_CONTENT_WIDTH + TIMELINE_MARGIN_LEFT + TIMELINE_MARGIN_RIGHT;
  const VIEWBOX_HEIGHT = 150;
  let compressionOffset = $derived(showDates ? 0 : 5);
  let viewBoxHeight = $derived(VIEWBOX_HEIGHT - compressionOffset);
  const HOUR_CENTER_OFFSET = COLUMN_WIDTH / 2;
  const BAR_WIDTH = TIMELINE_CONTENT_WIDTH;

  const BAR_GAP = 5;
  const circleRadius = COLUMN_WIDTH * 0.45;
  const circleDiameter = circleRadius * 2;
    const BAR_HEIGHT = circleRadius;
  const HUMAN_ROW_Y = 22;
  const BLUE_ROW_Y = HUMAN_ROW_Y + circleDiameter + 6;
  const BOCCACCIO_ROW_Y = BLUE_ROW_Y + circleDiameter + 6;
  const DOLPHIN_ROW_Y = BOCCACCIO_ROW_Y + circleDiameter + 6;
  const HUMPBACK_BAR_Y = DOLPHIN_ROW_Y + circleRadius + 4;
  const FIN_BAR_Y = HUMPBACK_BAR_Y + BAR_HEIGHT + BAR_GAP;
  const PILL_VERTICAL_PADDING = circleRadius * 0.28;
  const PILL_WIDTH = 5;
  const PILL_HEIGHT = BLUE_ROW_Y - HUMAN_ROW_Y + circleDiameter + PILL_VERTICAL_PADDING * 2;
  const PILL_Y_OFFSET = HUMAN_ROW_Y - circleRadius - PILL_VERTICAL_PADDING;
  const PILL_CORNER_RADIUS = circleRadius + PILL_VERTICAL_PADDING;

  const ROWS = [
    { key: 'human', y: HUMAN_ROW_Y },
    { key: 'blue', y: BLUE_ROW_Y },
    { key: 'bocaccio', y: BOCCACCIO_ROW_Y },
    { key: 'dolphins', y: DOLPHIN_ROW_Y }
  ];

  type ValueStatus = 'missing' | 'zero' | 'detect';
  type SeriesStatus = ValueStatus;

  interface DataEntry {
    date: Date;
    values: Record<MetricColumn, number | null>;
  }

  interface HourDatum {
    hour: number;
    blue: ValueStatus;
    human: ValueStatus;
    bocaccio: ValueStatus;
    dolphins: ValueStatus;
  }

  interface DayDatum {
    date: Date;
    dayLabel: string;
    dayNumber: string;
    humpback: SeriesStatus;
    fin: SeriesStatus;
    hours: HourDatum[];
    pills: PillDatum[];
  }

  interface MonthGroup {
    key: string;
    label: string;
    days: DayDatum[];
  }

  interface PillDatum {
    hour: number;
  }

  let isLoaded = $state(false);
  let hasData = $state(false);
  let rawRows = $state<DataEntry[]>([]);
  let months = $state<MonthGroup[]>([]);

  const monthLabelFormatter = d3.utcFormat('%B %Y');
  const dayLabelFormatter = d3.utcFormat('%b %d');
  const formatDayNumber = (date: Date) => String(date.getUTCDate());
  const isoDayFormatter = d3.utcFormat('%Y-%m-%d');

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
      months = [];
      hasData = false;
      return;
    }

    const rangeRows = rawRows.filter((entry) => entry.date >= startDate && entry.date <= endDate);
    const nextMonths = buildMonths(rangeRows, startDate, endDate);
    months = nextMonths;
    hasData = nextMonths.some((month) => month.days.some((day) => hasDayData(day)));
  });

  function parseRow(row: Record<string, string | undefined>): DataEntry | null {
    const rawDate = row.time ?? row['time '];
    const date = new Date(rawDate ?? '');
    if (Number.isNaN(date.getTime())) return null;

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

  function buildMonths(rows: DataEntry[], start: Date, end: Date) {
    const rowsByDay = groupRowsByDay(rows);
    const monthsMap = new Map<string, MonthGroup>();

    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    while (cursor <= endCursor) {
      const monthKey = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, {
          key: monthKey,
          label: monthLabelFormatter(cursor),
          days: []
        });
      }

      const dayKey = isoDayFormatter(cursor);
      const dayRows = rowsByDay.get(dayKey) ?? [];
      const dayDatum = buildDay(cursor, dayRows);
      const month = monthsMap.get(monthKey)!;
      month.days.push(dayDatum);

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return Array.from(monthsMap.values());
  }

  function groupRowsByDay(rows: DataEntry[]) {
    const map = new Map<string, DataEntry[]>();
    for (const row of rows) {
      const key = isoDayFormatter(row.date);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    }
    return map;
  }

  function buildDay(date: Date, rows: DataEntry[]): DayDatum {
    const hourMap = new Map<number, DataEntry>();
    for (const row of rows) {
      hourMap.set(row.date.getUTCHours(), row);
    }

    const hours: HourDatum[] = Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
      const entry = hourMap.get(hour);
      return {
        hour,
        blue: getValueStatus(entry?.values.bluewhale),
        human: getHumanHourStatus(entry),
        bocaccio: getValueStatus(entry?.values.bocaccio),
        dolphins: getValueStatus(entry?.values.dolphins)
      };
    });

    return {
      date: new Date(date),
      dayLabel: dayLabelFormatter(date),
      dayNumber: formatDayNumber(date),
      humpback: getSeriesStatus(rows, 'humpbackwhale'),
      fin: getSeriesStatus(rows, 'finwhale'),
      hours,
      pills: buildPills(hours)
    };
  }

  function getValueStatus(value: number | null | undefined): ValueStatus {
    if (value === null || value === undefined) return 'missing';
    if (value > 0) return 'detect';
    return 'zero';
  }

  function getHumanHourStatus(entry: DataEntry | undefined): ValueStatus {
    if (!entry) return 'missing';
    const values = HUMAN_COLS.map((col) => entry.values[col]);
    const hasData = values.some((value) => value !== null);
    if (!hasData) return 'missing';
    const hasDetect = values.some((value) => (value ?? 0) > 0);
    return hasDetect ? 'detect' : 'zero';
  }

  function getSeriesStatus(rows: DataEntry[], column: MetricColumn): SeriesStatus {
    const values = rows.map((row) => row.values[column]).filter((value) => value !== null);
    if (values.length === 0) return 'missing';
    return values.some((value) => (value ?? 0) > 0) ? 'detect' : 'zero';
  }

  function buildPills(hours: HourDatum[]): PillDatum[] {
    return hours
      .filter((hour) => hour.human === 'detect' && (hour.blue === 'detect' || hour.bocaccio === 'detect' || hour.dolphins === 'detect'))
      .map((hour) => ({ hour: hour.hour }));
  }

  function hasDayData(day: DayDatum): boolean {
    return day.hours.some((hour) => hour.blue !== 'missing' || hour.human !== 'missing' || hour.bocaccio !== 'missing' || hour.dolphins !== 'missing') || day.humpback !== 'missing' || day.fin !== 'missing';
  }

  function hourToX(hour: number) {
    return TIMELINE_MARGIN_LEFT + hour * (COLUMN_WIDTH + COLUMN_GAP) + HOUR_CENTER_OFFSET;
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
  const bocaccioColor = '#E5AA00';
  const dolphinColor = '#64B3B7';
  const pillColor = '#444';
  const circleStrokeColor = '#CBD5E1';
  const pillFillColor = '#222';
  const pillBorderColor = '#222';
  const humpbackZeroFill = lightenColor(humpbackColor, 0.55);
  const humpbackZeroStroke = lightenColor(humpbackColor, 0.35);
  const finZeroFill = lightenColor(finColor, 0.6);
  const finZeroStroke = lightenColor(finColor, 0.4);
</script>

<div
  class="timeline"
  style={`--color-humpback:${humpbackColor};--color-fin:${finColor};--color-blue:${blueColor};--color-human:${humanColor};--color-bocaccio:${bocaccioColor};--color-dolphin:${dolphinColor};--circle-stroke:${circleStrokeColor};--pill-fill:${pillFillColor};--pill-border:${pillBorderColor};--color-humpback-zero-fill:${humpbackZeroFill};--color-humpback-zero-stroke:${humpbackZeroStroke};--color-fin-zero-fill:${finZeroFill};--color-fin-zero-stroke:${finZeroStroke};`}
>
  {#if isLoaded && !hasData}
    <p class="empty">No detections found in this period.</p>
  {/if}

  {#if months.length}
    <div class="legend">
      <div class="legend-item">
        <span class="swatch" style={`background:${humpbackColor}`}></span>
        <span>Humpback whale</span>
      </div>
      <div class="legend-item">
        <span class="swatch" style={`background:${finColor}`}></span>
        <span>Fin whale</span>
      </div>
      <div class="legend-item">
        <span class="circle blue detect"></span>
        <span>Blue whale hourly detection</span>
      </div>
      <div class="legend-item">
        <span class="circle human detect"></span>
        <span>Human noise hourly detection</span>
      </div>
      <div class="legend-item">
        <span class="circle bocaccio detect"></span>
        <span>Bocaccio hourly detection</span>
      </div>
      <div class="legend-item">
        <span class="circle dolphin detect"></span>
        <span>Dolphin hourly detection</span>
      </div>
      <div class="legend-item">
        <span class="pill-label">H+A</span>
        <span>Human + animal concurrent</span>
      </div>
    </div>

    {#each months as month}
      <section class="month">
        <h3>{month.label}</h3>
        <div class="month-grid">
          {#each month.days as day}
            <div class={`day ${hasDayData(day) ? '' : 'empty-day'}`}>
              <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${viewBoxHeight}`}
                role="img"
                aria-label={`Timeline for ${day.dayLabel}`}
              >
                {#if day.humpback !== 'missing'}
                  <rect
                    x={TIMELINE_MARGIN_LEFT}
                    y={HUMPBACK_BAR_Y - compressionOffset}
                    width={BAR_WIDTH}
                    height={BAR_HEIGHT}
                    rx={BAR_HEIGHT / 2}
                    class={`bar humpback ${day.humpback}`}
                  />
                {/if}
                {#if day.fin !== 'missing'}
                  <rect
                    x={TIMELINE_MARGIN_LEFT}
                    y={FIN_BAR_Y - compressionOffset}
                    width={BAR_WIDTH}
                    height={BAR_HEIGHT}
                    rx={BAR_HEIGHT / 2}
                    class={`bar fin ${day.fin}`}
                  />
                {/if}

                {#each day.hours as hour}
                  <circle
                    cx={hourToX(hour.hour)}
                    cy={HUMAN_ROW_Y - compressionOffset}
                    r={circleRadius}
                    class={`circle human ${hour.human}`}
                  />
                  <circle
                    cx={hourToX(hour.hour)}
                    cy={BLUE_ROW_Y - compressionOffset}
                    r={circleRadius}
                    class={`circle blue ${hour.blue}`}
                  />
                  <circle
                    cx={hourToX(hour.hour)}
                    cy={BOCCACCIO_ROW_Y - compressionOffset}
                    r={circleRadius}
                    class={`circle bocaccio ${hour.bocaccio}`}
                  />
                  <circle
                    cx={hourToX(hour.hour)}
                    cy={DOLPHIN_ROW_Y - compressionOffset}
                    r={circleRadius}
                    class={`circle dolphin ${hour.dolphins}`}
                  />
                {/each}

                {#each day.pills as pill}
                  {@const hourData = day.hours.find(h => h.hour === pill.hour)}
                  {@const activeRows = ROWS.filter(row => hourData?.[row.key as keyof HourDatum] === 'detect')}
                  {@const minY = Math.min(...activeRows.map(r => r.y))}
                  {@const maxY = Math.max(...activeRows.map(r => r.y))}
                  {@const pillY = minY - circleRadius - PILL_VERTICAL_PADDING - compressionOffset}
                  {@const pillHeight = maxY - minY + circleDiameter + 2 * PILL_VERTICAL_PADDING}
                  <line
                    x1={hourToX(pill.hour)}
                    y1={pillY}
                    x2={hourToX(pill.hour)}
                    y2={pillY + pillHeight}
                    stroke={pillColor}
                    stroke-width={PILL_WIDTH}
                    stroke-linecap="round"
                    class="pill"
                  />
                {/each}
              </svg>
              {#if showDates}
                <span class="day-number">{day.dayNumber}</span>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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
    width: 1rem;
    height: 0.75rem;
    border-radius: 999px;
    display: inline-block;
  }

  .legend .circle {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 999px;
    border: 2px solid currentColor;
  }

  .legend .circle.blue {
    color: var(--color-blue);
  }

  .legend .circle.human {
    color: var(--color-human);
  }

  .legend .circle.bocaccio {
    color: var(--color-bocaccio);
  }

  .legend .circle.dolphin {
    color: var(--color-dolphin);
  }

  .legend .circle.detect {
    background: currentColor;
  }

  .pill-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--pill-fill);
    border: 1px solid var(--pill-border);
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
  }

  .month {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .month h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    gap: 0.75rem;
  }

  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  .day.empty-day svg {
    opacity: 0.4;
  }

  .day-number {
    font-size: 0.82rem;
    font-weight: 500;
    color: #1f2937;
  }

  svg {
    width: 100%;
    height: auto;
    display: block;
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

  .circle.human.detect {
    fill: var(--color-human);
    stroke: var(--color-human);
  }

  .circle.blue.detect {
    fill: var(--color-blue);
    stroke: var(--color-blue);
  }

  .circle.bocaccio.detect {
    fill: var(--color-bocaccio);
    stroke: var(--color-bocaccio);
  }

  .circle.dolphin.detect {
    fill: var(--color-dolphin);
    stroke: var(--color-dolphin);
  }

  .circle.missing {
    stroke: none;
    fill: none;
  }

  .pill rect {
    stroke: var(--pill-border);
    stroke-width: 1;
  }

  .empty {
    font-size: 0.95rem;
    color: #64748b;
  }
</style>
