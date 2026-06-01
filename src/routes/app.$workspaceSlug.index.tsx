import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  Rocket,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  relativeTime,
  useAttentionItems,
  useRecentActivity,
  useResumeData,
  useTeamStatus,
  useUserProfile,
} from "@/hooks/useWorkspaceHome";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

export const Route = createFileRoute("/app/$workspaceSlug/")({
  component: WorkspaceHome,
});

function firstNameFrom(fullName: string | null | undefined, email: string | undefined) {
  if (fullName && fullName.trim()) return fullName.trim().split(/\s+/)[0];
  if (email) {
    const local = email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "there";
}

function WorkspaceHome() {
  const { workspace, role, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();

  if (!workspace) return null;

  const firstName = firstNameFrom(profile?.full_name, user?.email);

  return (
    <div className="space-y-16 md:space-y-16 [&>section]:scroll-mt-8">
      <HeaderSection
        workspaceName={workspace.name}
        firstName={firstName}
        role={role}
      />
      <OnboardingChecklist />
      <ResumeSection slug={workspace.slug} />
      <TeamStatusSection slug={workspace.slug} />
      {isAdmin && <AttentionSection slug={workspace.slug} />}
      <ActivitySection slug={workspace.slug} />
    </div>
  );
}

/* ===================== HEADER ===================== */

function HeaderSection({
  workspaceName,
  firstName,
  role,
}: {
  workspaceName: string;
  firstName: string;
  role: string | null;
}) {
  return (
    <header className="pt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow-muted">WORKSPACE · {workspaceName.toUpperCase()}</p>
        <h1 className="h-display-md mt-3 max-w-[20ch]">
          Welcome back, <span className="accent-italic">{firstName}.</span>
        </h1>
        <p className="lead mt-3 max-w-[60ch]">
          Here's where your team is across the platform.
        </p>
      </div>
      <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-slate md:block">
        Logged in · {(role ?? "member").toUpperCase()}
      </p>
    </header>
  );
}

/* ===================== SECTION 1: RESUME ===================== */

function ResumeSection({ slug }: { slug: string }) {
  const { data, isLoading } = useResumeData();
  const navigate = useNavigate();

  const go = (stage: "assess" | "build" | "scale") =>
    navigate({
      to:
        stage === "assess"
          ? "/app/$workspaceSlug/assess"
          : stage === "build"
            ? "/app/$workspaceSlug/build"
            : "/app/$workspaceSlug/scale",
      params: { workspaceSlug: slug },
    });

  return (
    <section>
      <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
      <div className="card card-elevate mt-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:divide-x md:divide-chalk">
          <ResumeTile
            eyebrow="ASSESS · METHODOLOGY"
            onClick={() => go("assess")}
            loading={isLoading}
            empty={!data?.assess.started}
            emptyTitle="Not started"
            emptyCta="Begin the methodology"
          >
            <p className="h-heading-md">
              Module {data?.assess.moduleNum} <span className="text-slate text-[14px] font-normal font-sans">of 12</span>
            </p>
            <p className="mt-1 text-[13px] text-graphite">{data?.assess.moduleTitle}</p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-mist">
              <div
                className="h-full bg-terracotta"
                style={{ width: `${data?.assess.progress ?? 0}%` }}
              />
            </div>
          </ResumeTile>

          <ResumeTile
            eyebrow="BUILD · USE CASES"
            onClick={() => go("build")}
            loading={isLoading}
            empty={(data?.build.total ?? 0) === 0}
            emptyTitle="No use cases yet"
            emptyCta="Capture your first"
          >
            <p className="h-heading-md">{data?.build.total} use cases</p>
            <p className="mt-1 text-[13px] text-graphite">
              {data?.build.readyToScore} ready to score
            </p>
          </ResumeTile>

          <ResumeTile
            eyebrow="SCALE · ROADMAP"
            onClick={() => go("scale")}
            loading={isLoading}
            empty={(data?.scale.active ?? 0) === 0 && (data?.scale.pendingApproval ?? 0) === 0}
            emptyTitle="Roadmap empty"
            emptyCta="Score a use case to start"
          >
            <p className="h-heading-md">{data?.scale.active} active</p>
            <p className="mt-1 text-[13px] text-graphite">
              {data?.scale.pendingApproval} pending approval
            </p>
          </ResumeTile>
        </div>
      </div>
    </section>
  );
}

function ResumeTile({
  eyebrow,
  onClick,
  loading,
  empty,
  emptyTitle,
  emptyCta,
  children,
}: {
  eyebrow: string;
  onClick: () => void;
  loading: boolean;
  empty: boolean;
  emptyTitle: string;
  emptyCta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left md:px-6 first:md:pl-0 last:md:pr-0 rounded-md transition-colors hover:bg-mist/40 -mx-3 px-3 py-2 md:py-0"
    >
      <p className="eyebrow-muted">{eyebrow}</p>
      <div className="mt-3 min-h-[88px]">
        {loading ? (
          <p className="text-[13px] text-slate">Loading…</p>
        ) : empty ? (
          <div>
            <p className="h-heading-md text-slate">{emptyTitle}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[13px] text-terracotta">
              {emptyCta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        ) : (
          children
        )}
      </div>
    </button>
  );
}

/* ===================== SECTION 2: TEAM STATUS ===================== */

function TeamStatusSection({ slug }: { slug: string }) {
  const { data } = useTeamStatus();
  const navigate = useNavigate();
  const go = () => navigate({ to: "/app/$workspaceSlug", params: { workspaceSlug: slug } });

  const cards = [
    {
      eyebrow: "STAGE 01 · ASSESS",
      stat: data ? `${data.assess.completed} / ${data.assess.total}` : "—",
      label: "MODULES COMPLETED",
      context: `${data?.assess.membersStarted ?? 0} team members started`,
    },
    {
      eyebrow: "STAGE 02 · DISCOVER",
      stat: `${data?.discover.items ?? 0}`,
      label: "ITEMS IN LIBRARY",
      context: "View prompts, agents, tools",
    },
    {
      eyebrow: "STAGE 03 · BUILD",
      stat: `${data?.build.scored ?? 0}`,
      label: "USE CASES SCORED",
      context: `${data?.build.pending ?? 0} pending approval`,
    },
    {
      eyebrow: "STAGE 04 · SCALE",
      stat: `${data?.scale.live ?? 0}`,
      label: "USE CASES LIVE",
      context: `${data?.scale.pilot ?? 0} in pilot · ${data?.scale.openFlags ?? 0} open flags`,
    },
  ];

  return (
    <section>
      <p className="eyebrow">TEAM STATUS</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.eyebrow}
            type="button"
            onClick={go}
            className="card card-elevate text-left transition-transform"
          >
            <p className="eyebrow-muted">{c.eyebrow}</p>
            <p
              className="mt-4 font-display text-terracotta"
              style={{ fontSize: "56px", lineHeight: 1, fontWeight: 400, letterSpacing: "-0.02em" }}
            >
              {c.stat}
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-slate">
              {c.label}
            </p>
            <p className="mt-2 text-[13px] text-graphite">{c.context}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ===================== SECTION 3: ATTENTION ===================== */

function AttentionSection({ slug: _slug }: { slug: string }) {
  const { data, isLoading } = useAttentionItems();
  const navigate = useNavigate();

  return (
    <section>
      <p className="eyebrow">NEEDS YOUR ATTENTION</p>
      <div className="card mt-4">
        {isLoading ? (
          <p className="text-[13px] text-slate">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-[14px] italic text-slate">
            All clear. Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-chalk">
            {data.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <Mail
                    className={`mt-0.5 h-4 w-4 ${item.kind === "urgent" ? "text-terracotta" : "text-slate"}`}
                  />
                  <div>
                    <p className="text-[14px] text-navy">{item.description}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                      {item.timestamp}
                    </p>
                  </div>
                </div>
                {item.actionTo && (
                  <button
                    type="button"
                    onClick={() => navigate({ to: item.actionTo! })}
                    className="text-[13px] font-medium text-terracotta hover:opacity-80"
                  >
                    {item.actionLabel} →
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ===================== SECTION 4: RECENT ACTIVITY ===================== */

function ActivitySection({ slug }: { slug: string }) {
  const { data, isLoading } = useRecentActivity();

  const iconFor = (kind: string) => {
    switch (kind) {
      case "invite_sent":
        return Mail;
      case "invite_accepted":
        return CheckCircle2;
      case "workspace_created":
        return Rocket;
      case "member_joined":
        return Users;
      default:
        return Clock;
    }
  };

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <p className="eyebrow">RECENT ACTIVITY</p>
      <div className="card mt-4">
        {isLoading ? (
          <p className="text-[13px] text-slate">Loading…</p>
        ) : !data || data.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[14px] italic text-slate">
              No activity yet. Send your first invite to get started.
            </p>
            <Link
              to="/app/$workspaceSlug/invite"
              params={{ workspaceSlug: slug }}
              className="btn-ichigo btn-ichigo-primary mt-4 inline-flex"
            >
              <UserPlus className="h-4 w-4" /> Invite someone
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((ev) => {
              const Icon = iconFor(ev.kind);
              return (
                <li key={ev.id} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-[14px] w-[14px] shrink-0 text-slate" />
                  <p className="text-[14px] text-navy">
                    {ev.description}{" "}
                    <span className="text-slate">· {relativeTime(ev.timestamp)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
