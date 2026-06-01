import { createFileRoute, Link } from "@tanstack/react-router";
import { Hammer, Check, Clock, ArrowRight, Library as LibraryIcon } from "lucide-react";
import { useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUseCases, useScores } from "@/hooks/useBuild";

export const Route = createFileRoute("/app/$workspaceSlug/build/")({
  component: BuildOverview,
});

function BuildOverview() {
  const { workspace } = useWorkspace();
  const { data: useCases = [] } = useUseCases();
  const { data: scores = [] } = useScores();

  const counts = useMemo(() => {
    const c = { draft: 0, scored: 0, submitted: 0, approved: 0, quick_wins: 0 };
    useCases.forEach((u) => {
      if (u.status === "draft" || u.status === "capturing") c.draft += 1;
      if (u.status === "scored") c.scored += 1;
      if (u.status === "submitted") c.submitted += 1;
      if (u.status === "approved") c.approved += 1;
    });
    c.quick_wins = scores.filter((s) => s.quadrant === "quick-wins").length;
    return c;
  }, [useCases, scores]);

  if (!workspace) return null;
  const slug = workspace.slug;

  const outcomes: { title: string; body: string }[] = [
    { title: "A structured use case record", body: "Captured fields you can reuse, share, and re-score." },
    { title: "A first process map", body: "Steps, decision logic, and where humans stay in the loop." },
    { title: "A recommended solution type", body: "Automation, AI assistant, AI workflow, or AI agent." },
    { title: "Summary of key blockers", body: "Hard stops, design constraints, and what to fix first." },
  ];

  const kpis = [
    { label: "Drafts", value: counts.draft },
    { label: "Scored", value: counts.scored },
    { label: "Submitted", value: counts.submitted },
    { label: "Approved", value: counts.approved },
    { label: "Quick wins", value: counts.quick_wins },
  ];

  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-3xl">
        <div className="card text-center px-6 py-10 md:px-10 md:py-14">
          <p className="eyebrow justify-center">PHASE · BUILD</p>
          <h1 className="h-display-md mt-3 flex items-center justify-center gap-3">
            <Hammer className="h-6 w-6 text-terracotta" />
            Build Use Cases
          </h1>
          <p className="lead mt-3 mx-auto max-w-[60ch]">
            Describe a business process so we can map whether it should become an{" "}
            <span className="accent-italic">automation</span>, AI assistant, AI workflow, or AI agent.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-chalk bg-paper px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-slate">
            <Clock className="h-3 w-3 text-terracotta" />
            About 8 to 12 minutes
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-3 text-left md:grid-cols-2">
            {outcomes.map((o) => (
              <li key={o.title} className="flex gap-3 rounded-md border border-chalk bg-paper p-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-white">
                  <Check className="h-3 w-3" />
                </span>
                <div>
                  <p className="text-[14px] font-medium text-navy">{o.title}</p>
                  <p className="mt-0.5 text-[12px] text-graphite">{o.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/app/$workspaceSlug/build/capture"
              params={{ workspaceSlug: slug }}
              className="inline-flex items-center gap-2 rounded-md bg-terracotta px-5 py-2.5 text-[14px] font-medium text-white hover:opacity-90"
            >
              Start Use Case Mapping
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/app/$workspaceSlug/build/library"
              params={{ workspaceSlug: slug }}
              className="inline-flex items-center gap-2 rounded-md border border-navy bg-transparent px-5 py-2.5 text-[14px] font-medium text-navy hover:bg-navy hover:text-white"
            >
              <LibraryIcon className="h-4 w-4" />
              View Use Case Library
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((c) => (
          <div key={c.label} className="card">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate">{c.label}</p>
            <p className="mt-2 font-display text-[32px] leading-none text-navy">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <p className="eyebrow-muted">WHAT YOU'LL DO</p>
        <h3 className="mt-2 font-display text-[20px] text-navy">Four short steps</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { n: 1, label: "Identify the Use Case", help: "What it is, who it's for, what success looks like." },
            { n: 2, label: "Data and Tools", help: "Where data lives and how the system can act." },
            { n: 3, label: "How the Work Happens", help: "Steps, frequency, decision logic, automation level." },
            { n: 4, label: "Safety and Limits", help: "Risk, validation, rollback, monitoring." },
          ].map((b) => (
            <div key={b.n} className="rounded-md border border-chalk bg-paper p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">Step {b.n}</p>
              <p className="mt-1 font-display text-[16px] text-navy">{b.label}</p>
              <p className="mt-1 text-[12px] text-graphite">{b.help}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
