import { ChevronRight, TrendingUp } from "lucide-react";
import { useInsights } from "@/lib/insights-store";
import { redistributePercentages } from "@/lib/utils";
import { Editable } from "./Editable";
import { SimpleChart } from "./EditableChart";
import { ReelPreview } from "./ReelPreview";
import { ImpactRow, ProgressRow, SectionTitle } from "./Rows";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(s: string): Date | null {
  const t = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(t) ? new Date(t) : null;
}

function interpolateDate(pct: number, startStr: string, endStr: string): string {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return "";
  const ms = start.getTime() + (end.getTime() - start.getTime()) * pct;
  const d = new Date(Math.round(ms));
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatRetention(pct: number, startLabel: string, endLabel: string): string {
  const parseTime = (s: string) => {
    const m = s.match(/^(\d+):(\d{1,2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };
  const startSec = parseTime(startLabel);
  const endSec = parseTime(endLabel);
  const secs = Math.round(startSec + (endSec - startSec) * pct);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(Math.round(n * 10) / 10);
};

function calcYAxis(viewsVal: string) {
  const num = Number(viewsVal.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(num) || num <= 0) {
    return { yMax: 6000, yTicks: ["6K", "3K", "0"] };
  }
  const mag = Math.pow(10, Math.floor(Math.log10(num)));
  const niceMax = Math.ceil(num / mag) * mag;
  const ticks = [niceMax, Math.round(niceMax / 2), 0].map(
    (v) => `${Math.round(v / 1000)}K`,
  );
  return { yMax: niceMax, yTicks: ticks };
}

export function OverviewTab() {
  const { data, update } = useInsights();
  const o = data.overview;

  const graph = o.viewsGraph;
  const points = graph.points.map((p) => p.value);

  const dr = o.viewsDateRange;
  const startD = parseDate(dr.start);
  const endD = parseDate(dr.end);
  const xLabels = startD && endD
    ? [`${MONTHS[startD.getMonth()]} ${startD.getDate()}`, `${MONTHS[(startD.getMonth() + 1) % 12]} ${(startD.getDate() + 2) % 28 + 1}`, `${MONTHS[endD.getMonth()]} ${endD.getDate()}`]
    : ["Sep 4", "Sep 5", "Sep 6"];

  const watchGraph = o.watchGraph;
  const watchPoints = watchGraph.points.map((p) => p.value);
  const wdr = o.watchDateRange;

  const { yMax, yTicks } = calcYAxis(o.stats.find((s) => s.id === "views")?.value ?? "0");

  return (
    <div>
      <SectionTitle title={o.summaryTitle} onChange={(v) => update((d) => { d.overview.summaryTitle = v; })} />

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {o.stats.map((s, i) => (
          <div key={s.id} className="rounded-2xl bg-ig-card px-4 py-3">
            <Editable value={s.label} onChange={(v) => update((d) => { d.overview.stats[i]!.label = v; })} label="Stat title">
              <span className="text-[12px] text-ig-dim">{s.label}</span>
            </Editable>
            <div className="mt-0.5">
              <Editable
                value={s.value}
                onChange={(v) => update((d) => { d.overview.stats[i]!.value = v; })}
                kind="number"
                label="Stat value"
              >
                <span className="text-[22px] font-bold leading-tight text-ig-text">{s.value || "—"}</span>
              </Editable>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle
        title={o.viewsOverTimeTitle}
        onChange={(v) => update((d) => { d.overview.viewsOverTimeTitle = v; })}
      />

      <div className="mb-5 flex gap-2">
        {o.filters.map((f, i) => (
          <Editable key={f + i} value={f} onChange={(v) => update((d) => { d.overview.filters[i] = v; })} label="Filter label">
            <span
              onClick={() => update((d) => { d.overview.activeFilter = i; })}
              className={`rounded-full px-4 py-[9px] text-[14px] ${
                o.activeFilter === i
                  ? "bg-ig-chip font-semibold text-ig-text"
                  : "border border-ig-line text-ig-text"
              }`}
            >
              {f}
            </span>
          </Editable>
        ))}
      </div>

      <SimpleChart
        points={points}
        yMax={yMax}
        yTicks={yTicks}
        xLabels={xLabels}
        compare={[
          0, 120, 180, 200, 210, 215, 218, 220, 222, 224, 226, 228, 230, 231, 232, 233,
          234, 235, 236, 236,
        ]}
        baseline
        formatValue={(v) => `${compact(v)}`}
        formatX={(pct) => interpolateDate(pct, dr.start, dr.end)}
        dateRange={dr}
        onDateChange={(start, end) => update((d) => { d.overview.viewsDateRange = { start, end }; })}
      />

      <div className="mt-4 flex items-center gap-5 text-[13px]">
        {o.legend.map((l, i) => (
          <span key={l + i} className={`flex items-center gap-2 ${i === 0 ? "text-ig-text" : "text-ig-text"}`}>
            <span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-ig-magenta" : "bg-ig-dim"}`} />
            <Editable value={l} onChange={(v) => update((d) => { d.overview.legend[i] = v; })} label="Legend label">
              <span>{l}</span>
            </Editable>
          </span>
        ))}
      </div>

      <SectionTitle
        title={o.impactTitle}
        onChange={(v) => update((d) => { d.overview.impactTitle = v; })}
        subtitle={o.impactSubtitle}
        onSubtitle={(v) => update((d) => { d.overview.impactSubtitle = v; })}
      />
      <div className="mt-3">
        {o.impactRows.map((r, i) => (
          <ImpactRow
            key={r.id}
            row={r}
            onLabel={(v) => update((d) => { d.overview.impactRows[i]!.label = v; })}
            onValue={(v) => update((d) => { d.overview.impactRows[i]!.value = v; })}
            onTrend={(v) => update((d) => { d.overview.impactRows[i]!.trend = v; })}
          />
        ))}
      </div>

      <SectionTitle title={o.watchTitle} onChange={(v) => update((d) => { d.overview.watchTitle = v; })} />
      <div className="flex justify-center pb-4">
        <ReelPreview size="sm" />
      </div>
      <SimpleChart
        points={watchPoints}
        yMax={100}
        yTicks={["100%", "50%", "0%"]}
        xLabels={[wdr.start, wdr.end]}
        formatValue={(v) => `${Math.round(v)}%`}
        formatX={(pct) => formatRetention(pct, wdr.start, wdr.end)}
        dateRange={wdr}
        onDateChange={(start, end) => update((d) => { d.overview.watchDateRange = { start, end }; })}
      />

      <SectionTitle title={o.sourcesTitle} onChange={(v) => update((d) => { d.overview.sourcesTitle = v; })} />
      <div className="mt-3">
        {o.sources.map((s, i) => (
          <ProgressRow
            key={s.id}
            name={s.name}
            percentage={s.percentage}
            onName={(v) => update((d) => { d.overview.sources[i]!.name = v; })}
            onPercentage={(v) => update((d) => { d.overview.sources = redistributePercentages(d.overview.sources, i, v); })}
          />
        ))}
      </div>

      <h2 className="pb-1 pt-7 text-[19px] font-bold text-ig-text">{o.adTitle}</h2>
      <div className="flex items-center gap-4 py-4">
        <TrendingUp className="h-6 w-6 shrink-0 text-ig-text" strokeWidth={1.8} />
        <Editable value={o.adCta} onChange={(v) => update((d) => { d.overview.adCta = v; })} label="Ad label">
          <span className="flex-1 text-[16px] text-ig-text">{o.adCta}</span>
        </Editable>
        <ChevronRight className="h-5 w-5 shrink-0 text-ig-dim" />
      </div>
    </div>
  );
}
