import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInsights } from "@/lib/insights-store";
import { cn } from "@/lib/utils";

type Kind = "text" | "number" | "percent";

export function Editable({
  value,
  onChange,
  kind = "text",
  label = "Edit value",
  className,
  children,
  block,
}: {
  value: string | number;
  onChange: (v: string) => void;
  kind?: Kind;
  label?: string;
  className?: string;
  children: ReactNode;
  block?: boolean;
}) {
  const { editMode } = useInsights();
  const [open, setOpen] = useState(false);

  if (!editMode) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "relative rounded-md text-left align-middle outline outline-1 outline-accent/80 bg-accent/10 -mx-0.5 px-0.5",
          block ? "block w-full" : "inline-block",
          className,
        )}
      >
        {children}
      </button>
      {open && (
        <EditorSheet
          label={label}
          kind={kind}
          value={String(value)}
          onClose={() => setOpen(false)}
          onSave={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function EditorSheet({
  label,
  kind,
  value,
  onSave,
  onClose,
  extra,
}: {
  label: string;
  kind: Kind;
  value: string;
  onSave: (v: string) => void;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = useRef(value);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.select(), 60);
    return () => clearTimeout(t);
  }, []);

  const commit = () => {
    let v = draft.trim();
    if (kind === "percent") {
      const n = Math.max(0, Math.min(100, Number(v.replace(/[^\d.]/g, "")) || 0));
      v = String(Math.round(n * 10) / 10);
    }
    if (v === "") {
      v = initial.current;
    }
    onSave(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
      <button
        type="button"
        aria-label="Close editor"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-accent/40 bg-card p-5 pb-8 shadow-sheet">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <p className="mb-3 text-sm font-medium text-muted-foreground">{label}</p>
        <input
          ref={inputRef}
          value={draft}
          inputMode={kind === "text" ? "text" : "decimal"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
          }}
          className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-lg text-foreground outline-none focus:border-accent"
        />
        {kind === "percent" && (
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={Number(draft.replace(/[^\d.]/g, "")) || 0}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-4 w-full accent-accent"
          />
        )}
        {extra}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={commit}
            className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-accent-foreground"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => setDraft(initial.current)}
            className="min-h-11 rounded-xl border border-border px-4 text-sm text-muted-foreground"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-4 text-sm text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
