import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getModule, isValidModuleId, type ModuleId } from "@/lib/curriculum";
import { useAssessProgress } from "@/hooks/useAssess";
import { ModuleTabs } from "@/components/assess/ModuleTabs";

export const Route = createFileRoute("/app/$workspaceSlug/assess/$moduleId")({
  component: ModuleLayout,
});

function ModuleLayout() {
  const { moduleId } = Route.useParams();
  const { workspace } = useWorkspace();

  if (!workspace) return null;
  if (!isValidModuleId(moduleId)) {
    return <p className="text-slate">Unknown module.</p>;
  }
  const m = getModule(moduleId as ModuleId)!;
  const { data: progress, isLoading } = useAssessProgress(m.id);
  const slug = workspace.slug;

  return (
    <div className="space-y-8">
      <p className="eyebrow">
        <Link to="/app/$workspaceSlug/assess" params={{ workspaceSlug: slug }} className="hover:text-terracotta">
          ← ASSESS
        </Link>{" "}
        · PHASE {String(m.phaseNum).padStart(2, "0")}: {m.phaseName.toUpperCase()} · M{String(m.num).padStart(2, "0")} {m.title.toUpperCase()}
      </p>

      <header className="space-y-3">
        <p className="eyebrow-muted">MODULE {String(m.num).padStart(2, "0")} · {m.duration.toUpperCase()}</p>
        {(() => {
          const trimmed = m.title.trim();
          const idx = trimmed.lastIndexOf(" ");
          const lead = idx === -1 ? "" : trimmed.slice(0, idx);
          const accent = (idx === -1 ? trimmed : trimmed.slice(idx + 1)) + ".";
          return (
            <h1 className="h-display-md max-w-[28ch]">
              {lead && <>{lead} </>}
              <span className="accent-italic">{accent}</span>
            </h1>
          );
        })()}
        <p className="lead max-w-[60ch]">{m.subtitle}</p>
        {m.gateNumber && (
          <p className="inline-block rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
            Gate {m.gateNumber} runs here — {m.gateNumber === 3 ? "formal" : "informal"}
          </p>
        )}
      </header>

      <ModuleTabs
        workspaceSlug={slug}
        moduleId={m.id}
        hasGate={Boolean(m.gateNumber)}
        progress={progress ?? undefined}
        isLoading={isLoading}
      />

      <Outlet />
    </div>
  );
}
