import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/app/$workspaceSlug/scale")({
  component: ScaleLayout,
});

function ScaleLayout() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  if (!workspace) return null;
  const tabs: ReadonlyArray<{ to: string; label: string; exact?: boolean; review?: boolean }> = [
    { to: "/app/$workspaceSlug/scale", label: "Overview", exact: true },
    { to: "/app/$workspaceSlug/scale/roadmap", label: "Roadmap" },
    { to: "/app/$workspaceSlug/scale/governance", label: "Governance" },
    { to: "/app/$workspaceSlug/scale/reviews", label: "Pilot Reviews", review: true },
    { to: "/app/$workspaceSlug/scale/audit", label: "Audit" },
  ];

  const base = `/app/${workspace.slug}/scale`;
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">SCALE · ROADMAP &amp; GOVERNANCE</p>
        <h1 className="h-display-md mt-2 flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-terracotta" />
          Ship and govern.
        </h1>
        <p className="lead mt-2 max-w-[60ch]">
          Move scored use cases from backlog to production. Track governance compliance. Build the evidence trail.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-chalk">
        {tabs.map((t) => {
          const tabPath = t.to.replace("$workspaceSlug", workspace.slug);
          const active = t.exact
            ? location.pathname === base || location.pathname === `${base}/`
            : t.review
              ? location.pathname.startsWith(tabPath) || /^\/app\/[^/]+\/scale\/[^/]+\/review$/.test(location.pathname)
              : location.pathname.startsWith(tabPath);
          return (
            <Link
              key={t.label}
              to={t.to as "/app/$workspaceSlug/scale"}
              params={{ workspaceSlug: workspace.slug }}
              className={[
                "px-3 py-2 text-[13px] -mb-px border-b-2",
                active ? "border-terracotta text-navy font-medium" : "border-transparent text-graphite hover:text-navy",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
