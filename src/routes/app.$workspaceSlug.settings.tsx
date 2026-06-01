import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { useUseCaseProfile } from "@/hooks/useUseCaseProfile";
import { WORKSPACE_PROFILE_SCHEMA } from "@/lib/profile/workspace-profile";
import { UserProfileCard } from "@/components/profile/UserProfileCard";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";

export const Route = createFileRoute("/app/$workspaceSlug/settings")({
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  const { workspace } = useWorkspace();
  const { data, isComplete } = useWorkspaceProfile();
  if (!workspace) return null;

  return (
    <div>
      <p className="eyebrow-muted">Workspace · Settings</p>
      <h1 className="h-display-md mt-3">
        Workspace <span className="accent-italic">settings.</span>
      </h1>
      <p className="lead mt-4 max-w-[60ch]">
        Manage your profile, company context, and notification preferences.
      </p>

      <div className="card mt-10 max-w-[560px]">
        <p className="eyebrow-muted">Current workspace</p>
        <p className="h-heading-md mt-2">{workspace.name}</p>
        <p className="mt-2 font-mono text-[12px] tracking-[0.1em] text-slate">{workspace.slug}</p>
      </div>

      <MembersCard workspaceName={workspace.name} />



      <div className="card mt-6 max-w-[560px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow-muted">Company profile</p>
            <p className="mt-2 text-[14px] text-graphite">
              {isComplete
                ? "Your company profile is set. Examples across the training use these values."
                : "Set up your company profile so examples are generated from your real context."}
            </p>
          </div>
          <Link
            to="/app/$workspaceSlug/onboarding/workspace-profile"
            params={{ workspaceSlug: workspace.slug }}
            search={{ return_to: `/app/${workspace.slug}/settings` }}
            className={
              isComplete
                ? "btn-ichigo btn-ichigo-outline shrink-0 text-[13px]"
                : "btn-ichigo btn-ichigo-primary shrink-0 text-[13px]"
            }
          >
            {isComplete ? "Edit" : "Set up"}
          </Link>
        </div>

        {isComplete && data && (
          <dl className="mt-5 divide-y divide-chalk border-t border-chalk">
            {WORKSPACE_PROFILE_SCHEMA.map((field) => {
              const v = data[field.key];
              const display = Array.isArray(v) ? v.join(", ") : (v as string) ?? "—";
              return (
                <div key={field.key} className="grid grid-cols-3 gap-3 py-3">
                  <dt className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
                    {field.label}
                  </dt>
                  <dd className="col-span-2 text-[14px] text-navy">{display || "—"}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>

      <UseCaseProfileCard slug={workspace.slug} />

      <UserProfileCard />

      <NotificationPreferencesCard />
    </div>
  );
}

function MembersCard({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="card mt-6 max-w-[560px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow-muted">Members</p>
          <p className="mt-2 text-[14px] text-graphite">
            You're the only member of <span className="text-navy">{workspaceName}</span>. Multi-seat
            invites and roles ship in a later release.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="btn-ichigo btn-ichigo-outline shrink-0 cursor-not-allowed text-[13px] opacity-60"
          aria-label="Invite teammates (coming soon)"
          title="Coming soon"
        >
          Invite
        </button>
      </div>
    </div>
  );
}

function UseCaseProfileCard({ slug }: { slug: string }) {

  const { data, isComplete, schema, workedExample } = useUseCaseProfile();

  if (!workedExample) return null;

  return (
    <div className="card mt-6 max-w-[560px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow-muted">Use-case profile · {workedExample.shortName}</p>
          <p className="mt-2 text-[14px] text-graphite">
            {isComplete
              ? "Saved. The training uses these values in every example."
              : "Tell us how your team runs this workflow so assignments use your real context."}
          </p>
        </div>
        <Link
          to="/app/$workspaceSlug/onboarding/use-case-profile"
          params={{ workspaceSlug: slug }}
          search={{ return_to: `/app/${slug}/settings` }}
          className={
            isComplete
              ? "btn-ichigo btn-ichigo-outline shrink-0 text-[13px]"
              : "btn-ichigo btn-ichigo-primary shrink-0 text-[13px]"
          }
        >
          {isComplete ? "Edit" : "Set up"}
        </Link>
      </div>

      {isComplete && data && (
        <dl className="mt-5 divide-y divide-chalk border-t border-chalk">
          {schema.map((field) => {
            const v = data[field.key];
            const display = Array.isArray(v) ? v.join(", ") : (v as string) ?? "—";
            return (
              <div key={field.key} className="grid grid-cols-3 gap-3 py-3">
                <dt className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
                  {field.label}
                </dt>
                <dd className="col-span-2 text-[14px] text-navy">{display || "—"}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
