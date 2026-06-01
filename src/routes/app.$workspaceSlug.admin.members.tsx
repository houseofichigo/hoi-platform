import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getWorkspaceAdminMembers } from "@/lib/workspace-admin.functions";

export const Route = createFileRoute("/app/$workspaceSlug/admin/members")({
  component: WorkspaceAdminMembersPage,
});

function WorkspaceAdminMembersPage() {
  const { workspace } = useWorkspace();
  const getMembers = useServerFn(getWorkspaceAdminMembers);
  const { data, isLoading, error } = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-admin", "members", workspace?.id],
    queryFn: () => getMembers({ data: { workspaceId: workspace!.id } }),
  });

  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-chalk bg-white p-5">
        <div>
          <p className="eyebrow-muted">Team access</p>
          <h2 className="mt-2 text-[22px] font-semibold text-navy">Members and invitations.</h2>
          <p className="mt-2 max-w-[64ch] text-[13px] text-graphite">
            Invite members and viewers. Owner/admin promotions are handled by House of Ichigo so client super-user access stays controlled.
          </p>
        </div>
        <Link
          to="/app/$workspaceSlug/invite"
          params={{ workspaceSlug: workspace.slug }}
          className="btn-ichigo btn-ichigo-primary text-[13px]"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite people
        </Link>
      </section>

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading members...</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : data ? (
        <>
          <section className="overflow-hidden rounded-md border border-chalk bg-white">
            <div className="border-b border-chalk px-4 py-3">
              <p className="eyebrow-muted">Current members</p>
            </div>
            <table className="w-full text-[13px]">
              <thead className="bg-mist text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                <tr>
                  <th className="px-4 py-3 font-normal">User</th>
                  <th className="px-4 py-3 font-normal">Role</th>
                  <th className="px-4 py-3 font-normal">Profile</th>
                  <th className="px-4 py-3 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.user_id} className="border-t border-chalk text-navy">
                    <td className="px-4 py-3">
                      <p className="font-medium">{member.full_name || member.email || "Unnamed member"}</p>
                      <p className="text-[12px] text-slate">{member.email || member.user_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] capitalize text-slate">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {[member.job_role, member.department].filter(Boolean).join(" · ") || "Not set"}
                    </td>
                    <td className="px-4 py-3 text-slate">{new Date(member.joined_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-md border border-chalk bg-white">
            <div className="border-b border-chalk px-4 py-3">
              <p className="eyebrow-muted">Pending invitations</p>
            </div>
            {data.pendingInvitations.length === 0 ? (
              <p className="p-6 text-[13px] text-slate">No pending invitations.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-mist text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                  <tr>
                    <th className="px-4 py-3 font-normal">Email</th>
                    <th className="px-4 py-3 font-normal">Role</th>
                    <th className="px-4 py-3 font-normal">Sent</th>
                    <th className="px-4 py-3 font-normal">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingInvitations.map((invite) => (
                    <tr key={invite.id} className="border-t border-chalk text-navy">
                      <td className="px-4 py-3">{invite.email}</td>
                      <td className="px-4 py-3 capitalize">{invite.role}</td>
                      <td className="px-4 py-3 text-slate">{new Date(invite.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate">{new Date(invite.expires_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
