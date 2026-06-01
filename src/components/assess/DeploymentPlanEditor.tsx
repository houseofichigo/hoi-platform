import type {
  DeploymentPlanScaffold,
  PlanSection,
} from "@/lib/worked-examples/invoice-ocr/m08";

interface Props {
  sections: readonly PlanSection[];
  value: DeploymentPlanScaffold;
  onChange: (next: DeploymentPlanScaffold) => void;
}

export function DeploymentPlanEditor({ sections, value, onChange }: Props) {
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.id} className="space-y-1">
          <p className="eyebrow-muted">{s.title.toUpperCase()}</p>
          <p className="text-[12px] text-slate">{s.prompt}</p>
          <textarea
            value={value[s.id]}
            onChange={(e) => onChange({ ...value, [s.id]: e.target.value })}
            rows={5}
            className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
          />
        </div>
      ))}
    </div>
  );
}
