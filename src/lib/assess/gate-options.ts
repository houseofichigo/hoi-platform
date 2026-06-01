export interface GateConstraintOption {
  id: string;
  label: string;
}

export interface GateRationaleOption {
  id: string;
  label: string;
}

export const GATE_CONSTRAINT_OPTIONS: GateConstraintOption[] = [
  { id: 'hitl_required', label: 'Mandatory human-in-the-loop on every output' },
  { id: 'scope_limited', label: 'Scope limited to a single department or pilot team' },
  { id: 'no_sensitive_data', label: 'Excludes sensitive or regulated data classes' },
  { id: 'read_only', label: 'Read-only — no writes to systems of record' },
  { id: 'sandbox_only', label: 'Runs in sandbox, no production integrations' },
  { id: 'time_boxed', label: 'Time-boxed pilot with a fixed re-evaluation date' },
];

export const GATE_RATIONALE_OPTIONS: GateRationaleOption[] = [
  { id: 'value_clear', label: 'Business value is clear and measurable' },
  { id: 'data_ready', label: 'Data foundations are in place' },
  { id: 'governance_ok', label: 'Governance and compliance posture is acceptable' },
  { id: 'tech_proven', label: 'Technical approach has been validated' },
  { id: 'team_capable', label: 'Team has the skills to operate it' },
  { id: 'sponsor_committed', label: 'Executive sponsor is committed' },
  { id: 'risk_acceptable', label: 'Residual risk is acceptable to the business' },
];
