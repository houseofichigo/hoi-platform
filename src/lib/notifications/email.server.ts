/**
 * Email fan-out for in-app notifications. Honors per-user
 * `notification_preferences.email_enabled` (default: true when no row exists).
 *
 * Best-effort: any failure is logged and swallowed so business actions never
 * fail because email could not be sent.
 */
import { Resend } from "resend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_EMAIL_ENABLED,
  type NotificationKind,
} from "@/lib/notifications/preferences";

const FROM_EMAIL = "House of Ichigo <onboarding@resend.dev>";

type EmailRow = {
  recipient_user_id: string;
  workspace_id: string | null;
  kind: NotificationKind;
  subject: string;
  text: string;
};

async function getEmailOptedInUserIds(
  userIds: string[],
  kind: NotificationKind,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, email_enabled")
    .eq("kind", kind)
    .in("user_id", userIds);
  if (error) {
    console.error("[notify-email] prefs lookup failed", error);
    return DEFAULT_EMAIL_ENABLED ? new Set(userIds) : new Set();
  }
  const overrides = new Map((data ?? []).map((r) => [r.user_id, r.email_enabled]));
  const out = new Set<string>();
  for (const uid of userIds) {
    const v = overrides.get(uid);
    if (v === undefined ? DEFAULT_EMAIL_ENABLED : v) out.add(uid);
  }
  return out;
}

async function getUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // auth.admin.listUsers is paginated; for typical workspace sizes we fetch
  // and filter. Fine up to a few hundred users.
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[notify-email] listUsers failed", error);
      return out;
    }
    for (const u of data.users) {
      if (u.email && userIds.includes(u.id)) out.set(u.id, u.email);
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 25) break; // safety cap
  }
  return out;
}

export async function sendNotificationEmails(rows: EmailRow[]) {
  if (rows.length === 0) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notify-email] RESEND_API_KEY missing; skipping email fan-out");
    return;
  }

  // Group by kind to query prefs efficiently.
  const byKind = new Map<NotificationKind, EmailRow[]>();
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  const allUserIds = Array.from(new Set(rows.map((r) => r.recipient_user_id)));
  const emails = await getUserEmails(allUserIds);
  const resend = new Resend(apiKey);

  for (const [kind, kindRows] of byKind) {
    const optedIn = await getEmailOptedInUserIds(
      Array.from(new Set(kindRows.map((r) => r.recipient_user_id))),
      kind,
    );
    for (const r of kindRows) {
      if (!optedIn.has(r.recipient_user_id)) continue;
      const to = emails.get(r.recipient_user_id);
      if (!to) continue;
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [to],
          subject: r.subject,
          text: r.text,
        });
      } catch (e) {
        console.error("[notify-email] send failed", e);
      }
    }
  }
}
