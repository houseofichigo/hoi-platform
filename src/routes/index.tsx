import { createFileRoute, Link } from "@tanstack/react-router";
import logoWhite from "@/assets/logos/logo-white-mark.png";

export const Route = createFileRoute("/")({
  component: Index,
});

const pillars = [
  {
    eyebrow: "ASSESS",
    title: "Learn the",
    accent: "methodology.",
    body: "Twelve modules, four phases, three governance gates.",
  },
  {
    eyebrow: "DISCOVER",
    title: "Curated",
    accent: "libraries.",
    body: "Prompts, agents, tools, and case studies — curated by House of Ichigo.",
  },
  {
    eyebrow: "BUILD",
    title: "Score your",
    accent: "use cases.",
    body: "Capture real business processes. Prioritise on the engine.",
  },
  {
    eyebrow: "DEPLOY",
    title: "Ship and",
    accent: "govern.",
    body: "Roadmap, monitoring, audit trail. Built for EU regulation.",
  },
];
function Index() {




  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <section className="ink-glow relative">
        <div className="mx-auto flex max-w-[1080px] items-center gap-2 px-6 pt-6">
          <img src={logoWhite} alt="House of Ichigo" className="h-6 w-6" />
          <span className="text-[14px] font-medium text-white">House of Ichigo</span>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1080px] flex-col justify-center px-6 py-24">
          <p
            className="font-mono text-[11px] font-medium uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--ichigo-orange)" }}
          >
            The AI Transformation Platform
          </p>
          <h1
            className="mt-5 max-w-[14ch] font-display font-light text-white"
            style={{
              fontSize: "clamp(48px, 7vw, 72px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
            }}
          >
            From AI exploration to AI <span className="accent-italic">execution.</span>
          </h1>
          <p
            className="mt-6 max-w-[560px] font-sans text-[18px]"
            style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}
          >
            Equip your team to build, govern, and scale real AI systems — not slides about
            frameworks.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-ichigo btn-ichigo-primary">
              Get started
            </Link>
            <Link to="/login" className="btn-ichigo btn-ichigo-outline-light">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Conviction */}
      <section className="bg-paper">
        <div className="mx-auto max-w-[1080px] px-6 py-24">
          <p className="eyebrow-muted">Platform · What you ship</p>
          <h2 className="h-display-lg mt-3 max-w-[20ch]">
            Built to deliver, not to <span className="accent-italic">decorate.</span>
          </h2>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <article key={p.eyebrow} className="card card-elevate">
                <p className="eyebrow">{p.eyebrow}</p>
                <h3 className="h-heading-md mt-3">
                  {p.title} <span className="accent-italic">{p.accent}</span>
                </h3>
                <p className="mt-3 text-[15px] text-graphite">{p.body}</p>
              </article>
            ))}
          </div>
        </div>

        <footer className="border-t border-chalk">
          <div className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-8">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-navy">House of Ichigo</span>
            </div>
            <p className="ichigo-footer">
              Equipped to <span className="accent">run.</span>
            </p>
          </div>
        </footer>
      </section>
    </div>
  );
}
