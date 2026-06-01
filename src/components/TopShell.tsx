import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  Compass,
  GraduationCap,
  Hammer,
  TrendingUp,
  Settings,
  Menu,
  Search,
  LogOut,
  UserPlus,
  Bell,
  Layers,
  Shield,
  ListChecks,
  ClipboardList,
  Map as MapIcon,
  FileText,
  Library as LibraryIcon,
  FlagTriangleLeft,
  ShieldCheck,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHoiAdmin } from "@/hooks/useHoiAdmin";
import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { NotificationsBell } from "@/components/NotificationsBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TYPE_LIST } from "@/lib/library/typeSchemas";
import logoNavy from "@/assets/logos/logo-navy-mark.png";

interface NavSubItem {
  label: string;
  to: string;
  splat?: string;
  icon: LucideIcon;
}

interface NavPhase {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  items: NavSubItem[];
}

export function buildPhases(): NavPhase[] {
  const libraryCategories = TYPE_LIST.map((s) => ({
    label: s.plural,
    to: "/app/$workspaceSlug/discover/$",
    splat: s.slug,
    icon: s.icon,
  }));

  return [
    {
      id: "assess",
      label: "Assess",
      icon: GraduationCap,
      to: "/app/$workspaceSlug/assess",
      items: [
        { label: "Modules", to: "/app/$workspaceSlug/assess", icon: ListChecks },
        { label: "Assignments", to: "/app/$workspaceSlug/assess/assignments", icon: ClipboardList },
        { label: "Artifacts", to: "/app/$workspaceSlug/assess/complete", icon: FileText },
      ],
    },
    {
      id: "discover",
      label: "Discover",
      icon: Compass,
      to: "/app/$workspaceSlug/discover",
      items: [
        { label: "Library Home", to: "/app/$workspaceSlug/discover", icon: LibraryIcon },
        ...libraryCategories,
      ],
    },
    {
      id: "build",
      label: "Build",
      icon: Hammer,
      to: "/app/$workspaceSlug/build",
      items: [
        { label: "Overview", to: "/app/$workspaceSlug/build", icon: Hammer },
        { label: "Intake", to: "/app/$workspaceSlug/build/capture", icon: ClipboardList },
        { label: "Use Case Library", to: "/app/$workspaceSlug/build/library", icon: LibraryIcon },
        { label: "Priority Dashboard", to: "/app/$workspaceSlug/build/dashboard", icon: Layers },
        { label: "Approvals", to: "/app/$workspaceSlug/build/approvals", icon: Inbox },
      ],
    },
    {
      id: "scale",
      label: "Scale",
      icon: TrendingUp,
      to: "/app/$workspaceSlug/scale",
      items: [
        { label: "Roadmap", to: "/app/$workspaceSlug/scale/roadmap", icon: MapIcon },
        { label: "Governance Flags", to: "/app/$workspaceSlug/scale/governance", icon: FlagTriangleLeft },
        { label: "Pilot Reviews", to: "/app/$workspaceSlug/scale", icon: Shield },
        { label: "Audit Log", to: "/app/$workspaceSlug/scale/audit", icon: ShieldCheck },
      ],
    },
  ];
}

