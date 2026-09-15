import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useInsights } from "@/lib/insights-store";
import type { ChartGraph } from "@/lib/insights-data";

const W = 300;
const H = 130;
const DAY = 86400;

export function buildTicks(from: number, to: number, interval: number) {
  const out: number[] = [];
  if (!(to > from) || !(interval > 0)) return [from, to];
  const step = Math.max(interval, (to - from) / 40);
  for (let v = from; v <= to + 1e-6; v += step) out.push(Math.round(v * 1000) / 1000);
  const last = out[out.length - 1]!;
  if (last < to - 1e-6) {
    if (to - last < step * 0.5) out[out.length - 1] = to;
    else out.push(to);
  }
  return out;
}

export const formatTime = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatDate = (epochSeconds: number) => {
  const d = new Date(Math.round(epochSeconds) * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(Math.round(n * 10) / 10);
};

export function formatX(v: number, g: ChartGraph) {
  if (g.xAxis.format === "time") return formatTime(v);
  if (g.xAxis.format === "date") return formatDate(v);
  return `${compact(v)}${g.xAxis.unit ?? ""}`;
}

export function formatY(v: number, g: ChartGraph) {
  return `${compact(v)}${g.yAxis.unit ?? ""}`;
}

const toDateInput = (s: number) => new Date(Math.round(s) * 1000).toISOString().slice(0, 10);
const fromDateInput = (v: string) => {
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) ? t / 1000 : NaN;
};

/* ---------- Custom SVG chart matching deployed site ---------- */

type SimpleChartProps = {
  points: number[];
  yMax: number;
  yTicks: string[];
  xLabels: string[];
  compare?: number[];
  baseline?: boolean;
  dots?: boolean;
  formatValue?: (v: number) => string;
  formatX?: (t: number) => string;
  height?: number;
  dateRange?: { start: string; end: string };
  onDateChange?: (start: string, end: string) => void;
};

function buildPath(points: number[], yMax: number, w = W, h = H) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M0,${h - (Math.max(0, Math.min(points[0], yMax)) / yMax) * h}`;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const pts = points.map((p, i) => ({
    x: i * step,
    y: h - (Math.max(0, Math.min(p, yMax)) / yMax) * h,
  }));

  let d = `M${pts[0]!.x.toFixed(2)},${pts[0]!.y.toFixed(2)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;

    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  return d;
}

