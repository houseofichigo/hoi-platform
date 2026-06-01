import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getModule, isValidModuleId, type ModuleId } from "@/lib/curriculum";
import { useAssessProgress, useWorkedExample } from "@/hooks/useAssess";

export const Route = createFileRoute("/app/$workspaceSlug/assess/$moduleId/")({
  component: ModuleOverview,
});

function ModuleOverview() {
  const { moduleId } = Route.useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const { data: worked } = useWorkedExample();

  if (!workspace || !isValidModuleId(moduleId)) return null;
  const m = getModule(moduleId as ModuleId)!;
  const { data: progress } = useAssessProgress(m.id);
  const slug = workspace.slug;

  const status = progress?.status ?? "not_started";
  const studied = progress?.studied ?? false;

  const primaryAction = (() => {
    if (status === "complete") return { label: "Review →", to: "work" as const };
    if (status === "in_progress") return { label: "Continue assignment →", to: "work" as const };
    if (studied) return { label: "Begin assignment →", to: "work" as const };
    return { label: "Start studying →", to: "study" as const };
  })();

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
        <div className="md:col-span-3 space-y-8">
          <section className="space-y-2">
            <p className="eyebrow-muted">DESCRIPTION</p>
            <p className="text-[15px] text-navy">{m.description}</p>
          </section>
          <section className="space-y-2">
            <p className="eyebrow-muted">OBJECTIVES</p>
            <ul className="list-disc pl-5 space-y-1 text-[14px] text-navy">
              {m.objectives.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </section>
          <section className="space-y-3">
            <p className="eyebrow-muted">THREE CONCEPTS</p>
            <div className="space-y-3">
              {m.concepts.map((c) => (
                <div key={c.term} className="card">
                  <p className="text-[14px] font-medium text-navy">{c.term}</p>
                  <p className="mt-1 text-[13px] text-graphite">{c.definition}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="md:col-span-2 space-y-4">
          <div className="card bg-mist/40">
            <p className="eyebrow-muted">WHAT YOU'LL DO</p>
            <p className="mt-2 text-[14px] text-navy">{m.assignment}</p>
          </div>
          <div className="card border-l-[3px] border-l-terracotta">
            <p className="eyebrow-muted">WHAT YOU'LL LEAVE WITH</p>
            <p className="mt-2 text-[14px] text-navy">{m.outcome}</p>
          </div>
          {m.prereq && (
            <div className="card">
              <p className="eyebrow-muted">PREREQUISITES</p>
              <Link
                to="/app/$workspaceSlug/assess/$moduleId"
                params={{ workspaceSlug: slug, moduleId: m.prereq }}
                className="mt-2 inline-block text-[14px] font-medium text-terracotta hover:opacity-80"
              >
                {getModule(m.prereq)?.title} →
              </Link>
            </div>
          )}
          {worked && (
            <div className="card">
              <p className="eyebrow-muted">WORKED EXAMPLE</p>
              <p className="mt-2 text-[14px] font-medium text-navy">{worked.name}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">{worked.industry}</p>
              <p className="mt-2 text-[13px] text-graphite">{worked.contextBlurb}</p>
            </div>
          )}
          <div className="card">
            <p className="eyebrow-muted">TIME</p>
            <p className="mt-2 text-[14px] text-navy">{m.duration} · ~{m.estimatedMinutes} min</p>
          </div>
        </aside>
      </div>

      <footer className="flex items-center justify-between border-t border-chalk pt-6">
        <Link
          to="/app/$workspaceSlug/assess"
          params={{ workspaceSlug: slug }}
          className="text-[13px] font-medium text-slate hover:text-navy"
        >
          ← Back to Assess
        </Link>
        <button
          type="button"
          onClick={() =>
            navigate({
              to:
                primaryAction.to === "study"
                  ? "/app/$workspaceSlug/assess/$moduleId/study"
                  : "/app/$workspaceSlug/assess/$moduleId/work",
              params: { workspaceSlug: slug, moduleId: m.id },
            })
          }
          className="btn-ichigo btn-ichigo-primary"
        >
          {primaryAction.label}
        </button>
      </footer>
    </div>
  );
}
