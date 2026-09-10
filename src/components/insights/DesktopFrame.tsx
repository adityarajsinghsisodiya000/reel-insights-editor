import { useState, type ReactNode } from "react";
import { Pencil, Settings } from "lucide-react";
import { useInsights } from "@/lib/insights-store";
import { SettingsMenu } from "./SettingsMenu";

export function DesktopFrame({ children }: { children: ReactNode }) {
  const { editMode, setEditMode } = useInsights();
  const [menu, setMenu] = useState(false);

  return (
    <div className="min-h-screen bg-ig-bg lg:flex lg:items-start lg:justify-center lg:gap-10 lg:p-10">
      <aside className="hidden w-72 shrink-0 lg:block">
        <h1 className="text-xl font-semibold text-ig-text">Insights Editor</h1>
        <p className="mt-2 text-sm text-ig-dim">
          A mockup editor. Nothing here connects to any social network.
        </p>
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
              editMode ? "bg-accent text-accent-foreground" : "bg-ig-card text-ig-text"
            }`}
          >
            <Pencil className="h-4 w-4" /> {editMode ? "Exit edit mode" : "Enter edit mode"}
          </button>
          <button
            type="button"
            onClick={() => setMenu(true)}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-ig-card px-4 text-sm text-ig-text"
          >
            <Settings className="h-4 w-4" /> Export / Import / Reset
          </button>
        </div>
        <ul className="mt-6 space-y-2 text-xs text-ig-dim">
          <li>Hold the ⋯ button for edit mode.</li>
          <li>Tap any outlined element to change it.</li>
          <li>Drag on a chart to reshape the curve.</li>
          <li>Tap the reel thumbnail to swap the image.</li>
          <li>Press Esc or Done to finish.</li>
        </ul>
      </aside>

      <div className="w-full max-w-md lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-ig-line lg:shadow-2xl">
        {children}
      </div>
      {menu && <SettingsMenu onClose={() => setMenu(false)} />}
    </div>
  );
}
