import type { ADRSection, ToolDecisionScaffold } from "@/lib/worked-examples/invoice-ocr/m07";

interface Props {
  sections: readonly ADRSection[];
  value: ToolDecisionScaffold;
  onChange: (next: ToolDecisionScaffold) => void;
}

const KEY_MAP: Record<string, keyof ToolDecisionScaffold> = {
  context: "context",
  options: "options",
  decision: "decision",
  rationale: "rationale",
  consequences: "consequences",
  review: "reviewPlan",
};

export function ADRSectionEditor({ sections, value, onChange }: Props) {
  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const key = KEY_MAP[s.id];
        if (!key) return null;
        return (
          <div key={s.id} className="space-y-1">
            <p className="eyebrow-muted">{s.title.toUpperCase()}</p>
            <p className="text-[12px] text-slate">{s.prompt}</p>
            <textarea
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
            />
          </div>
        );
      })}
    </div>
  );
}
