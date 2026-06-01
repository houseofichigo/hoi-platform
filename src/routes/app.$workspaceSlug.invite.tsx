import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { sendWorkspaceInvite } from "@/lib/invitations.functions";
import { revokeWorkspaceInvitation } from "@/lib/workspace-admin.functions";

export const Route = createFileRoute("/app/$workspaceSlug/invite")({
  component: InvitePage,
});

const EmailSchema = z.string().trim().toLowerCase().email();

function InvitePage() {
  const { workspace, isAdmin, loading } = useWorkspace();
  const qc = useQueryClient();
  const sendInvite = useServerFn(sendWorkspaceInvite);
  const revokeInvite = useServerFn(revokeWorkspaceInvitation);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [submitting, setSubmitting] = useState(false);

  const pendingQuery = useQuery({
    enabled: !!workspace,
    queryKey: ["pending-invitations", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("id, email, role, invited_by, created_at, expires_at, status")
        .eq("workspace_id", workspace!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const inviterIds = Array.from(new Set(data.map((d) => d.invited_by).filter(Boolean))) as string[];
      const inviters: Record<string, string> = {};
      if (inviterIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", inviterIds);
        profiles?.forEach((p) => {
          if (p.full_name) inviters[p.user_id] = p.full_name;
        });
      }
      return data.map((d) => ({ ...d, inviterName: d.invited_by ? inviters[d.invited_by] ?? null : null }));
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      if (!workspace) throw new Error("Workspace not ready");
      await revokeInvite({ data: { workspaceId: workspace.id, invitationId: id } });
    },
    onSuccess: () => {
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: ["pending-invitations", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["workspace-admin", "members", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["workspace-admin", "overview", workspace?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return <p className="text-[13px] text-slate">Loading…</p>;
  }

  if (!workspace) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[640px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">PERMISSION DENIED</p>
        <h1 className="mt-3 font-display text-[36px] leading-tight text-navy">
          Only admins can <span className="accent-italic">invite.</span>
        </h1>
        <p className="mt-3 text-[15px] text-graphite">You don't have permission to invite members to this workspace.</p>
        <Link
          to="/app/$workspaceSlug"
          params={{ workspaceSlug: workspace.slug }}
          className="mt-6 inline-block text-[13px] text-azure hover:underline"
        >
          ← Back to workspace
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await sendInvite({
        data: {
          workspace_id: workspace.id,
          email: parsed.data,
          role,
          origin: window.location.origin,
        },
      });
      toast.success(`Invitation sent to ${parsed.data}`);
      setEmail("");
      setRole("member");
      qc.invalidateQueries({ queryKey: ["pending-invitations", workspace.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async (inviteEmail: string, inviteRole: "member" | "viewer") => {
    if (!confirm(`Resend invitation to ${inviteEmail}?`)) return;
    try {
      await sendInvite({
        data: {
          workspace_id: workspace.id,
          email: inviteEmail,
          role: inviteRole,
          origin: window.location.origin,
        },
      });
      toast.success(`Invitation resent to ${inviteEmail}`);
      qc.invalidateQueries({ queryKey: ["pending-invitations", workspace.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
    }
  };

  const onRevoke = (id: string) => {
    if (!confirm("Revoke invitation? They will no longer be able to join with this link.")) return;
    revoke.mutate(id);
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
        WORKSPACE · INVITE MEMBERS
      </p>
      <h1 className="mt-3 font-display text-[40px] font-light leading-tight text-navy">
        Invite to <span className="accent-italic">{workspace.name}.</span>
      </h1>
      <p className="mt-3 text-[16px] text-graphite">
        Add people to your workspace. They'll receive an email with a link to join. Workspace admin access is granted by House of Ichigo.
      </p>

      {/* Send invitation */}
      <section className="mt-10 rounded-lg border border-chalk bg-white p-6">
        <h2 className="text-[14px] font-medium text-navy">Send new invitation</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[13px] font-medium text-navy">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-ichigo mt-1.5"
              placeholder="teammate@company.com"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-navy">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "viewer")}
              className="input-ichigo mt-1.5"
            >
              <option value="member">Member — can use the workspace</option>
              <option value="viewer">Viewer — read-only access</option>
            </select>
            <span className="mt-1.5 block text-[12px] text-slate">
              Client admin and owner roles are managed by House of Ichigo from the internal admin console.
            </span>
          </label>
          <button type="submit" disabled={submitting} className="btn-ichigo btn-ichigo-primary">
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      {/* Pending invitations */}
      <section className="mt-10">
        <h2 className="text-[14px] font-medium text-navy">Pending invitations</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-chalk bg-white">
          {pendingQuery.isLoading ? (
            <p className="p-6 text-center text-[13px] text-slate">Loading…</p>
          ) : !pendingQuery.data?.length ? (
            <p className="p-8 text-center text-[14px] italic text-slate">No pending invitations.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-chalk bg-mist text-left font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                <tr>
                  <th className="px-4 py-3 font-normal">Email</th>
                  <th className="px-4 py-3 font-normal">Role</th>
                  <th className="px-4 py-3 font-normal">Sent</th>
                  <th className="px-4 py-3 font-normal">Expires</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pendingQuery.data.map((inv) => (
                  <tr key={inv.id} className="border-t border-chalk text-navy">
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3 capitalize">{inv.role}</td>
                    <td className="px-4 py-3 text-slate">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate">{new Date(inv.expires_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.role === "member" || inv.role === "viewer" ? (
                        <button
                          onClick={() => onResend(inv.email, inv.role as "member" | "viewer")}
                          className="mr-3 text-[12px] text-azure hover:underline"
                        >
                          Resend
                        </button>
                      ) : (
                        <span className="mr-3 text-[12px] text-slate" title="Ask House of Ichigo to manage admin invitations.">
                          HOI managed
                        </span>
                      )}
                      <button
                        onClick={() => onRevoke(inv.id)}
                        className="text-[12px] text-danger hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
