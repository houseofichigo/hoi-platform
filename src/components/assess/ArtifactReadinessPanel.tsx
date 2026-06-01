import { Link } from "@tanstack/react-router";
import { Check, Circle, Minus } from "lucide-react";
import { getModule, type ModuleId } from "@/lib/curriculum";
import { isOutputPresent } from "@/lib/assess/completion";

interface ArtifactReadinessPanelProps {
  artifact: {
    id: string;
    title: string;
    phase: number;
    phaseName: string;
    modules: string[];
  };
  moduleProgress: Record<string, "not_started" | "in_progress" | "complete">;
  outputKeys: string[];
  presentOutputs: Set<string>;
  workspaceSlug: string;
}

export function ArtifactReadinessPanel({
  artifact,
  moduleProgress,
  outputKeys,
  presentOutputs,
  workspaceSlug,
}: ArtifactReadinessPanelProps) {
  const modulesComplete = artifact.modules.filter((m) => moduleProgress[m] === "complete").length;
  const keysPresent = outputKeys.filter((k) => isOutputPresent(k, presentOutputs)).length;
  const allComplete = modulesComplete === artifact.modules.length && keysPresent === outputKeys.length;
  const anyStarted = artifact.modules.some((m) => moduleProgress[m] && moduleProgress[m] !== "not_started");
  const status: "complete" | "in_progress" | "blocked" = allComplete
    ? "complete"
    : anyStarted
      ? "in_progress"
      : "blocked";

  const badge =
    status === "complete" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
        <Check className="h-3 w-3" strokeWidth={3} /> Complete
      </span>
    ) : status === "in_progress" ? (
      <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
        In progress
      </span>
    ) : (
      <span className="rounded-full bg-mist px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
        Not started
      </span>
    );

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow-muted">
            ARTIFACT {String(artifact.phase).padStart(2, "0")} · PHASE {String(artifact.phase).padStart(2, "0")} ·{" "}
            {artifact.phaseName.toUpperCase()}
          </p>
          <h3 className="mt-2 font-display text-[26px] leading-[1.1] text-navy">{artifact.title}</h3>
          <p className="mt-1 text-[13px] text-graphite">
            {modulesComplete} / {artifact.modules.length} modules · {keysPresent} / {outputKeys.length} outputs
          </p>
        </div>
        {badge}
      </div>

      <div className="mt-5 space-y-2">
        {artifact.modules.map((modId) => {
          const m = getModule(modId as ModuleId);
          const s = moduleProgress[modId] ?? "not_started";
          const Icon = s === "complete" ? Check : s === "in_progress" ? Circle : Minus;
          return (
            <Link
              key={modId}
              to="/app/$workspaceSlug/assess/$moduleId"
              params={{ workspaceSlug, moduleId: modId as ModuleId }}
              className="flex items-center justify-between gap-3 rounded border border-mist px-3 py-2 hover:border-navy"
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`h-3 w-3 ${
                    s === "complete" ? "text-terracotta" : s === "in_progress" ? "text-terracotta" : "text-slate"
                  }`}
                  strokeWidth={3}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
                  M{String(m?.num).padStart(2, "0")}
                </span>
                <span className="text-[13px] text-navy">{m?.title}</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">
                {s === "complete" ? "Done" : s === "in_progress" ? "Open" : "Start"}
              </span>
            </Link>
          );
        })}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-[12px] font-mono uppercase tracking-[0.16em] text-slate hover:text-navy">
          Output checklist ({keysPresent} / {outputKeys.length})
        </summary>
        <ul className="mt-3 grid grid-cols-1 gap-1 md:grid-cols-2">
          {outputKeys.map((k) => {
            const has = isOutputPresent(k, presentOutputs);
            return (
              <li key={k} className="flex items-center gap-2 text-[12px]">
                {has ? (
                  <Check className="h-3 w-3 text-terracotta" strokeWidth={3} />
                ) : (
                  <Minus className="h-3 w-3 text-slate" />
                )}
                <span className={has ? "text-navy" : "text-slate"}>{k}</span>
              </li>
            );
          })}
        </ul>
      </details>
    </article>
  );
}
