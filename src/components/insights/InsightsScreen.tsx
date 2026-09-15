import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, Pencil, TrendingUp } from "lucide-react";
import { useInsights } from "@/lib/insights-store";
import { LikeIcon, CommentIcon, RepostIcon, ShareIcon, SaveIcon } from "./icons";
import { Editable } from "./Editable";
import { ReelPreview } from "./ReelPreview";
import { OverviewTab } from "./OverviewTab";
import { EngagementTab } from "./EngagementTab";
import { AudienceTab } from "./AudienceTab";
import { SettingsMenu } from "./SettingsMenu";

const icons = [LikeIcon, CommentIcon, RepostIcon, ShareIcon, SaveIcon];

export function InsightsScreen() {
  const { data, update, editMode, setEditMode } = useInsights();
  const [tab, setTab] = useState<"overview" | "engagement" | "audience">("overview");
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.matches("input, textarea")) {
        setEditMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setEditMode]);

  const startHold = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      setEditMode(true);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 600);
  };
  const endHold = () => {
    if (timer.current) clearTimeout(timer.current);
    if (!held.current && !editMode) setMenu(true);
  };

  const tabs = [
    ["overview", data.tabLabels.overview],
    ["engagement", data.tabLabels.engagement],
    ["audience", data.tabLabels.audience],
  ] as const;

  return (
    <div
      className={`font-ig mx-auto min-h-screen w-full max-w-[440px] bg-ig-bg text-ig-text ${
        editMode ? "ring-2 ring-accent" : ""
      }`}
    >
      <header className="sticky top-0 z-20 flex items-center gap-4 bg-ig-bg px-4 py-3">
        <ArrowLeft className="h-6 w-6 shrink-0 text-ig-text" />
        <Editable value={data.headerTitle} onChange={(v) => update((d) => { d.headerTitle = v; })} label="Screen title">
          <h1
            onClick={() => setEditMode(!editMode)}
            className="flex-1 text-[19px] font-bold text-ig-text cursor-pointer"
          >
            {data.headerTitle}
          </h1>
        </Editable>
        <div className="flex shrink-0 items-center gap-2">
          <TrendingUp className="h-6 w-6 text-ig-text" />
          <button
            type="button"
            aria-label="Menu — hold to edit"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ig-text"
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={() => timer.current && clearTimeout(timer.current)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-5 w-5 text-ig-text" />
          </button>
        </div>
      </header>

      {editMode && (
        <div className="sticky top-[52px] z-10 flex items-center justify-between gap-3 bg-accent px-4 py-2 text-accent-foreground">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Pencil className="h-4 w-4" /> Edit mode — tap anything to change it
          </span>
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="min-h-9 rounded-full bg-background px-4 text-[13px] font-semibold text-foreground"
          >
            Done
          </button>
        </div>
      )}

      <div className="flex flex-col items-center pt-2">
        <ReelPreview />
        <div className="mt-5 flex w-full items-start justify-around px-2">
          {data.interactions.map((s, i) => {
            const Icon = icons[i] ?? LikeIcon;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2">
                <Icon className="h-5 w-5 text-ig-text" />
                <Editable
                  value={s.value}
                  onChange={(v) => update((d) => { d.interactions[i]!.value = v; })}
                  kind="number"
                  label={s.label}
                >
                  <span className="text-[15px] font-semibold text-ig-text">{s.value}</span>
                </Editable>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticky top-[52px] z-10 mt-4 grid grid-cols-3 border-b border-ig-line bg-ig-bg">
        {tabs.map(([key, label]) => (
          <div key={key} className="flex flex-col items-center">
            <Editable
              value={label}
              onChange={(v) => update((d) => { d.tabLabels[key] = v; })}
              label="Tab label"
            >
              <span
                onClick={() => setTab(key)}
                className={`relative py-3 text-[15px] ${
                  tab === key ? "font-semibold text-ig-text" : "text-ig-dim"
                }`}
              >
                {label}
                {tab === key && (
                  <span className="absolute inset-x-0 -bottom-px mx-auto block h-[2px] bg-white" />
                )}
              </span>
            </Editable>
          </div>
        ))}
      </div>

      <div className="px-4">
        {tab === "overview" && <OverviewTab />}
        {tab === "engagement" && <EngagementTab />}
        {tab === "audience" && <AudienceTab />}
      </div>

      {menu && <SettingsMenu onClose={() => setMenu(false)} />}
    </div>
  );
}
