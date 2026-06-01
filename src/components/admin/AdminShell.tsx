import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  CreditCard,
  FileClock,
  Home,
  Library,
  LifeBuoy,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHoiAdmin } from "@/hooks/useHoiAdmin";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: Home, canShow: () => true },
  { href: "/admin/library", label: "Library", icon: Library, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canManageContent },
  { href: "/admin/content", label: "Content Ops", icon: BookOpen, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canManageContent },
  { href: "/admin/users", label: "Users", icon: Users, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canSupportCustomers || admin.role === "read_only" },
  { href: "/admin/workspaces", label: "Workspaces", icon: Shield, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canSupportCustomers || admin.canManageBilling || admin.role === "read_only" },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canManageBilling || admin.role === "read_only" },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canSupportCustomers || admin.role === "read_only" },
  { href: "/admin/audit", label: "Audit", icon: FileClock, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canSupportCustomers || admin.role === "read_only" },
  { href: "/admin/settings", label: "Settings", icon: Settings, canShow: (admin: ReturnType<typeof useHoiAdmin>) => admin.canManageAdmins },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const admin = useHoiAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="card max-w-[420px] text-center">
          <p className="eyebrow">HOUSE OF ICHIGO · ADMIN</p>
          <h1 className="h-heading-md mt-3">Sign in required.</h1>
          <p className="mt-2 text-[14px] text-graphite">
            Use your House of Ichigo account to access the internal admin backend.
          </p>
          <a href="/login?return_to=/admin" className="btn-ichigo btn-ichigo-primary mt-5">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (admin.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-chalk border-t-terracotta" />
      </div>
    );
  }

  if (!admin.isHoiAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="card max-w-[460px] text-center">
          <p className="eyebrow">HOUSE OF ICHIGO · ADMIN</p>
          <h1 className="h-heading-md mt-3">Admin access required.</h1>
          <p className="mt-2 text-[14px] text-graphite">
            This backend is for House of Ichigo operators, not customer workspace admins.
          </p>
          <a href="/app" className="btn-ichigo btn-ichigo-outline mt-5">
            Back to app
          </a>
        </div>
      </div>
    );
  }

  const visibleNav = ADMIN_NAV.filter((item) => item.canShow(admin));

  return (
    <div className="min-h-screen bg-paper text-navy">
      <aside className="fixed inset-y-0 left-0 hidden w-[244px] border-r border-chalk bg-ink text-white lg:block">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">
            HOI Admin
          </p>
          <h1 className="mt-2 text-[18px] font-semibold">Operating console</h1>
          <p className="mt-1 text-[12px] text-white/55">Role: {admin.role}</p>
        </div>
        <nav className="space-y-1 p-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors",
                  active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[244px]">
        <header className="sticky top-0 z-30 border-b border-chalk bg-paper/95 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate">
                Internal backend
              </p>
              <p className="text-[13px] text-graphite">
                Manage customers, content, billing readiness, support, and platform operations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a href="/app" className="btn-ichigo btn-ichigo-outline text-[12px]">
                Customer app
              </a>
              <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate">
                <Activity className="h-3 w-3" />
                {admin.role}
              </span>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {visibleNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-chalk px-3 py-1 text-[12px] text-navy"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1180px] px-5 py-8">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  lead,
  action,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h-display-md mt-1">{title}</h1>
        {lead && <p className="lead mt-2 max-w-[68ch]">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

export function AdminStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-chalk bg-white p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none text-navy">{value}</p>
      {detail && <p className="mt-2 text-[12px] text-graphite">{detail}</p>}
    </div>
  );
}
