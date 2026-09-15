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
import { formatWithCommas, generateGraphPoints } from "./utils";

const STORAGE_KEY = "insights-editor-v5";

type Ctx = {
  data: InsightsData;
  update: (fn: (draft: InsightsData) => void) => void;
  reset: () => void;
  importData: (d: InsightsData) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  keyActive: boolean;
  setKeyActive: (v: boolean) => void;
  showKeyPrompt: boolean;
  setShowKeyPrompt: (v: boolean) => void;
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
  // Auto-calc Viewers (95% of Views) and Profile visits (2% of Viewers)
  const viewsStr = result.overview.stats.find((s) => s.id === "views")?.value ?? "0";
  const viewsNum = Number(String(viewsStr).replace(/[^\d.-]/g, ""));
  const viewersStat = result.overview.stats.find((s) => s.id === "viewers");
  const pvAction = result.engagement.actions.find((a) => a.id === "pv");
  if (Number.isFinite(viewsNum) && viewsNum > 0) {
    if (viewersStat) {
          const viewersNum = Math.round(viewsNum * 0.95);
      viewersStat.value = formatWithCommas(String(viewersNum));
      if (pvAction) {
        pvAction.value = formatWithCommas(String(Math.round(viewersNum * 0.003)));
      }
    }
    // Regenerate graph points based on Views
    const pts = result.overview.viewsGraph.points;
    result.overview.viewsGraph.points = generateGraphPoints(viewsNum, pts.length);
  }
  return result;
}

export function InsightsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InsightsData>(() => cloneDefaults());
  const [editMode, setEditMode] = useState(false);
  const [keyActive, setKeyActive] = useState(false);
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      localStorage.removeItem("insights-editor-v3");
      localStorage.removeItem("insights-editor-v4");
      localStorage.removeItem("ri-active-key");
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

      // Snapshot old values before applying changes
      const oldViews = prev.overview.stats.find((s) => s.id === "views")?.value ?? "0";
      const oldViewers = prev.overview.stats.find((s) => s.id === "viewers")?.value ?? "0";

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
      // Sync overview.stats ↔ engagement.actions (Follows)
      const followsStat = next.overview.stats.find((s) => s.id === "follows");
      const followsAction = next.engagement.actions.find((a) => a.id === "fl");
      if (followsStat && followsAction) followsAction.value = followsStat.value;

      // Format Views and regenerate graph points
      const viewsStat = next.overview.stats.find((s) => s.id === "views");
      if (viewsStat) {
        viewsStat.value = formatWithCommas(viewsStat.value);
        const viewsNum = Number(viewsStat.value.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(viewsNum) && viewsNum > 0) {
          const pts = next.overview.viewsGraph.points;
          next.overview.viewsGraph.points = generateGraphPoints(viewsNum, pts.length);
        }
      }

      // Auto-calc Viewers when Views changes (95%)
      const newViews = next.overview.stats.find((s) => s.id === "views")?.value ?? "0";
      const viewersStat = next.overview.stats.find((s) => s.id === "viewers");
      if (oldViews !== newViews && viewersStat) {
        const viewsNum = Number(newViews.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(viewsNum) && viewsNum > 0) {
          viewersStat.value = formatWithCommas(String(Math.round(viewsNum * 0.95)));
        }
      }

      // Auto-calc Profile visits when Viewers changes (0.3%)
      const newViewers = next.overview.stats.find((s) => s.id === "viewers")?.value ?? "0";
      const profileAction = next.engagement.actions.find((a) => a.id === "pv");
      if ((oldViews !== newViews || oldViewers !== newViewers) && profileAction) {
        const viewersNum = Number(newViewers.replace(/[^\d.-]/g, ""));
        if (Number.isFinite(viewersNum) && viewersNum > 0) {
          profileAction.value = formatWithCommas(String(Math.round(viewersNum * 0.003)));
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
    () => ({ data, update, reset, importData, editMode, setEditMode, keyActive, setKeyActive, showKeyPrompt, setShowKeyPrompt }),
    [data, update, reset, importData, editMode, keyActive, showKeyPrompt],
  );

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export function useInsights() {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error("useInsights must be used inside InsightsProvider");
  return ctx;
}
