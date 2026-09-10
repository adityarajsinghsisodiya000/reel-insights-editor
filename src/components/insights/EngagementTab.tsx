import { useInsights } from "@/lib/insights-store";
import { SimpleChart } from "./EditableChart";
import { ReelPreview } from "./ReelPreview";
import { SectionTitle } from "./Rows";

function formatLikes(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

function formatTime(pct: number, startLabel: string, endLabel: string): string {
  const parseTime = (s: string) => {
    const m = s.match(/^(\d+):(\d{1,2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };
  const startSec = parseTime(startLabel);
  const endSec = parseTime(endLabel);
  const secs = Math.round(startSec + (endSec - startSec) * pct);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export function EngagementTab() {
  const { data, update } = useInsights();
  const e = data.engagement;
  const graph = e.likedGraph;
  const points = graph.points.map((p) => p.value);
  const ldr = e.likedDateRange;

  return (
    <div>
      <SectionTitle title={e.actionsTitle} onChange={(v) => update((d) => { d.engagement.actionsTitle = v; })} />
      {e.actions.map((r, i) => (
        <div key={r.id} className="flex items-center justify-between py-[13px]">
          <span className="text-[16px] text-ig-text">{r.label}</span>
          <span className="text-[16px] text-ig-text">{r.value}</span>
        </div>
      ))}

      <SectionTitle title={e.interactionsTitle} onChange={(v) => update((d) => { d.engagement.interactionsTitle = v; })} />
      {e.interactionRows.map((r) => (
        <div key={r.id} className="flex items-center justify-between py-[13px]">
          <span className="text-[16px] text-ig-text">{r.label}</span>
          <span className="text-[16px] text-ig-text">{r.value}</span>
        </div>
      ))}

      <SectionTitle title={e.likedTitle} onChange={(v) => update((d) => { d.engagement.likedTitle = v; })} />
      <div className="flex justify-center pb-4">
        <ReelPreview size="sm" />
      </div>
      <SimpleChart
        points={points}
        yMax={10}
        yTicks={["10%", "5%", "0%"]}
        xLabels={[ldr.start, ldr.end]}
        formatValue={formatLikes}
        formatX={(pct) => formatTime(pct, ldr.start, ldr.end)}
        dateRange={ldr}
        onDateChange={(start, end) => update((d) => { d.engagement.likedDateRange = { start, end }; })}
      />
    </div>
  );
}
