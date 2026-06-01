import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-2 inline-flex items-center gap-1.5 rounded border border-chalk px-2 py-1 text-xs text-navy hover:bg-mist"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" /> Copied
        </>
      ) : failed ? (
        <>Copy failed — select and copy manually</>
      ) : (
        <>
          <Copy className="h-3 w-3" /> Copy prompt
        </>
      )}
    </button>
  );
}
