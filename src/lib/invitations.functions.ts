import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Resend } from "resend";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";

// PRODUCTION: switch FROM_EMAIL to "House of Ichigo <invites@houseofichigo.com>"
// once the domain is verified in Resend.
const FROM_EMAIL = "House of Ichigo <onboarding@resend.dev>";

const InviteInput = z.object({
  workspace_id: z.string().uuid(),
  email: z.string().email().max(255).transform((v) => v.trim().toLowerCase()),
  role: z.enum(["member", "viewer"]),
  origin: z.string().url().optional(),
});

function genToken() {
  return crypto.randomUUID();
}

function buildInviteEmailHtml(opts: {
  workspaceName: string;
  inviterLabel: string;
  acceptUrl: string;
}) {
  const { workspaceName, inviterLabel, acceptUrl } = opts;
  const safeName = workspaceName.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  const safeInviter = inviterLabel.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're invited to join ${safeName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,144,400&family=Inter+Tight:wght@400;500&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#FAFAF7;font-family:'Inter Tight',Arial,sans-serif;color:#1E2B4D;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid #E8E8E3;border-radius:8px;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 24px 0;font-family:'JetBrains Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#CF5B2B;">HOUSE OF ICHIGO</p>
                <p style="margin:0;font-family:'Inter Tight',Arial,sans-serif;font-size:16px;line-height:1.4;color:#1E2B4D;">You're invited to join</p>
                <h1 style="margin:4px 0 24px 0;font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:400;font-size:32px;line-height:1.15;color:#CF5B2B;">${safeName}</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#3D3D3A;">${safeInviter} invited you to join <strong style="color:#1E2B4D;">${safeName}</strong> on the House of Ichigo platform &mdash; your team's workspace for AI use case scoping, build, and deployment governance.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td style="background:#CF5B2B;border-radius:6px;">
                      <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;font-family:'Inter Tight',Arial,sans-serif;font-size:14px;font-weight:500;color:#FFFFFF;text-decoration:none;">Accept invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#6B6B66;">This invitation expires in 7 days. If you don't have a House of Ichigo account yet, you'll be prompted to create one.</p>
                <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #E8E8E3;font-family:'JetBrains Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#6B6B66;">Equipped to <span style="color:#CF5B2B;">RUN.</span></p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#6B6B66;">If the button doesn't work, copy and paste this link: <a href="${acceptUrl}" style="color:#3B82F6;">${acceptUrl}</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const sendWorkspaceInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Authorization: caller must be owner/admin of workspace
    const { data: roleRow, error: roleErr } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow || !["owner", "admin"].includes(roleRow.role)) {
      throw new Error("You do not have permission to invite members.");
    }

    // 2. Fetch workspace + inviter
    const [{ data: ws, error: wsErr }, { data: inviterProfile }] = await Promise.all([
      supabase.from("workspaces").select("id, name, slug").eq("id", data.workspace_id).single(),
      supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (wsErr || !ws) throw new Error("Workspace not found");

    // 3. Upsert invitation: regenerate token if pending exists
    const token = genToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existing } = await supabase
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", data.workspace_id)
      .ilike("email", data.email)
      .eq("status", "pending")
      .maybeSingle();

    let invitation;
    if (existing) {
      const { data: upd, error: updErr } = await supabase
        .from("workspace_invitations")
        .update({
          token,
          expires_at: expiresAt,
          role: data.role,
          invited_by: userId,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updErr) throw new Error(updErr.message);
      invitation = upd;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: data.workspace_id,
          email: data.email,
          role: data.role,
          invited_by: userId,
          token,
          status: "pending",
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      invitation = ins;
    }

    // 4. Send email
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Email service not configured — contact administrator");
    }

    const origin = data.origin
      ?? getRequestHeader("origin")
      ?? `https://${getRequestHeader("host") ?? "localhost"}`;
    const acceptUrl = `${origin.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;

    const inviterLabel = inviterProfile?.full_name || context.claims?.email || "A teammate";
    const html = buildInviteEmailHtml({
      workspaceName: ws.name,
      inviterLabel,
      acceptUrl,
    });

    try {
      const resend = new Resend(apiKey);
      const { error: sendErr } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [data.email],
        subject: `You're invited to join ${ws.name} on House of Ichigo`,
        html,
      });
      if (sendErr) throw new Error(sendErr.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      throw new Error(`Email service error: ${msg}`);
    }

    return { invitation, workspace: ws };
  });
