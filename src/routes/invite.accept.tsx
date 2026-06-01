import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";

type Search = { token?: string };

export const Route = createFileRoute("/invite/accept")({
  component: AcceptInvitePage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);

  const inviteQuery = useQuery({
    enabled: !!token,
    queryKey: ["invitation", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const invitation = inviteQuery.data;
  const isExpired = invitation && new Date(invitation.expires_at).getTime() <= Date.now();
  const unavailableReason = !invitation
    ? "missing"
    : isExpired
      ? "expired"
      : invitation.status === "accepted"
        ? "accepted"
        : invitation.status !== "pending"
          ? "unavailable"
          : null;
  const emailMatches =
    user?.email && invitation && user.email.toLowerCase() === invitation.email.toLowerCase();

  useEffect(() => {
    if (!token) {
      // No token: send to login
    }
  }, [token]);

  if (!token) {
    return (
      <AuthCard eyebrow="Invitation" title={<>Missing <span className="accent-italic">token.</span></>}>
        <p className="text-[14px] text-graphite">This link is missing an invitation token.</p>
        <Link to="/login" className="mt-4 inline-block text-[13px] text-azure hover:underline">Go to login</Link>
      </AuthCard>
    );
  }

  if (inviteQuery.isLoading || authLoading) {
    return (
      <AuthCard eyebrow="Invitation" title={<>Looking up <span className="accent-italic">invite.</span></>}>
        <p className="text-[13px] text-slate">Please wait…</p>
      </AuthCard>
    );
  }

  if (unavailableReason) {
    const title =
      unavailableReason === "expired"
        ? "Invitation expired."
        : unavailableReason === "accepted"
          ? "Invitation already accepted."
          : "Invitation unavailable.";
    const body =
      unavailableReason === "expired"
        ? "This invitation has expired. Ask the workspace owner to send a new invite."
        : unavailableReason === "accepted"
          ? "This invitation has already been used. Log in to continue to your workspace."
          : "This invitation is invalid or has been revoked. Contact the workspace owner for a new invite.";
    return (
      <AuthCard eyebrow="Invitation" title={<>{title}</>}>
        <p className="text-[14px] text-graphite">{body}</p>
        <Link to="/login" className="mt-4 inline-block text-[13px] text-azure hover:underline">Go to login</Link>
      </AuthCard>
    );
  }
  if (!invitation) return null;

  // invitation present + pending
  const returnTo = `/invite/accept?token=${encodeURIComponent(token)}`;
  const expiresMs = new Date(invitation.expires_at).getTime() - Date.now();
  const expiresDays = Math.max(1, Math.ceil(expiresMs / (1000 * 60 * 60 * 24)));

  const onAccept = async () => {
    setAccepting(true);
    try {
      const { error } = await supabase.rpc("accept_workspace_invitation", { p_token: token });
      if (error) throw error;
      toast.success(`Welcome to ${invitation.workspace_name}`);
      navigate({ to: "/app/$workspaceSlug", params: { workspaceSlug: invitation.workspace_slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const onLogoutAndStart = async () => {
    await signOut();
    navigate({ to: "/signup", search: { invited_email: invitation.email, return_to: returnTo } });
  };

  return (
    <AuthCard
      eyebrow="WORKSPACE INVITATION"
      title={<>Join <span className="accent-italic">{invitation.workspace_name}.</span></>}
      subtitle={invitation.inviter_email ? `Invited by ${invitation.inviter_email}` : undefined}
    >
      <div className="space-y-3 rounded-md border border-chalk bg-mist p-4 text-[13px] text-navy">
        <div className="flex justify-between"><span className="text-slate">Email</span><span>{invitation.email}</span></div>
        <div className="flex justify-between"><span className="text-slate">Role</span><span className="capitalize">{invitation.role}</span></div>
        <div className="flex justify-between"><span className="text-slate">Expires in</span><span>{expiresDays} day{expiresDays === 1 ? "" : "s"}</span></div>
      </div>

      {user && emailMatches ? (
        <button
          onClick={onAccept}
          disabled={accepting}
          className="btn-ichigo btn-ichigo-primary mt-6 w-full"
        >
          {accepting ? "Joining…" : "Accept invitation"}
        </button>
      ) : user && !emailMatches ? (
        <div className="mt-6 space-y-4">
          <p className="text-[14px] text-graphite">
            This invitation was sent to <strong className="text-navy">{invitation.email}</strong>, but you're logged in as <strong className="text-navy">{user.email}</strong>. Log out and use the invited address, or contact the workspace owner for a new invitation.
          </p>
          <div className="flex gap-3">
            <button onClick={onLogoutAndStart} className="btn-ichigo btn-ichigo-outline flex-1">
              Log out
            </button>
            <button
              onClick={() => navigate({ to: "/app" })}
              className="btn-ichigo btn-ichigo-secondary flex-1"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <Link
            to="/login"
            search={{ invited_email: invitation.email, return_to: returnTo }}
            className="btn-ichigo btn-ichigo-primary block w-full text-center"
          >
            I already have an account
          </Link>
          <Link
            to="/signup"
            search={{ invited_email: invitation.email, return_to: returnTo }}
            className="btn-ichigo btn-ichigo-outline block w-full text-center"
          >
            Create a new account
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
