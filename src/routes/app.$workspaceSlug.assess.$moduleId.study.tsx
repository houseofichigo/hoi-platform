import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getModule, isValidModuleId, type ModuleId } from "@/lib/curriculum";
import { useAssessProgress } from "@/hooks/useAssess";
import { TokenizerLab } from "@/components/assess/TokenizerLab";

export const Route = createFileRoute("/app/$workspaceSlug/assess/$moduleId/study")({
  component: ModuleStudy,
});

function ModuleStudy() {
  const { workspaceSlug, moduleId } = Route.useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  if (!workspace || !isValidModuleId(moduleId)) return null;
  const m = getModule(moduleId as ModuleId)!;
  const { data: progress, setStudied } = useAssessProgress(m.id);
  const slug = workspace.slug;
  const studied = progress?.studied ?? false;

  return (
    <div className="space-y-10">
      <p className="lead">~{m.estimatedMinutes} min · slides + audio brief</p>

      <section className="space-y-2">
        <p className="eyebrow-muted">SLIDES</p>
        <div className="card bg-mist/40 text-[14px] text-graphite italic">
          Slides for M{String(m.num).padStart(2, "0")} will be embedded here. Coming in batch 3.{m.num}.
        </div>
      </section>

      <section className="space-y-2">
        <p className="eyebrow-muted">AUDIO BRIEF</p>
        <p className="text-[14px] text-graphite">A 5-10 minute conversational overview generated with NotebookLM.</p>
        <div className="card bg-mist/40 text-[14px] text-graphite italic">Audio brief coming soon.</div>
      </section>

      {m.id === "m01" && (
        <section className="space-y-3">
          <p className="eyebrow-muted">TOKENIZER LAB</p>
          <p className="text-[14px] text-graphite">
            LLMs charge by tokens, not words. Paste text or pick a preset to see how
            volume drives cost.
          </p>
          <div className="card">
            <TokenizerLab />
          </div>
        </section>
      )}

      <section className="card">
        {studied ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-terracotta text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-[14px] font-medium text-navy">Studied</span>
            </div>
            <button
              type="button"
              onClick={() => setStudied.mutate(false, { onError: (e) => toast.error((e as Error).message) })}
              className="text-[13px] font-medium text-slate hover:text-terracotta"
            >
              Mark as not studied
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-[14px] text-navy">Finished the slides and audio? Mark as studied to unlock the assignment.</p>
            <button
              type="button"
              disabled={setStudied.isPending}
              onClick={() =>
                setStudied.mutate(true, {
                  onSuccess: () => toast.success("Marked as studied"),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              className="btn-ichigo btn-ichigo-primary"
            >
              Mark as studied
            </button>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-chalk pt-6">
        <Link
          to="/app/$workspaceSlug/assess/$moduleId"
          params={{ workspaceSlug: slug, moduleId: m.id }}
          className="text-[13px] font-medium text-slate hover:text-navy"
        >
          ← Back to overview
        </Link>
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/app/$workspaceSlug/assess/$moduleId/work",
              params: { workspaceSlug: slug, moduleId: m.id },
            })
          }
          className="btn-ichigo btn-ichigo-primary"
        >
          Continue to assignment →
        </button>
      </footer>
    </div>
  );
}
