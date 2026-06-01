import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { useUseCaseProfile } from "@/hooks/useUseCaseProfile";
import { useOnboardingChecklist, useOnboardingMutations } from "@/hooks/useOnboardingChecklist";
import { WORKSPACE_PROFILE_SCHEMA } from "@/lib/profile/workspace-profile";
import { supabase } from "@/integrations/supabase/client";
import { UserProfileCard } from "@/components/profile/UserProfileCard";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$workspaceSlug/settings")({
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  const { workspace, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const { data, isComplete } = useWorkspaceProfile();
  const { data: checklist } = useOnboardingChecklist();
  const { restoreChecklist } = useOnboardingMutations();
  const qc = useQueryClient();
  const defaultWorkspace = useQuery({
    enabled: !!user,
    queryKey: ["profile-default-workspace", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.default_workspace_id ?? null;
    },
  });
  const setDefaultWorkspace = useMutation({
    mutationFn: async () => {
      if (!user || !workspace) throw new Error("Workspace not ready");
      const { error } = await supabase
        .from("profiles")
        .update({ default_workspace_id: workspace.id })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-default-workspace", user?.id] });
      qc.invalidateQueries({ queryKey: ["app-index-bootstrap", user?.id] });
      toast.success("Default workspace updated");
    },
    onError: (error) => toast.error((error as Error).message),
  });
  if (!workspace) return null;

  return (
    <div>
      <p className="eyebrow-muted">Workspace · Settings</p>
      <h1 className="h-display-md mt-3">
        Workspace <span className="accent-italic">settings.</span>
      </h1>
      <p className="lead mt-4 max-w-[60ch]">
        Manage company context, use-case context, personal details, and notification preferences.
      </p>

      <div className="card mt-10 max-w-[560px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">Current workspace</p>
            <p className="h-heading-md mt-2">{workspace.name}</p>
            <p className="mt-2 font-mono text-[12px] tracking-[0.1em] text-slate">{workspace.slug}</p>
          </div>
          {defaultWorkspace.data === workspace.id ? (
            <span className="rounded-full border border-chalk bg-mist px-3 py-1 text-[12px] text-slate">
              Default
            </span>
          ) : (
            <button
              type="button"
              disabled={setDefaultWorkspace.isPending}
              onClick={() => setDefaultWorkspace.mutate()}
              className="btn-ichigo btn-ichigo-outline shrink-0 text-[13px]"
            >
              {setDefaultWorkspace.isPending ? "Saving…" : "Set default"}
            </button>
          )}
        </div>
      </div>

      <MembersCard workspaceName={workspace.name} workspaceSlug={workspace.slug} isAdmin={isAdmin} />

      <div className="card mt-6 max-w-[560px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow-muted">Onboarding checklist</p>
            <p className="mt-2 text-[14px] text-graphite">
              {checklist?.dismissedAt
                ? "The setup checklist is hidden. Restore it if you want the guided path back on the workspace home."
                : checklist?.shouldRender
                  ? "The setup checklist is visible on the workspace home."
                  : "The checklist appears for fresh admin workspaces while setup is still active."}
            </p>
          </div>
          {isAdmin && checklist?.dismissedAt && (
            <button
              type="button"
              disabled={restoreChecklist.isPending}
              onClick={() => {
                restoreChecklist.mutate(undefined, {
                  onSuccess: () => toast.success("Checklist restored"),
                  onError: (e) => toast.error((e as Error).message),
                });
              }}
              className="btn-ichigo btn-ichigo-outline shrink-0 text-[13px]"
            >
              {restoreChecklist.isPending ? "Restoring…" : "Restore"}
            </button>
          )}
        </div>
      </div>



      <div className="card mt-6 max-w-[560px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow-muted">Company profile</p>
            <p className="mt-2 text-[14px] text-graphite">
              {isComplete
                ? "Your company profile is set. Examples, Discover recommendations, and EU governance guidance use these values."
                : "Set up your company profile so examples, recommendations, and EU/HOI governance guidance use your real context."}
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

function MembersCard({
  workspaceName,
  workspaceSlug,
  isAdmin,
}: {
  workspaceName: string;
  workspaceSlug: string;
  isAdmin: boolean;
}) {
  return (
    <div className="card mt-6 max-w-[560px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow-muted">Members</p>
          <p className="mt-2 text-[14px] text-graphite">
            {isAdmin
              ? <>Invite teammates to <span className="text-navy">{workspaceName}</span> and choose the right access level for each person.</>
              : <>View your workspace membership. Ask an owner or admin to invite additional teammates.</>}
          </p>
        </div>
        {isAdmin ? (
          <Link
            to="/app/$workspaceSlug/invite"
            params={{ workspaceSlug }}
            className="btn-ichigo btn-ichigo-outline shrink-0 text-[13px]"
            aria-label="Invite teammates"
          >
            Invite
          </Link>
        ) : (
          <span className="rounded-full border border-chalk bg-mist px-3 py-1 text-[12px] text-slate">
            Read-only
          </span>
        )}
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
