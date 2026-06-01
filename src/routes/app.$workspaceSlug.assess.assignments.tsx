import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { MODULES } from "@/lib/curriculum";
import { useAssessAllProgress } from "@/hooks/useAssess";

export const Route = createFileRoute("/app/$workspaceSlug/assess/assignments")({
  component: AssignmentsIndex,
});

function StatusBadge({ status }: { status: "not_started" | "in_progress" | "complete" }) {
  const map = {
    complete: { label: "Complete", cls: "bg-terracotta/10 text-terracotta border-terracotta/30" },
    in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    not_started: { label: "Not started", cls: "bg-mist text-slate border-chalk" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

function AssignmentsIndex() {
  const { workspace } = useWorkspace();
  const { data: progress } = useAssessAllProgress();

  if (!workspace) return null;
  const slug = workspace.slug;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="eyebrow">
          <Link to="/app/$workspaceSlug/assess" params={{ workspaceSlug: slug }} className="hover:text-terracotta">
            ← ASSESS
          </Link>{" "}
          · ASSIGNMENTS
        </p>
        <h1 className="h-display-md max-w-[24ch]">
          Every <span className="accent-italic">assignment.</span>
        </h1>
        <p className="lead max-w-[60ch]">
          Jump straight into any module's assignment. Status reflects your latest progress.
        </p>
      </header>

      <div className="space-y-3">
        {MODULES.map((m) => {
          const row = progress?.[m.id];
          const status = row?.status ?? "not_started";
          return (
            <Link
              key={m.id}
              to="/app/$workspaceSlug/assess/$moduleId/work"
              params={{ workspaceSlug: slug, moduleId: m.id }}
              className="card flex items-center justify-between gap-6 transition-colors hover:border-terracotta/50"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="eyebrow-muted">
                  M{String(m.num).padStart(2, "0")} · PHASE {String(m.phaseNum).padStart(2, "0")} {m.phaseName.toUpperCase()}
                </p>
                <p className="text-[15px] font-medium text-navy">{m.title}</p>
                <p className="text-[13px] text-graphite line-clamp-2">{m.assignment}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge status={status} />
                <span className="text-[13px] font-medium text-terracotta">Open →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
