import { useState } from "react";
import { X, ExternalLink, KeyRound, Loader2, AlertCircle } from "lucide-react";

interface KeyPromptProps {
  onKeyValid: () => void;
  onClose: () => void;
}

export function KeyPrompt({ onKeyValid, onClose }: KeyPromptProps) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleActivate = async () => {
    if (!key.trim()) {
      setError("Please enter a key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { validateAndActivateKey } = await import("../lib/key-system");
      const result = await validateAndActivateKey(Promise.resolve(key.trim()));

      if (result.valid) {
        localStorage.setItem("ri-active-key", key.trim().toUpperCase());
        onKeyValid();
      } else {
        setError(result.error || "Invalid key");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleActivate();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[380px] max-w-[90vw] rounded-2xl bg-[#262626] border border-[#363636] shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a8a8a8] hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-4 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-purple-400" />
          </div>

          <h2 className="text-white text-lg font-semibold mb-1">Enter Access Key</h2>
          <p className="text-[#a8a8a8] text-sm">
            Enter your access key to unlock the editor
          </p>
        </div>

        <div className="px-6 pb-6">
          <div className="relative">
            <input
              type="text"
              value={key}
              onChange={(e) => {
                setKey(e.target.value.toUpperCase());
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="RI-XXXX-XXXX-XXXX"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#363636] text-white text-center text-lg font-mono tracking-[0.15em] placeholder:text-[#525252] placeholder:tracking-[0.15em] focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all disabled:opacity-50"
              autoFocus
            />
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !key.trim()}
            className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Activate Key"
            )}
          </button>

          <div className="mt-5 pt-4 border-t border-[#363636]">
            <p className="text-[#a8a8a8] text-sm text-center">
              Don&apos;t have a key?
            </p>
            <p className="text-sm text-center mt-1">
              <span className="text-[#a8a8a8]">Purchase one by DMing </span>
              <span className="text-white font-semibold">Sir Diablo</span>
              <span className="text-[#a8a8a8]"> on Telegram</span>
            </p>
            <a
              href="https://t.me/Diablothedemon"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#363636] text-blue-400 hover:text-blue-300 hover:border-blue-500/30 transition-all text-sm font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
              @Diablothedemon
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
