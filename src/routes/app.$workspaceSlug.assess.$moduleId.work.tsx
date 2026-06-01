import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getModule, isValidModuleId, type ModuleId } from "@/lib/curriculum";
import { useAssessProgress } from "@/hooks/useAssess";
import { M01Work } from "@/components/assess/modules/M01Work";
import { M02Work } from "@/components/assess/modules/M02Work";
import { M03Work } from "@/components/assess/modules/M03Work";
import { M04Work } from "@/components/assess/modules/M04Work";
import { M05Work } from "@/components/assess/modules/M05Work";
import { M06Work } from "@/components/assess/modules/M06Work";
import { M07Work } from "@/components/assess/modules/M07Work";
import { M08Work } from "@/components/assess/modules/M08Work";
import { M09Work } from "@/components/assess/modules/M09Work";
import { M10Work } from "@/components/assess/modules/M10Work";
import { M11Work } from "@/components/assess/modules/M11Work";
import { M12Work } from "@/components/assess/modules/M12Work";

export const Route = createFileRoute("/app/$workspaceSlug/assess/$moduleId/work")({
  component: ModuleWork,
});

function ModuleWork() {
  const { moduleId } = Route.useParams();
  const { workspace } = useWorkspace();
  if (!workspace || !isValidModuleId(moduleId)) return null;
  const m = getModule(moduleId as ModuleId)!;
  const slug = workspace.slug;
  const { data: progress } = useAssessProgress(m.id);
  const studied = progress?.studied ?? false;

  return (
    <div className="space-y-8">
      {!studied && (
        <div className="rounded-md border border-chalk bg-mist/40 px-4 py-3 text-[13px] text-navy flex items-center justify-between gap-4">
          <span>Tip: review the slides before starting this assignment.</span>
          <Link
            to="/app/$workspaceSlug/assess/$moduleId/study"
            params={{ workspaceSlug: slug, moduleId: m.id }}
            className="font-medium text-terracotta hover:opacity-80 whitespace-nowrap"
          >
            Open Study →
          </Link>
        </div>
      )}



      {(() => {
        switch (moduleId) {
          case "m01":
            return <M01Work />;
          case "m02":
            return <M02Work />;
          case "m03":
            return <M03Work />;
          case "m04":
            return <M04Work />;
          case "m05":
            return <M05Work />;
          case "m06":
            return <M06Work />;
          case "m07":
            return <M07Work />;
          case "m08":
            return <M08Work />;
          case "m09":
            return <M09Work />;
          case "m10":
            return <M10Work />;
          case "m11":
            return <M11Work />;
          case "m12":
            return <M12Work />;
          default:
            return (
              <div className="card border-l-[3px] border-l-terracotta space-y-4">
                <p className="text-[14px] text-navy">
                  Assignment content for <span className="font-medium">{m.id.toUpperCase()}</span> is being built. This shell will be
                  replaced with step-by-step assignment content in batch 3.{m.num}.
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">{m.steps} steps planned</p>
                <div>
                  <p className="eyebrow-muted">ASSIGNMENT</p>
                  <p className="mt-1 text-[14px] text-navy">{m.assignment}</p>
                </div>
                <div>
                  <p className="eyebrow-muted">OUTCOME</p>
                  <p className="mt-1 text-[14px] text-navy">{m.outcome}</p>
                </div>
              </div>
            );
        }
      })()}

      <Link
        to="/app/$workspaceSlug/assess/$moduleId"
        params={{ workspaceSlug: slug, moduleId: m.id }}
        className="inline-block text-[13px] font-medium text-slate hover:text-navy"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
