import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { useInsights } from "@/lib/insights-store";

export function ReelPreview({ size = "lg" }: { size?: "lg" | "sm" }) {
  const { data, update, editMode } = useInsights();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const box = size === "lg" ? "h-[210px] w-[118px]" : "h-[125px] w-[71px]";

  const pick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update((d) => {
        d.reelMedia = String(reader.result);
      });
      setOpen(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-[14px] bg-black" style={{ height: size === "lg" ? 210 : 125, width: size === "lg" ? 118 : 71 }}>
        {data.reelMedia ? (
          <img src={data.reelMedia} alt="Reel thumbnail" className="h-full w-full object-cover opacity-95" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" />
        )}
        <div
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => editMode && setOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white/95 drop-shadow">
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl border-t border-ig-line bg-ig-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ig-track" />
            <p className="mb-4 text-sm text-ig-dim">Reel media</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-11 w-full rounded-xl bg-ig-magenta font-semibold text-white"
            >
              Change media
            </button>
            <button
              type="button"
              onClick={() => {
                update((d) => {
                  d.reelMedia = null;
                });
                setOpen(false);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-ig-line text-sm text-ig-dim"
            >
              Reset media
            </button>
          </div>
        </div>
      )}
    </>
  );
}
