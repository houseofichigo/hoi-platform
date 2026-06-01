import { CopyButton } from "./CopyButton";

export function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-navy">{label}</p>
      <pre className="whitespace-pre-wrap rounded border border-chalk bg-mist/40 p-4 font-mono text-xs text-navy">
        {text}
      </pre>
      <CopyButton text={text} />
    </div>
  );
}
