import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Settings, UserPlus } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/app/$workspaceSlug/admin/settings")({
  component: WorkspaceAdminSettingsPage,
});

function WorkspaceAdminSettingsPage() {
  const { workspace } = useWorkspace();
  if (!workspace) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ShortcutCard
        icon={Settings}
        title="Workspace settings"
        body="Default workspace, setup checklist, personal profile, and notification preferences."
        to="/app/$workspaceSlug/settings"
        slug={workspace.slug}
      />
      <ShortcutCard
        icon={Building2}
        title="Company profile"
        body="Company context used by recommendations, examples, and governance guidance."
        to="/app/$workspaceSlug/onboarding/workspace-profile"
        slug={workspace.slug}
      />
      <ShortcutCard
        icon={Building2}
        title="Use-case profile"
        body="Primary use-case context used to tailor the learning and Build experience."
        to="/app/$workspaceSlug/onboarding/use-case-profile"
        slug={workspace.slug}
      />
      <ShortcutCard
        icon={UserPlus}
        title="Invite team"
        body="Invite members and viewers. Owner/admin promotions are handled by House of Ichigo."
        to="/app/$workspaceSlug/invite"
        slug={workspace.slug}
      />
    </div>
  );
}

function ShortcutCard({
  icon: Icon,
  title,
  body,
  to,
  slug,
}: {
  icon: typeof Settings;
  title: string;
  body: string;
  to:
    | "/app/$workspaceSlug/settings"
    | "/app/$workspaceSlug/onboarding/workspace-profile"
    | "/app/$workspaceSlug/onboarding/use-case-profile"
    | "/app/$workspaceSlug/invite";
  slug: string;
}) {
  return (
    <Link to={to} params={{ workspaceSlug: slug }} className="rounded-md border border-chalk bg-white p-5 hover:border-terracotta">
      <Icon className="h-5 w-5 text-terracotta" />
      <p className="mt-4 text-[16px] font-semibold text-navy">{title}</p>
      <p className="mt-2 text-[13px] text-graphite">{body}</p>
    </Link>
  );
}
