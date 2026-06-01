// Notification kinds users can configure email delivery for.
// In-app notifications are always delivered; only email delivery is opt-out.

export type NotificationKind =
  | "invitation_accepted"
  | "roadmap_added"
  | "roadmap_stage_changed"
  | "roadmap_transition_blocked"
  | "governance_flag_created"
  | "governance_flag_assigned"
  | "governance_flag_resolved"
  | "post_pilot_review_submitted";

export type NotificationKindMeta = {
  kind: NotificationKind;
  label: string;
  description: string;
  group: "Workspace" | "Roadmap" | "Governance" | "Pilot";
};

export const NOTIFICATION_KINDS: NotificationKindMeta[] = [
  {
    kind: "invitation_accepted",
    label: "Invitation accepted",
    description: "Someone you invited joined a workspace.",
    group: "Workspace",
  },
  {
    kind: "roadmap_added",
    label: "Use case added to roadmap",
    description: "A use case you own was added to the Scale roadmap.",
    group: "Roadmap",
  },
  {
    kind: "roadmap_stage_changed",
    label: "Roadmap stage changed",
    description: "A use case moved between roadmap stages.",
    group: "Roadmap",
  },
  {
    kind: "roadmap_transition_blocked",
    label: "Roadmap transition blocked",
    description: "A stage change you attempted was blocked by governance.",
    group: "Roadmap",
  },
  {
    kind: "governance_flag_created",
    label: "Governance flag raised",
    description: "A new governance flag was created on a use case.",
    group: "Governance",
  },
  {
    kind: "governance_flag_assigned",
    label: "Governance flag assigned",
    description: "A governance flag was assigned to you.",
    group: "Governance",
  },
  {
    kind: "governance_flag_resolved",
    label: "Governance flag resolved",
    description: "A governance flag was resolved or accepted.",
    group: "Governance",
  },
  {
    kind: "post_pilot_review_submitted",
    label: "Pilot review submitted",
    description: "A post-pilot review was submitted for a use case.",
    group: "Pilot",
  },
];

export const DEFAULT_EMAIL_ENABLED = true;
