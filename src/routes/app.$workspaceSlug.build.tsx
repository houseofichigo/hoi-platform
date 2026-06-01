import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Hammer } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/app/$workspaceSlug/build")({
  component: BuildLayout,
});

function BuildLayout() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  if (!workspace) return null;
  const tabs: ReadonlyArray<{ to: string; label: string; exact?: boolean }> = [
    { to: "/app/$workspaceSlug/build", label: "Overview", exact: true },
    { to: "/app/$workspaceSlug/build/capture", label: "Intake" },
    { to: "/app/$workspaceSlug/build/library", label: "Use Case Library" },
    { to: "/app/$workspaceSlug/build/dashboard", label: "Priority Dashboard" },
    { to: "/app/$workspaceSlug/build/approvals", label: "Approvals" },
  ];
  const base = `/app/${workspace.slug}/build`;
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">BUILD · USE CASES</p>
        <h1 className="h-display-md mt-2 flex items-center gap-3">
          <Hammer className="h-6 w-6 text-terracotta" />
          Capture, score, approve.
        </h1>
        <p className="lead mt-2 max-w-[60ch]">
          Map business processes into structured use cases. Score them, prioritize, and approve the ones that move on to Deploy.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-chalk">
        {tabs.map((t) => {
          const resolved = t.to.replace("$workspaceSlug", workspace.slug);
          const active = t.exact
            ? location.pathname === base || location.pathname === `${base}/`
            : location.pathname.startsWith(resolved);
          return (
            <Link
              key={t.label}
              to={t.to as "/app/$workspaceSlug/build"}
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
