import { useEffect, useRef, useState } from "react";
import { Download, Upload, RotateCcw, Smartphone } from "lucide-react";
import { useInsights } from "@/lib/insights-store";
import type { InsightsData } from "@/lib/insights-data";

type BIPEvent = Event & { prompt: () => Promise<void> };

export function SettingsMenu({ onClose }: { onClose: () => void }) {
  const { data, reset, importData } = useInsights();
  const fileRef = useRef<HTMLInputElement>(null);
  const [installEvent, setInstallEvent] = useState<BIPEvent | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "insights-config.json";
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const importJson = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        importData(JSON.parse(String(r.result)) as InsightsData);
        onClose();
      } catch {
        setHint("That file could not be read.");
      }
    };
    r.readAsText(file);
  };

  const item = "flex min-h-12 w-full items-center gap-3 px-5 text-[15px] text-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-card pb-8 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <button type="button" className={item} onClick={exportJson}>
          <Download className="h-5 w-5 text-muted-foreground" /> Export JSON
        </button>
        <button type="button" className={item} onClick={() => fileRef.current?.click()}>
          <Upload className="h-5 w-5 text-muted-foreground" /> Import JSON
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            reset();
            onClose();
          }}
        >
          <RotateCcw className="h-5 w-5 text-muted-foreground" /> Reset all data
        </button>
        <button
          type="button"
          className={item}
          onClick={async () => {
            if (installEvent) {
              await installEvent.prompt();
              onClose();
            } else {
              setHint("Open Chrome menu → Add to Home screen");
            }
          }}
        >
          <Smartphone className="h-5 w-5 text-muted-foreground" /> Install app
        </button>
        {hint && <p className="px-5 pt-2 text-[13px] text-muted-foreground">{hint}</p>}
        <p className="px-5 pt-3 text-[12px] text-muted-foreground">
          Press and hold the ⋯ button to enter edit mode.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => importJson(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
