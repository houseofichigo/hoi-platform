import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_KINDS,
  DEFAULT_EMAIL_ENABLED,
  type NotificationKind,
} from "@/lib/notifications/preferences";
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from "@/lib/notifications/preferences.functions";

export function NotificationPreferencesCard() {
  const qc = useQueryClient();
  const fetchPrefs = useServerFn(getNotificationPreferences);
  const updatePref = useServerFn(updateNotificationPreference);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => fetchPrefs(),
  });

  const prefMap = useMemo(() => {
    const m = new Map<NotificationKind, boolean>();
    for (const row of data ?? []) m.set(row.kind, row.email_enabled);
    return m;
  }, [data]);

  const mutate = useMutation({
    mutationFn: (vars: { kind: NotificationKind; email_enabled: boolean }) =>
      updatePref({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["notification-preferences"] });
      const prev = qc.getQueryData(["notification-preferences"]);
      qc.setQueryData(["notification-preferences"], (old: { kind: NotificationKind; email_enabled: boolean }[] | undefined) => {
        const next = (old ?? []).filter((r) => r.kind !== vars.kind);
        next.push(vars);
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notification-preferences"], ctx.prev);
      toast.error("Could not update preference.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  const groups = useMemo(() => {
    const g = new Map<string, typeof NOTIFICATION_KINDS>();
    for (const k of NOTIFICATION_KINDS) {
      const list = g.get(k.group) ?? [];
      list.push(k);
      g.set(k.group, list);
    }
    return Array.from(g.entries());
  }, []);

  return (
    <div className="card mt-6 max-w-[560px]">
      <p className="eyebrow-muted">Notification preferences</p>
      <p className="mt-2 text-[14px] text-graphite">
        Choose which notifications also send you an email. In-app notifications are always shown
        in the bell menu.
      </p>

      {isLoading ? (
        <p className="mt-5 text-[13px] text-slate">Loading…</p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
                {group}
              </p>
              <ul className="mt-3 divide-y divide-chalk border-t border-chalk">
                {items.map((item) => {
                  const enabled = prefMap.get(item.kind) ?? DEFAULT_EMAIL_ENABLED;
                  return (
                    <li key={item.kind} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-navy">{item.label}</p>
                        <p className="mt-0.5 text-[13px] text-graphite">{item.description}</p>
                      </div>
                      <Switch
                        checked={enabled}
                        disabled={mutate.isPending}
                        onCheckedChange={(checked) =>
                          mutate.mutate({ kind: item.kind, email_enabled: checked })
                        }
                        aria-label={`Email me for ${item.label}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