export function TopShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { workspace, loading } = useWorkspace();
  const { isHoiAdmin } = useHoiAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl + K — global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const phases = useMemo(buildPhases, []);

  if (loading || !workspace) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-chalk border-t-terracotta" />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">Loading workspace…</p>
        </div>
      </div>
    );
  }

  const slug = workspace.slug;
  const isPhaseActive = (p: NavPhase) =>
    pathname.startsWith(p.to.replace("$workspaceSlug", slug));
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const navigateTo = (sub: NavSubItem) => {
    if (sub.splat) {
      navigate({
        to: sub.to as "/app/$workspaceSlug/discover/$",
        params: { workspaceSlug: slug, _splat: sub.splat },
      });
    } else {
      navigate({
        to: sub.to as "/app/$workspaceSlug",
        params: { workspaceSlug: slug },
      });
    }
    setSearchOpen(false);
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* Navy top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 md:px-6">
          {/* Brand */}
          <Link
            to="/app/$workspaceSlug"
            params={{ workspaceSlug: slug }}
            className="flex shrink-0 items-center gap-2"
          >
            <img src={logoNavy} alt="House of Ichigo" className="h-7 w-7 brightness-0 invert" />
            <span className="hidden text-[13px] font-medium tracking-tight lg:inline">
              House of Ichigo
            </span>
          </Link>

          <div className="hidden h-5 w-px bg-white/15 md:block" />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            <Link
              to="/app/$workspaceSlug"
              params={{ workspaceSlug: slug }}
              className={navItemClass(pathname === `/app/${slug}`)}
            >
              Home
            </Link>
            {phases.map((p) => (
              <PhaseDropdown
                key={p.id}
                phase={p}
                active={isPhaseActive(p)}
                onNavigate={navigateTo}
              />
            ))}
            {isHoiAdmin && (
              <Link
                to="/admin/library"
                className={navItemClass(pathname.includes("/admin"))}
              >
                <Settings className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
          </nav>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="rounded-md p-2 text-white/80 hover:bg-white/10 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto bg-paper p-0">
              <SheetHeader className="border-b border-chalk px-4 py-4">
                <SheetTitle className="text-[13px] font-medium text-navy">Navigation</SheetTitle>
              </SheetHeader>
              <div className="py-2">
                <MobileNavLink
                  label="Home"
                  href={`/app/${slug}`}
                  icon={Hammer}
                  active={pathname === `/app/${slug}`}
                  onClick={() => setMobileOpen(false)}
                />
                {phases.map((p) => (
                  <div key={p.id} className="mt-2">
                    <p className="px-4 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate">
                      {p.label}
                    </p>
                    {p.items.map((it) => (
                      <MobileNavLink
                        key={`${it.to}:${it.splat ?? ""}:${it.label}`}
                        label={it.label}
                        href={
                          it.splat
                            ? `/app/${slug}${it.to.replace("/app/$workspaceSlug", "").replace("$", it.splat)}`
                            : it.to.replace("$workspaceSlug", slug)
                        }
                        icon={it.icon}
                        active={false}
                        onClick={() => setMobileOpen(false)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Spacer + workspace switcher */}
          <div className="flex-1" />
          <div className="hidden md:block">
            <div className="rounded-md bg-white/5 px-2 py-1">
              <WorkspaceSwitcher />
            </div>
          </div>

          {/* Search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Open global search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden rounded border border-white/20 bg-white/5 px-1.5 font-mono text-[10px] text-white/60 lg:inline">
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <div className="text-white">
            <NotificationsBell />
          </div>

          {/* Avatar menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-white/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-[12px] font-medium text-white">
                  {initial}
                </span>
                <ChevronDown className="hidden h-3 w-3 text-white/60 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-lg border-chalk bg-white p-1 shadow-[0_4px_20px_rgba(30,43,77,0.08)]"
            >
              <DropdownMenuLabel className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-chalk" />
              <DropdownMenuItem
                onSelect={() =>
                  navigate({ to: "/app/$workspaceSlug/invite", params: { workspaceSlug: slug } })
                }
                className="cursor-pointer text-[14px] text-navy focus:bg-mist focus:text-navy"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite members
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  navigate({ to: "/app/$workspaceSlug/settings", params: { workspaceSlug: slug } })
                }
                className="cursor-pointer text-[14px] text-navy focus:bg-mist focus:text-navy"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onLogout}
                className="cursor-pointer text-[14px] text-navy focus:bg-mist focus:text-navy"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Global search */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search phases, library categories, settings…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {phases.map((p) => (
            <CommandGroup key={p.id} heading={p.label}>
              {p.items.map((it) => (
                <CommandItem
                  key={`${p.id}:${it.to}:${it.splat ?? ""}:${it.label}`}
                  value={`${p.label} ${it.label}`}
                  onSelect={() => navigateTo(it)}
                >
                  <it.icon className="mr-2 h-4 w-4 text-slate" />
                  <span>{it.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Workspace">
            <CommandItem
              value="Settings"
              onSelect={() => {
                navigate({ to: "/app/$workspaceSlug/settings", params: { workspaceSlug: slug } });
                setSearchOpen(false);
              }}
            >
              <Settings className="mr-2 h-4 w-4 text-slate" />
              Settings
            </CommandItem>
            <CommandItem
              value="Invite members"
              onSelect={() => {
                navigate({ to: "/app/$workspaceSlug/invite", params: { workspaceSlug: slug } });
                setSearchOpen(false);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4 text-slate" />
              Invite members
            </CommandItem>
            <CommandItem
              value="Notifications"
              onSelect={() => {
                setSearchOpen(false);
              }}
            >
              <Bell className="mr-2 h-4 w-4 text-slate" />
              Notifications
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6">{children}</main>

      <footer className="border-t border-chalk">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-6 md:px-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
            House of Ichigo
          </span>
          <p className="ichigo-footer">
            Equipped to <span className="accent">run.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function navItemClass(active: boolean) {
  return [
    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
    active ? "bg-terracotta text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

function PhaseDropdown({
  phase,
  active,
  onNavigate,
}: {
  phase: NavPhase;
  active: boolean;
  onNavigate: (sub: NavSubItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={navItemClass(active)}>
          <phase.icon className="h-3.5 w-3.5" />
          <span>{phase.label}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-60 rounded-lg border-chalk bg-white p-1 shadow-[0_4px_20px_rgba(30,43,77,0.08)]"
      >
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate">
          {phase.label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-chalk" />
        <div className="max-h-[380px] overflow-y-auto">
          {phase.items.map((it) => (
            <DropdownMenuItem
              key={`${phase.id}:${it.to}:${it.splat ?? ""}:${it.label}`}
              onSelect={() => onNavigate(it)}
              className="cursor-pointer text-[13px] text-navy focus:bg-mist focus:text-navy"
            >
              <it.icon className="mr-2 h-3.5 w-3.5 text-slate" />
              <span>{it.label}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavLink({
  label,
  href,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={[
        "flex items-center gap-2 px-4 py-2 text-[13px] transition-colors",
        active ? "bg-mist font-medium text-navy" : "text-graphite hover:bg-mist hover:text-navy",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
