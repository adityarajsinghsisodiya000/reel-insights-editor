import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Context,
} from "react";
import { cloneDefaults, type InsightsData } from "./insights-data";
import { formatWithCommas } from "./utils";

const STORAGE_KEY = "insights-editor-v5";

type Ctx = {
  data: InsightsData;
  update: (fn: (draft: InsightsData) => void) => void;
  reset: () => void;
  importData: (d: InsightsData) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
};

// Keep a single context instance even if this module is evaluated twice
// (hot reloads / duplicated module graphs), otherwise consumers can look up
// a different context than the provider used and throw.
const globalRef = globalThis as unknown as {
  __insightsContext?: Context<Ctx | null>;
};
const InsightsContext =
  globalRef.__insightsContext ?? createContext<Ctx | null>(null);
globalRef.__insightsContext = InsightsContext;

// Shallow-merge each top-level section over defaults so data saved before a
// schema change never leaves a section missing new keys.
function merge(stored: Partial<InsightsData>): InsightsData {
  const base = cloneDefaults() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(stored ?? {})) {
    const cur = base[k];
    base[k] =
      v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object"
        ? { ...(cur as object), ...(v as object) }
        : v;
  }
  const result = base as unknown as InsightsData;
  const defaults = cloneDefaults();
  for (let i = 0; i < result.overview.stats.length; i++) {
    if (!result.overview.stats[i]?.value && defaults.overview.stats[i]) {
      result.overview.stats[i]!.value = defaults.overview.stats[i]!.value;
    }
  }
  return result;
}

export function InsightsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InsightsData>(() => cloneDefaults());
  const [editMode, setEditMode] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      localStorage.removeItem("insights-editor-v3");
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(merge(JSON.parse(raw) as Partial<InsightsData>));
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  const update = useCallback((fn: (draft: InsightsData) => void) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as InsightsData;
      fn(next);
      // Sync interactions between root and engagement
      const syncMap: Record<string, string> = {
        likes: "Likes",
        comments: "Comments",
        reposts: "Reposts",
        shares: "Shares",
        saves: "Saves",
      };
      for (const row of next.interactions) {
        const engagementRow = next.engagement.interactionRows.find(
          (r) => r.label === syncMap[row.id],
        );
        if (engagementRow) engagementRow.value = row.value;
      }
      // Sync overview.stats ↔ engagement.actions (Follows, Profile visits)
      const followsStat = next.overview.stats.find((s) => s.id === "follows");
      const followsAction = next.engagement.actions.find((a) => a.id === "fl");
      if (followsStat && followsAction) followsAction.value = followsStat.value;
      // Auto-calculate Profile visits as 5% of Views
      const viewsStat = next.overview.stats.find((s) => s.id === "views");
      const profileAction = next.engagement.actions.find((a) => a.id === "pv");
      if (viewsStat && profileAction) {
        const viewsNum = Number(viewsStat.value.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(viewsNum) && viewsNum > 0) {
          profileAction.value = formatWithCommas(String(Math.round(viewsNum * 0.05)));
        }
      }
      // Format Views with commas and scale chart data points
      if (viewsStat) {
        viewsStat.value = formatWithCommas(viewsStat.value);
        const viewsNum = Number(viewsStat.value.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(viewsNum) && viewsNum > 0) {
          const pts = next.overview.viewsGraph.points;
          const maxPoint = Math.max(...pts.map((p) => p.value), 1);
          const scale = viewsNum / maxPoint;
          for (const pt of pts) {
            pt.value = Math.round(pt.value * scale);
          }
        }
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => setData(cloneDefaults()), []);
  const importData = useCallback(
    (d: InsightsData) => setData(merge(d)),
    [],
  );

  const value = useMemo(
    () => ({ data, update, reset, importData, editMode, setEditMode }),
    [data, update, reset, importData, editMode],
  );

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export function useInsights() {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error("useInsights must be used inside InsightsProvider");
  return ctx;
}
