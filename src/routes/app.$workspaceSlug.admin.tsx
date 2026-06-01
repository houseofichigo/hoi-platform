import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { BarChart3, CreditCard, ReceiptText, Settings, Shield, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/app/$workspaceSlug/admin")({
  component: WorkspaceAdminLayout,
});

const tabs = [
  { to: "/app/$workspaceSlug/admin", label: "Overview", icon: Shield, exact: true },
  { to: "/app/$workspaceSlug/admin/members", label: "Members", icon: Users, exact: false },
  { to: "/app/$workspaceSlug/admin/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { to: "/app/$workspaceSlug/admin/billing", label: "Billing", icon: CreditCard, exact: false },
  { to: "/app/$workspaceSlug/admin/invoices", label: "Invoices", icon: ReceiptText, exact: false },
  { to: "/app/$workspaceSlug/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function WorkspaceAdminLayout() {
  const { workspace, isAdmin, loading } = useWorkspace();
  const location = useLocation();

  if (loading) return <p className="text-[13px] text-slate">Loading...</p>;
  if (!workspace) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[640px] rounded-lg border border-chalk bg-white p-8 text-center">
        <p className="eyebrow">WORKSPACE · ADMIN</p>
        <h1 className="h-display-md mt-3">
          Admin access <span className="accent-italic">required.</span>
        </h1>
        <p className="lead mt-3">
          This area is for workspace owners and admins. Ask your House of Ichigo contact if your role needs to change.
        </p>
        <Link
          to="/app/$workspaceSlug"
          params={{ workspaceSlug: workspace.slug }}
          className="btn-ichigo btn-ichigo-outline mt-6"
        >
          Back to workspace
        </Link>
      </div>
    );
  }

  const base = `/app/${workspace.slug}/admin`;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">WORKSPACE · ADMIN</p>
        <h1 className="h-display-md mt-2">
          Manage <span className="accent-italic">{workspace.name}.</span>
        </h1>
        <p className="lead mt-2 max-w-[68ch]">
          Manage team onboarding, usage, seats, billing visibility, and workspace setup. House of Ichigo controls owner and admin promotions.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-chalk">
        {tabs.map((tab) => {
          const resolved = tab.to.replace("$workspaceSlug", workspace.slug);
          const active = tab.exact
            ? location.pathname === base || location.pathname === `${base}/`
            : location.pathname.startsWith(resolved);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              to={tab.to}
              params={{ workspaceSlug: workspace.slug }}
              className={[
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px]",
                active ? "border-terracotta font-medium text-navy" : "border-transparent text-graphite hover:text-navy",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
