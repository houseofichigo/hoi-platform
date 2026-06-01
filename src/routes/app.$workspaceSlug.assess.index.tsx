import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PHASES, getModule, type ModuleId } from "@/lib/curriculum";
import { useAssessAllProgress, useWorkedExample, type AssessProgressRow } from "@/hooks/useAssess";
import { useUseCaseProfile } from "@/hooks/useUseCaseProfile";

export const Route = createFileRoute("/app/$workspaceSlug/assess/")({
  component: AssessHome,
});

function AssessHome() {
  const { workspace } = useWorkspace();
  const { data: progress } = useAssessAllProgress();
  const { data: worked } = useWorkedExample();
  const { isComplete: useCaseComplete, isLoading: useCaseLoading } = useUseCaseProfile();

  if (!workspace) return null;
  const slug = workspace.slug;

  return (
    <div className="space-y-14">
      <header>
        <p className="eyebrow">
          <Link to="/app/$workspaceSlug" params={{ workspaceSlug: slug }} className="hover:text-terracotta">
            ← {workspace.name.toUpperCase()}
          </Link>{" "}
          · ASSESS · METHODOLOGY
        </p>
        <h1 className="h-display-md mt-3 max-w-[24ch]">
          Assess your team's <span className="accent-italic">methodology.</span>
        </h1>
        <p className="lead mt-3 max-w-[60ch]">
          Twelve modules across four phases, anchored by three governance gates.{" "}
          {worked ? (
            <>
              Built on <span className="font-medium text-navy">{worked.shortName}</span> for {worked.industry}.
            </>
          ) : (
            <span className="italic text-slate">No worked example selected yet.</span>
          )}
        </p>
      </header>

      {!worked && (
        <div className="card border-l-[3px] border-l-terracotta">
          <p className="text-[14px] text-navy">
            Set your worked example first — the methodology is anchored to a single case carried through every module.
          </p>
          <Link
            to="/app/$workspaceSlug"
            params={{ workspaceSlug: slug }}
            className="mt-3 inline-block text-[13px] font-medium text-terracotta hover:opacity-80"
          >
            Go to onboarding →
          </Link>
        </div>
      )}

      {worked && !useCaseLoading && !useCaseComplete && (
        <div className="card border-l-[3px] border-l-terracotta">
          <p className="eyebrow text-terracotta">ONE QUICK STEP BEFORE YOU START</p>
          <h2 className="h-heading-md mt-2">
            Tell us how your team runs {worked.shortName}.
          </h2>
          <p className="mt-3 max-w-[60ch] text-[14px] text-graphite">
            The assignments in every module are generated from your real context — your
            accounting system, your invoice volume, your VAT regime, your supplier mix. Six
            questions, takes a minute.
          </p>
          <Link
            to="/app/$workspaceSlug/onboarding/use-case-profile"
            params={{ workspaceSlug: slug }}
            search={{ return_to: `/app/${slug}/assess` }}
            className="mt-4 inline-block rounded-full bg-terracotta px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            Set up use-case profile →
          </Link>
        </div>
      )}

      {worked && (useCaseLoading || useCaseComplete) && progress?.m12?.status === "complete" && (
        <div className="card border-l-[3px] border-l-terracotta">
          <p className="eyebrow text-terracotta">PROGRAM COMPLETION READY</p>
          <h2 className="h-heading-md mt-2">Review your artifacts, gates, and certification readiness.</h2>
          <Link
            to="/app/$workspaceSlug/assess/complete"
            params={{ workspaceSlug: slug }}
            className="mt-4 inline-block rounded-full bg-terracotta px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            Open completion dashboard →
          </Link>
        </div>
      )}

      {worked && (useCaseLoading || useCaseComplete) &&
        PHASES.map((phase) => (
          <PhaseSection
            key={phase.num}
            phase={phase}
            slug={slug}
            progress={progress ?? {}}
          />
        ))}
    </div>
  );
}

function PhaseSection({
  phase,
  slug,
  progress,
}: {
  phase: (typeof PHASES)[number];
  slug: string;
  progress: Record<string, AssessProgressRow>;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="eyebrow">PHASE {String(phase.num).padStart(2, "0")} · {phase.name.toUpperCase()}</p>
        <h2 className="h-display-sm mt-2 font-display">{phase.name}</h2>
        <p className="text-[14px] text-graphite mt-1">{phase.subtitle}</p>
        <p className="mt-2 inline-block rounded-full bg-mist px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate">
          ARTIFACT {String(phase.num).padStart(2, "0")} · {phase.artifact}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {phase.modules.map((modId) => (
          <ModuleCard
            key={modId}
            modId={modId}
            slug={slug}
            progress={progress}
          />
        ))}
      </div>
    </section>
  );
}

function ModuleCard({
  modId,
  slug,
  progress,
}: {
  modId: ModuleId;
  slug: string;
  progress: Record<string, AssessProgressRow>;
}) {
  const m = getModule(modId)!;
  const p = progress[modId];
  const status = p?.status ?? "not_started";

  const prereqMet = !m.prereq || progress[m.prereq]?.status === "complete";
  const locked = !!m.prereq && !prereqMet;

  const StatusBadge = () => {
    if (status === "complete") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
          <Check className="h-3 w-3" strokeWidth={3} /> Complete
        </span>
      );
    }
    if (status === "in_progress") {
      return (
        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
          Step {Math.min(p?.current_step ?? 1, m.steps)} of {m.steps}
        </span>
      );
    }
    return (
      <span className="rounded-full bg-mist px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
        Not started
      </span>
    );
  };

  const GateBadge = () => {
    if (!m.gateNumber) return null;
    const formal = m.gateNumber === 3;
    return (
      <span
        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
          formal ? "bg-terracotta text-white" : "bg-navy text-white"
        }`}
      >
        G{m.gateNumber}
      </span>
    );
  };

  const onClick = (e: React.MouseEvent) => {
    if (locked) {
      e.preventDefault();
      const prereq = getModule(m.prereq!);
      toast.error(`Complete ${prereq?.title} first.`);
    }
  };

  return (
    <Link
      to="/app/$workspaceSlug/assess/$moduleId"
      params={{ workspaceSlug: slug, moduleId: modId }}
      onClick={onClick}
      className={`card card-elevate group block transition-opacity ${locked ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow-muted">M{String(m.num).padStart(2, "0")} · {m.duration.toUpperCase()}</p>
        <div className="flex items-center gap-2">
          {locked && <Lock className="h-3 w-3 text-slate" />}
          <GateBadge />
        </div>
      </div>
      <h3 className="mt-3 font-display text-[24px] leading-[1.15] text-navy">{m.title}</h3>
      <p className="mt-2 line-clamp-2 text-[13px] text-graphite">{m.subtitle}</p>
      <div className="mt-4">
        <StatusBadge />
      </div>
    </Link>
  );
}
