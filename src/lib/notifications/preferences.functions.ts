import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NOTIFICATION_KINDS, type NotificationKind } from "./preferences";

const VALID_KINDS = NOTIFICATION_KINDS.map((k) => k.kind) as [NotificationKind, ...NotificationKind[]];

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("kind, email_enabled");
    if (error) throw new Error(error.message);
    return (data ?? []) as { kind: NotificationKind; email_enabled: boolean }[];
  });

const UpdateInput = z.object({
  kind: z.enum(VALID_KINDS),
  email_enabled: z.boolean(),
});

export const updateNotificationPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: userId, kind: data.kind, email_enabled: data.email_enabled },
        { onConflict: "user_id,kind" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