function SimpleChart({
  points,
  yMax,
  yTicks,
  xLabels,
  compare,
  baseline = false,
  dots = false,
  formatValue = (v) => `${Math.round(v)}`,
  formatX,
  height = H,
  dateRange,
  onDateChange,
}: SimpleChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<"start" | "end" | null>(null);
  const { editMode } = useInsights();

  const step = points.length > 1 ? W / (points.length - 1) : 0;
  const yScale = (v: number) => height - (Math.max(0, Math.min(v, yMax)) / yMax) * height;

  const handlePointer = (clientX: number) => {
    const el = ref.current;
    if (!el || points.length < 2) return;
    const r = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setActive(Math.round(pct * (points.length - 1)));
  };

  const getXLabel = (pct: number) => {
    if (!formatX || !xLabels.length) return "";
    return formatX(pct);
  };

  const activeX = active === null ? 0 : active / Math.max(1, points.length - 1);
  const compareVal = compare && active !== null ? compare[Math.min(active, compare.length - 1)] : undefined;

  return (
    <div className="flex gap-2">
      <div
        className="flex w-9 shrink-0 flex-col justify-between py-[2px] text-right text-[11px] text-ig-dim"
        style={{ height }}
      >
        {yTicks.map((t, i) => (
          <span key={`${t}-${i}`}>{t}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={ref}
          className="relative touch-none select-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handlePointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handlePointer(e.clientX);
          }}
          onPointerUp={() => setActive(null)}
          onPointerCancel={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          {active !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-ig-chip px-3 py-2 text-center shadow-lg"
              style={{ left: `${Math.max(12, Math.min(88, activeX * 100))}%` }}
            >
              <span className="block text-[15px] font-bold leading-tight text-ig-text">
                {formatValue(points[active] ?? 0)}
              </span>
              {formatX && (
                <span className="block text-[12px] leading-tight text-ig-dim">
                  {getXLabel(activeX)}
                </span>
              )}
            </div>
          )}
          <svg
            viewBox={`0 0 ${W} ${height}`}
            className="h-[130px] w-full overflow-visible"
            preserveAspectRatio="none"
          >
            {yTicks.map((_, i) => (
              <line
                key={`grid-${i}`}
                x1="0"
                x2={W}
                y1={(i / (yTicks.length - 1)) * height}
                y2={(i / (yTicks.length - 1)) * height}
                stroke="#2a2a2a"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {compare && compare.length > 1 ? (
              <path
                d={buildPath(compare, yMax, W, height)}
                fill="none"
                stroke="#8e8e8e"
                strokeWidth="3"
                strokeDasharray="8 7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : baseline ? (
              <line
                x1="0"
                x2={W}
                y1={height - 2}
                y2={height - 2}
                stroke="#8e8e8e"
                strokeWidth="3"
                strokeDasharray="8 7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path
              d={buildPath(points, yMax, W, height)}
              fill="none"
              stroke="#d62ad0"
              strokeWidth="3.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {dots &&
              points.map((p, i) => (
                <circle
                  key={`dot-${i}`}
                  cx={i * step}
                  cy={yScale(p)}
                  r="2.4"
                  fill="#d62ad0"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {active !== null && (
              <>
                <line
                  x1={active * step}
                  x2={active * step}
                  y1={-6}
                  y2={height}
                  stroke="#9a9a9a"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
                {compareVal !== undefined && (
                  <circle
                    cx={active * step}
                    cy={yScale(compareVal)}
                    r="6"
                    fill="#c7c7c7"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </>
            )}
          </svg>
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-ig-dim">
          {xLabels.map((l, i) => {
            const dateKey = i === 0 ? "start" : "end";
            if (editMode && dateRange && onDateChange) {
              const isTime = /^\d+:\d{2}$/.test(String(dateRange[dateKey]));
              return (
                <input
                  key={`${l}-${i}`}
                  type={isTime ? "text" : "date"}
                  value={dateRange[dateKey]}
                  onChange={(e) => {
                    onDateChange(
                      dateKey === "start" ? e.target.value : dateRange.start,
                      dateKey === "end" ? e.target.value : dateRange.end,
                    );
                  }}
                  className="w-[90px] rounded-md border border-ig-line bg-ig-card px-1 py-0.5 text-[11px] text-ig-text outline-none focus:border-accent"
                />
              );
            }
            return <span key={`${l}-${i}`}>{l}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Edit mode chart ---------- */

type EditableChartProps = {
  graph: ChartGraph;
  onChange: (g: ChartGraph) => void;
  height?: number;
  dots?: boolean;
  fill?: boolean;
  ghost?: boolean;
};

export function EditableChart({
  graph,
  onChange,
  height = H,
  dots = true,
  fill = false,
  ghost = false,
}: EditableChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { editMode } = useInsights();
  const [active, setActive] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | "x" | "y" | "both">(null);

  const { xAxis, yAxis, points } = graph;
  const xTicks = buildTicks(xAxis.start, xAxis.end, xAxis.tickInterval);
  const yTicks = buildTicks(yAxis.min, yAxis.max, yAxis.tickInterval);

  const span = Math.max(1e-6, xAxis.end - xAxis.start);
  const range = Math.max(1e-6, yAxis.max - yAxis.min);
  const x = (t: number) => ((t - xAxis.start) / span) * W;
  const y = (v: number) =>
    height - ((Math.max(yAxis.min, Math.min(yAxis.max, v)) - yAxis.min) / range) * (height - 8) - 4;

  const sorted = [...points].sort((a, b) => a.time - b.time);
  const path = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.time)},${y(p.value)}`).join(" ");

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || points.length === 0) return;
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const py = ((clientY - r.top) / r.height) * height;
      let idx = 0;
      let best = Infinity;
      points.forEach((p, i) => {
        const d = Math.abs(x(p.time) - px);
        if (d < best) {
          best = d;
          idx = i;
        }
      });
      const v = yAxis.min + ((height - 4 - py) / (height - 8)) * range;
      setActive(idx);
      const decimals = range > 100 ? 1 : 10;
      const next = points.map((p, i) =>
        i === idx
          ? {
              ...p,
              value:
                Math.round(Math.max(yAxis.min, Math.min(yAxis.max, v)) * decimals) / decimals,
            }
          : p,
      );
      onChange({ ...graph, points: next });
    },
    [points, onChange, graph, yAxis.min, yAxis.max, range, height],
  );

  const tickClass = editMode
    ? "rounded-md outline outline-1 outline-accent/80 bg-accent/10 px-0.5 relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
    : "";

  return (
    <div className="mx-auto box-border w-full">
      <div className="flex gap-2 relative left-[-19px]">
        <div
          className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[11px] text-ig-dim"
          style={{ height }}
        >
          {[...yTicks].reverse().map((t, i) =>
            editMode ? (
              <button
                key={`y-${t}-${i}`}
                type="button"
                aria-label="Edit Y axis"
                onClick={() => setSheet("y")}
                className={`self-end text-[11px] text-ig-dim ${tickClass}`}
              >
                {formatY(t, graph)}
              </button>
            ) : (
              <span key={`y-${t}-${i}`}>{formatY(t, graph)}</span>
            ),
          )}
        </div>
        <div
          className={`min-w-0 flex-1 rounded-md ${editMode ? "outline outline-1 outline-accent/60" : ""}`}
          style={{ height }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            className={`h-full w-full ${editMode ? "touch-none" : ""}`}
            {...(editMode
              ? {
                  onPointerDown: (e: ReactPointerEvent) => {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    apply(e.clientX, e.clientY);
                  },
                  onPointerMove: (e: ReactPointerEvent) => {
                    if (e.buttons > 0) apply(e.clientX, e.clientY);
                  },
                  onPointerUp: () => setActive(null),
                }
              : {})}
          >
            {yTicks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={W}
                y1={y(t)}
                y2={y(t)}
                stroke="#2a2a2a"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {ghost && (
              <line
                x1={0}
                x2={W}
                y1={height - 2}
                y2={height - 2}
                stroke="#8e8e8e"
                strokeWidth={3}
                strokeDasharray="8 7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {fill && (
              <>
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d62ad0" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#d62ad0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${path} L${W},${height} L0,${height} Z`} fill="url(#chartFill)" opacity={0.35} />
              </>
            )}
            <path
              d={path}
              fill="none"
              stroke="#d62ad0"
              strokeWidth={3.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {(dots || editMode) &&
              sorted.map((p, i) => (
                <circle
                  key={i}
                  cx={x(p.time)}
                  cy={y(p.value)}
                  r={active === i ? 4 : 2.4}
                  fill="#d62ad0"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>
        </div>
      </div>

      <div className="mt-1 flex gap-2 relative left-[-19px]">
        <div className="w-12 shrink-0" />
        <div className="flex min-w-0 flex-1 justify-between text-[11px] text-ig-dim">
          {xTicks.map((t, i) =>
            editMode ? (
              <button
                key={`x-${t}-${i}`}
                type="button"
                aria-label="Edit X axis"
                onClick={() => setSheet("x")}
                className={`text-[11px] text-ig-dim ${tickClass}`}
              >
                {formatX(t, graph)}
              </button>
            ) : (
              <span key={`x-${t}-${i}`}>{formatX(t, graph)}</span>
            ),
          )}
        </div>
      </div>

      {editMode && (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-[11px] text-accent">Drag on the chart, or tap an axis label</p>
          <button
            type="button"
            onClick={() => setSheet("both")}
            className="ml-auto rounded-full border border-accent/60 px-3 py-1 text-[12px] text-accent"
          >
            Chart settings
          </button>
        </div>
      )}

      {sheet && (
        <ChartSettingsSheet
          graph={graph}
          onChange={onChange}
          axis={sheet}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/* ---------- SimpleChart for use in tabs ---------- */

export { SimpleChart };

/* ------------------------------ settings sheet ----------------------------- */

function Field({
  label,
  value,
  onCommit,
  type = "text",
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  type?: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-[11px] text-ig-dim">{label}</span>
      <input
        value={draft}
        type={type}
        inputMode={type === "text" ? "decimal" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim() === "" ? value : draft)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onCommit(draft.trim() === "" ? value : draft);
        }}
        className="w-full min-w-0 rounded-lg border border-ig-line bg-ig-card px-3 py-2 text-[15px] text-ig-text outline-none focus:border-accent"
      />
    </label>
  );
}

function ChartSettingsSheet({
  graph,
  onChange,
  axis,
  onClose,
}: {
  graph: ChartGraph;
  onChange: (g: ChartGraph) => void;
  axis: "x" | "y" | "both";
  onClose: () => void;
}) {
  const { xAxis, yAxis, points } = graph;
  const isDate = xAxis.format === "date";
  const xUnitScale = isDate ? DAY : 1;

  const setX = (patch: Partial<ChartGraph["xAxis"]>) => {
    const next = { ...xAxis, ...patch };
    if (!Number.isFinite(next.start)) return;
    if (!Number.isFinite(next.end) || next.end <= next.start) return;
    if (!Number.isFinite(next.tickInterval) || next.tickInterval <= 0) return;
    const span = Math.max(1e-6, xAxis.end - xAxis.start);
    const nextPoints = points.map((p) => ({
      ...p,
      time: next.start + ((p.time - xAxis.start) / span) * (next.end - next.start),
    }));
    onChange({ ...graph, xAxis: next, points: nextPoints });
  };

  const setY = (patch: Partial<ChartGraph["yAxis"]>) => {
    const next = { ...yAxis, ...patch };
    if (!Number.isFinite(next.min)) return;
    if (!Number.isFinite(next.max) || next.max <= next.min) return;
    if (!Number.isFinite(next.tickInterval) || next.tickInterval <= 0) return;
    const oldRange = Math.max(1e-6, yAxis.max - yAxis.min);
    const nextRange = next.max - next.min;
    const nextPoints = points.map((p) => ({
      ...p,
      value:
        Math.round((next.min + ((p.value - yAxis.min) / oldRange) * nextRange) * 10) / 10,
    }));
    onChange({ ...graph, yAxis: next, points: nextPoints });
  };

  const addPoint = () => {
    const sorted = [...points].sort((a, b) => a.time - b.time);
    const n = sorted.length + 1;
    onChange({
      ...graph,
      points: Array.from({ length: n }, (_, i) => ({
        time: xAxis.start + (i / (n - 1)) * (xAxis.end - xAxis.start),
        value: sorted[Math.min(i, sorted.length - 1)]?.value ?? yAxis.min,
      })),
    });
  };

  const removePoint = () => {
    if (points.length <= 2) return;
    const sorted = [...points].sort((a, b) => a.time - b.time).slice(0, -1);
    const n = sorted.length;
    onChange({
      ...graph,
      points: sorted.map((p, i) => ({
        ...p,
        time: xAxis.start + (i / (n - 1)) * (xAxis.end - xAxis.start),
      })),
    });
  };

  const resetCurve = () => {
    const n = points.length;
    onChange({
      ...graph,
      points: Array.from({ length: n }, (_, i) => ({
        time: xAxis.start + (i / (n - 1)) * (xAxis.end - xAxis.start),
        value: yAxis.min,
      })),
    });
  };

  const title = axis === "y" ? "Y-axis settings" : axis === "x" ? "X-axis settings" : "Chart settings";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
      <button
        type="button"
        aria-label="Close chart settings"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-ig-line bg-ig-card p-5 pb-8 shadow-sheet">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ig-track" />
        <p className="mb-3 text-sm font-medium text-ig-dim">{title}</p>

        {axis !== "y" && (
          <>
            <p className="mb-2 text-[13px] text-ig-text">
              X-axis ({isDate ? "dates" : xAxis.format === "time" ? "seconds" : "values"})
            </p>
            <div className="mb-3 flex gap-2">
              <Field
                label="Start"
                type={isDate ? "date" : "text"}
                value={isDate ? toDateInput(xAxis.start) : String(xAxis.start)}
                onCommit={(v) => setX({ start: isDate ? fromDateInput(v) : Number(v) })}
              />
              <Field
                label="End"
                type={isDate ? "date" : "text"}
                value={isDate ? toDateInput(xAxis.end) : String(xAxis.end)}
                onCommit={(v) => setX({ end: isDate ? fromDateInput(v) : Number(v) })}
              />
              <Field
                label={isDate ? "Every (days)" : "Tick interval"}
                value={String(xAxis.tickInterval / xUnitScale)}
                onCommit={(v) => setX({ tickInterval: Number(v) * xUnitScale })}
              />
            </div>
            <div className="mb-4 flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px] text-ig-dim">Format</span>
                <select
                  value={xAxis.format}
                  onChange={(e) =>
                    onChange({
                      ...graph,
                      xAxis: { ...xAxis, format: e.target.value as ChartGraph["xAxis"]["format"] },
                    })
                  }
                  className="w-full rounded-lg border border-ig-line bg-ig-card px-3 py-2 text-[15px] text-ig-text outline-none focus:border-accent"
                >
                  <option value="time">Time (m:ss)</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                </select>
              </label>
              <Field
                label="Unit"
                value={xAxis.unit ?? ""}
                onCommit={(v) => onChange({ ...graph, xAxis: { ...xAxis, unit: v } })}
              />
            </div>
          </>
        )}

        {axis !== "x" && (
          <>
            <p className="mb-2 text-[13px] text-ig-text">Y-axis</p>
            <div className="mb-3 flex gap-2">
              <Field label="Minimum" value={String(yAxis.min)} onCommit={(v) => setY({ min: Number(v) })} />
              <Field label="Maximum" value={String(yAxis.max)} onCommit={(v) => setY({ max: Number(v) })} />
              <Field
                label="Tick interval"
                value={String(yAxis.tickInterval)}
                onCommit={(v) => setY({ tickInterval: Number(v) })}
              />
            </div>
            <div className="mb-4 flex gap-2">
              <Field
                label="Unit"
                value={yAxis.unit ?? ""}
                onCommit={(v) => onChange({ ...graph, yAxis: { ...yAxis, unit: v } })}
              />
            </div>
          </>
        )}

        {axis === "both" && (
          <>
            <p className="mb-2 text-[13px] text-ig-text">Chart ({points.length} points)</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addPoint}
                className="min-h-11 flex-1 rounded-xl border border-ig-line text-sm text-ig-text"
              >
                Add point
              </button>
              <button
                type="button"
                onClick={removePoint}
                className="min-h-11 flex-1 rounded-xl border border-ig-line text-sm text-ig-text"
              >
                Remove point
              </button>
              <button
                type="button"
                onClick={resetCurve}
                className="min-h-11 flex-1 rounded-xl border border-ig-line text-sm text-ig-dim"
              >
                Reset
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-xl bg-ig-magenta font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
