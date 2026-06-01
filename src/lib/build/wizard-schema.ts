export type FieldKind =
  | "text"
  | "textarea"
  | "radio"
  | "radio-cards"
  | "checkbox-grid"
  | "chips"
  | "accordion-checkboxes"
  | "repeater";

export interface FieldOption {
  value: string;
  label: string;
  helper?: string;
  advanced?: boolean;
}

export interface FieldGroup {
  label: string;
  options: FieldOption[];
}

export interface RepeaterColumn {
  key: string;
  label: string;
  type?: "text" | "select";
  options?: string[];
}

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  helper?: string;
  placeholder?: string;
  maxLength?: number;
  minSelect?: number;
  maxSelect?: number;
  maxRows?: number;
  cols?: 2;
  options?: FieldOption[];
  groups?: FieldGroup[];
  noneOption?: { key: string; label: string };
  columns?: RepeaterColumn[];
}

export interface StepDef {
  number: 1 | 2 | 3 | 4;
  title: string;
  shortTitle: string;
  subtitle: string;
  progress: number;
  guide: {
    why: string;
    notice: string;
    example?: string;
  };
  fields: FieldDef[];
}

export type WizardValues = Record<string, unknown>;

const useCaseShapes: FieldOption[] = [
  { value: "workflow_automation", label: "Automating a repeatable workflow" },
  { value: "search_qa", label: "Answering questions from documents or knowledge" },
  { value: "generation", label: "Drafting or adapting content" },
  { value: "decision_support", label: "Helping humans make decisions" },
  { value: "classification", label: "Sorting, prioritizing, or routing requests" },
  { value: "agentic_workflow", label: "Multi-step system using tools and goals", advanced: true },
  { value: "extraction", label: "Extracting data from files or messages" },
  { value: "monitoring_control", label: "Monitoring, audit, or control support" },
  { value: "other", label: "Other" },
];

const businessObjectives: FieldOption[] = [
  { value: "reduce_manual_work", label: "Reduce manual work" },
  { value: "speed_up_processing", label: "Speed up processing" },
  { value: "improve_accuracy", label: "Improve accuracy" },
  { value: "ensure_compliance", label: "Ensure compliance" },
  { value: "improve_employee_exp", label: "Improve employee experience" },
  { value: "improve_customer_exp", label: "Improve customer experience" },
  { value: "scale_capacity", label: "Scale capacity" },
  { value: "reduce_costs", label: "Reduce costs" },
  { value: "increase_visibility", label: "Increase visibility" },
  { value: "standardize_execution", label: "Standardize execution" },
  { value: "enable_realtime", label: "Enable real-time decision-making" },
  { value: "other", label: "Other" },
];

const primarySystems: FieldOption[] = [
  { value: "erp", label: "ERP" },
  { value: "accounting", label: "Accounting software" },
  { value: "hris", label: "HRIS" },
  { value: "crm", label: "CRM" },
  { value: "ticketing", label: "Ticketing system" },
  { value: "document_management", label: "Document management" },
  { value: "spreadsheets", label: "Spreadsheets" },
  { value: "email", label: "Email" },
  { value: "chat", label: "Chat / messaging" },
  { value: "internal_database", label: "Internal database" },
  { value: "bi_tools", label: "BI / analytics" },
  { value: "knowledge_base", label: "Knowledge base" },
  { value: "external_saas", label: "External SaaS" },
  { value: "third_party_api", label: "Third-party API" },
  { value: "partner_portals", label: "Partner portal" },
  { value: "manual_input", label: "Manual input" },
];

const inputTypeOptions = ["File", "Form", "API", "Email", "Database", "Manual Entry"];
const outputFormatOptions = ["PDF", "Email", "Dashboard", "Database Entry", "Notification", "File", "API Call"];

export const STEPS: StepDef[] = [
  {
    number: 1,
    title: "Identify the Use Case",
    shortTitle: "Strategic Intent",
    subtitle: "Define the outcome, scope, and business context before mapping the work.",
    progress: 10,
    guide: {
      why: "The scoring engine needs a clear business objective before it can prioritize the use case.",
      notice: "A strong use case has a named process, measurable outcome, and clear boundary.",
      example: "Reduce invoice processing time from 3 days to 1 day for supplier invoices, excluding employee expenses.",
    },
    fields: [
      { key: "process_name", label: "Process name", kind: "text", required: true, maxLength: 60, placeholder: "e.g. Supplier invoice review" },
      {
        key: "use_case_family",
        label: "Use case family",
        kind: "radio-cards",
        required: true,
        cols: 2,
        options: [
          { value: "internal_ops", label: "Internal Operations", helper: "Back-office or operational work" },
          { value: "service_delivery", label: "Service Delivery", helper: "Delivering value to customers or partners" },
          { value: "decision_support", label: "Decision Support", helper: "Analysis, recommendation, or decision assistance" },
          { value: "compliance_control", label: "Compliance & Control", helper: "Audits, controls, or regulatory work" },
          { value: "data_enablement", label: "Data Enablement", helper: "Preparing, consolidating, or structuring data" },
        ],
      },
      { key: "use_case_shape", label: "What kind of use case is this?", kind: "radio", required: true, cols: 2, options: useCaseShapes },
      {
        key: "business_domain",
        label: "Target business domain",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "supply_chain", label: "Supply Chain" },
          { value: "customer_journey", label: "Customer Journey" },
          { value: "hr_talent", label: "HR & Talent" },
          { value: "finance_treasury", label: "Finance & Treasury" },
          { value: "it_operations", label: "IT Operations" },
          { value: "legal_compliance", label: "Legal & Compliance" },
          { value: "sales_marketing", label: "Sales & Marketing" },
          { value: "rnd", label: "R&D" },
        ],
      },
      {
        key: "customer_facing_choice",
        label: "Will users, customers, citizens, or partners directly see the AI output?",
        kind: "radio",
        required: true,
        cols: 2,
        helper: "This drives EU AI Act transparency and user-disclosure checks.",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      { key: "business_objectives", label: "Business objectives", kind: "checkbox-grid", required: true, cols: 2, minSelect: 1, maxSelect: 3, options: businessObjectives },
      {
        key: "problems_today",
        label: "What problems happen today?",
        kind: "chips",
        helper: "Select the signals that make this process worth improving.",
        options: [
          { value: "manual_entry_errors", label: "Manual entry errors" },
          { value: "slow_turnaround", label: "Slow turnaround" },
          { value: "inconsistent_vendor_quality", label: "Inconsistent input quality" },
          { value: "compliance_risk", label: "Compliance risk" },
          { value: "scalability_limit", label: "Scalability limit" },
          { value: "high_cost", label: "High cost" },
          { value: "poor_visibility", label: "Poor visibility" },
        ],
      },
      {
        key: "decision_points",
        label: "Key decision points",
        kind: "chips",
        options: [
          { value: "validate_input", label: "Validate input" },
          { value: "route_for_approval", label: "Route for approval" },
          { value: "classify_exception", label: "Classify exception" },
          { value: "prioritize_queue", label: "Prioritize queue" },
          { value: "escalate_anomaly", label: "Escalate anomaly" },
        ],
      },
      {
        key: "system_should",
        label: "The system should",
        kind: "chips",
        options: [
          { value: "extract", label: "Extract data" },
          { value: "validate", label: "Validate against rules" },
          { value: "route", label: "Route to the right person" },
          { value: "notify", label: "Notify stakeholders" },
          { value: "log", label: "Log every action" },
          { value: "escalate", label: "Escalate exceptions" },
        ],
      },
      {
        key: "system_should_not",
        label: "The system must not",
        kind: "chips",
        options: [
          { value: "post_to_gl_unattended", label: "Post to GL unattended" },
          { value: "override_human_decision", label: "Override a human decision" },
          { value: "send_external_communication", label: "Send external communications" },
          { value: "modify_master_data", label: "Modify master data" },
          { value: "auto_approve_above_threshold", label: "Auto-approve above threshold" },
          { value: "share_pii_externally", label: "Share PII externally" },
        ],
      },
      { key: "success_metric", label: "Success metric", kind: "text", required: true, placeholder: "e.g. Reduce cycle time by 40% within 90 days" },
      { key: "in_scope", label: "In scope", kind: "textarea", required: true, placeholder: "What is included in this use case?" },
      { key: "out_of_scope", label: "Out of scope", kind: "textarea", required: true, placeholder: "What must stay outside the first version?" },
    ],
  },
  {
    number: 2,
    title: "Data and Tools",
    shortTitle: "Data & System",
    subtitle: "Capture the information, systems, and access conditions behind the use case.",
    progress: 32,
    guide: {
      why: "AI and automation fail when data does not exist, cannot be accessed, or sits in disconnected systems.",
      notice: "Structured and accessible data increases feasibility. Restricted data raises governance needs.",
    },
    fields: [
      { key: "primary_systems", label: "Primary data sources", kind: "checkbox-grid", required: true, cols: 2, minSelect: 1, maxSelect: 5, options: primarySystems },
      { key: "other_system", label: "Other source", kind: "text", placeholder: "Optional source not listed above" },
      {
        key: "data_readiness",
        label: "Data readiness",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "ready", label: "Exists and is structured", helper: "Clean data in databases or structured files" },
          { value: "partial", label: "Exists partially", helper: "Some data is available, some is missing" },
          { value: "fragmented", label: "Fragmented across sources", helper: "No single source of truth" },
          { value: "poor", label: "Poor quality", helper: "Needs cleanup before use" },
          { value: "missing", label: "Does not exist yet", helper: "Needs to be created or collected first" },
        ],
      },
      {
        key: "accessibility",
        label: "Data accessibility",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "api", label: "API or database access", helper: "Can be accessed programmatically today" },
          { value: "export", label: "Export available", helper: "Can be exported with some effort" },
          { value: "manual", label: "Manual access only", helper: "People must download, copy, or re-enter data" },
          { value: "none", label: "Not accessible", helper: "Locked, unavailable, or no permission path" },
        ],
      },
      {
        key: "classification",
        label: "Data classification",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "public", label: "Public / open" },
          { value: "internal", label: "Internal" },
          { value: "confidential", label: "Confidential", advanced: true },
          { value: "restricted", label: "Restricted or special-category data", advanced: true },
        ],
      },
      {
        key: "structure",
        label: "Data structure type",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "structured", label: "Fully structured", helper: "Tables, databases, or well-defined schemas" },
          { value: "semi_structured", label: "Semi-structured", helper: "Forms, tagged documents, JSON, XML" },
          { value: "unstructured", label: "Unstructured", helper: "Free text, emails, scanned files" },
          { value: "mixed", label: "Mixed", helper: "A combination of structured and unstructured data" },
        ],
      },
      {
        key: "actionability",
        label: "System actionability",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "yes", label: "Can read and write", helper: "The system can act via API or workflow" },
          { value: "partial", label: "Read-only or limited write", helper: "Some actions need humans or exports" },
          { value: "no", label: "No action path", helper: "Manual interface only" },
          { value: "unknown", label: "Unknown", helper: "Needs investigation" },
        ],
      },
      {
        key: "historical_cases",
        label: "Historical cases",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "yes", label: "Many examples" },
          { value: "partial", label: "A few examples" },
          { value: "no", label: "No examples" },
        ],
      },
      {
        key: "personal_data",
        label: "Does this process use personal data?",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "foreign_vendor_access",
        label: "Will an offshore or external vendor access data?",
        kind: "radio",
        required: true,
        cols: 2,
        helper: "This drives GDPR transfer review and security/sector regulator security review checks.",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "training_data_origin",
        label: "Training or reference data origin",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "internal", label: "Internal data only" },
          { value: "licensed", label: "Licensed third-party data" },
          { value: "third_party", label: "Third-party or public data", advanced: true },
          { value: "unknown", label: "Unknown", advanced: true },
        ],
      },
      {
        key: "vendor_model_reuse",
        label: "Will the solution reuse a vendor model, prompt pack, or generated asset?",
        kind: "radio",
        required: true,
        cols: 2,
        helper: "This drives IP review and vendor evidence checks.",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    number: 3,
    title: "How the Work Happens",
    shortTitle: "Process Shape",
    subtitle: "Describe how the work runs today, where decisions happen, and what outputs are produced.",
    progress: 52,
    guide: {
      why: "Automation depends on repeatability, decision points, exception rates, and where humans must remain involved.",
      notice: "Per-step automation levels are recommendations, not commitments. They help expose unsafe automation.",
    },
    fields: [
      {
        key: "workflow_steps",
        label: "Workflow steps",
        kind: "repeater",
        required: true,
        maxRows: 12,
        columns: [
          { key: "step", label: "Step name" },
          { key: "owner", label: "Owner" },
          { key: "automation", label: "Automation", type: "select", options: ["0", "1", "2", "3", "4", "5"] },
        ],
      },
      {
        key: "hitl_decisions",
        label: "Human-in-the-loop decision",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "mandatory", label: "Mandatory human approval" },
          { value: "exception", label: "Human handles exceptions" },
          { value: "sample", label: "Human reviews samples" },
          { value: "none", label: "No human review", advanced: true },
        ],
      },
      {
        key: "decision_logic_type",
        label: "Decision logic type",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "rules", label: "Mostly rules" },
          { value: "model_based", label: "Model-based recommendation", advanced: true },
          { value: "mixed", label: "Rules plus judgment" },
          { value: "agentic", label: "Agentic or autonomous workflow", advanced: true },
          { value: "judgment", label: "Mostly human judgment" },
        ],
      },
      {
        key: "automated_decisions_affect_individuals_choice",
        label: "Could automated outputs affect an individual, customer, employee, or supplier?",
        kind: "radio",
        required: true,
        cols: 2,
        helper: "This drives GDPR privacy-impact review and human oversight checks.",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "rules_documentation",
        label: "Rules documentation",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "yes", label: "Fully documented" },
          { value: "partial", label: "Partially documented" },
          { value: "no", label: "Not documented" },
        ],
      },
      {
        key: "standardisation",
        label: "Process standardisation",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "high", label: "Highly standardised" },
          { value: "medium", label: "Mostly standardised" },
          { value: "low", label: "Varies by case or team" },
          { value: "inconsistent", label: "Highly inconsistent" },
        ],
      },
      {
        key: "exception_rate",
        label: "Exception rate",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "5", label: "Rare, under 10%" },
          { value: "15", label: "Occasional, 10-25%" },
          { value: "35", label: "Frequent, 25%+" },
        ],
      },
      {
        key: "frequency",
        label: "Frequency",
        kind: "chips",
        required: true,
        options: [
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
          { value: "ad_hoc", label: "Ad hoc" },
        ],
      },
      { key: "volume", label: "Volume estimate", kind: "text", required: true, placeholder: "e.g. 500 invoices per month" },
      {
        key: "trigger_type",
        label: "Trigger type",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "manual", label: "Human-initiated" },
          { value: "scheduled", label: "Scheduled" },
          { value: "event", label: "System event" },
          { value: "predictive", label: "Predictive signal" },
        ],
      },
      {
        key: "trigger_detectability",
        label: "Trigger detectability",
        kind: "radio",
        cols: 2,
        options: [
          { value: "automatic", label: "Fully automatic" },
          { value: "partial", label: "Partially detectable" },
          { value: "manual", label: "Manual only" },
        ],
      },
      {
        key: "process_inputs",
        label: "Process inputs",
        kind: "repeater",
        required: true,
        maxRows: 5,
        columns: [
          { key: "name", label: "Input name" },
          { key: "type", label: "Type", type: "select", options: inputTypeOptions },
          { key: "source", label: "Source" },
        ],
      },
      {
        key: "process_outputs",
        label: "Process outputs",
        kind: "repeater",
        required: true,
        maxRows: 5,
        columns: [
          { key: "name", label: "Output name" },
          { key: "format", label: "Format", type: "select", options: outputFormatOptions },
          { key: "destination", label: "Destination" },
        ],
      },
    ],
  },
  {
    number: 4,
    title: "Safety and Limits",
    shortTitle: "Governance",
    subtitle: "Define the acceptable level of automation, required human review, and safeguards.",
    progress: 84,
    guide: {
      why: "Boundaries are not blockers. They make implementation faster, safer, and easier to approve.",
      notice: "High autonomy with irreversible actions, PII, or weak rollback creates governance flags.",
    },
    fields: [
      {
        key: "max_autonomy",
        label: "Maximum acceptable autonomy",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "assistive", label: "AI assists a human" },
          { value: "approval", label: "AI acts with approval" },
          { value: "semi_agentic", label: "AI orchestrates with checkpoints", advanced: true },
          { value: "agentic", label: "Full agent inside a bounded scope", advanced: true },
        ],
      },
      {
        key: "non_negotiable_constraints",
        label: "Non-negotiable constraints",
        kind: "accordion-checkboxes",
        required: true,
        noneOption: { key: "not_yet_identified", label: "No non-negotiable constraints identified yet" },
        groups: [
          {
            label: "Compliance",
            options: [
              { value: "regulatory_compliance", label: "Regulatory compliance required" },
              { value: "auditability", label: "Audit trail required" },
              { value: "policy_enforcement", label: "Policy enforcement required" },
            ],
          },
          {
            label: "Data",
            options: [
              { value: "sensitive_data", label: "Sensitive data handling" },
              { value: "data_residency", label: "Data residency restrictions" },
              { value: "confidentiality", label: "Confidentiality requirements" },
            ],
          },
          {
            label: "Operational",
            options: [
              { value: "no_downtime", label: "No downtime tolerated" },
              { value: "legacy_dependency", label: "Dependency on legacy systems" },
              { value: "manual_fallback", label: "Manual fallback required" },
            ],
          },
          {
            label: "Financial",
            options: [
              { value: "dual_approval", label: "Dual approval required" },
              { value: "no_unattended_payment", label: "No unattended payments" },
              { value: "threshold_approval", label: "Threshold-based approval required" },
            ],
          },
        ],
      },
      {
        key: "impact_if_failure",
        label: "Impact if failure",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
          { value: "critical", label: "Critical" },
        ],
      },
      {
        key: "risk_tolerance",
        label: "Risk tolerance",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "high", label: "Acceptable" },
          { value: "medium", label: "Acceptable with controls" },
          { value: "low", label: "Not acceptable without redesign" },
        ],
      },
      {
        key: "error_reversibility",
        label: "Error reversibility",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "easy", label: "Easy to reverse" },
          { value: "moderate", label: "Reversible with effort" },
          { value: "hard", label: "Hard to reverse" },
          { value: "irreversible", label: "Irreversible", advanced: true },
        ],
      },
      {
        key: "output_criticality",
        label: "Output criticality",
        kind: "radio-cards",
        required: true,
        options: [
          { value: "low", label: "Internal only" },
          { value: "medium", label: "Operational impact" },
          { value: "high", label: "Customer, financial, or legal impact" },
          { value: "critical", label: "Material / irreversible impact", advanced: true },
        ],
      },
      {
        key: "output_validation",
        label: "Output validation",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "none", label: "No validation" },
          { value: "human", label: "Human validation" },
          { value: "automated", label: "Automated checks" },
          { value: "multi_step", label: "Multi-step approval" },
        ],
      },
      {
        key: "output_verifiable",
        label: "Can outputs be verified?",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "yes", label: "Yes" },
          { value: "partial", label: "Partly" },
          { value: "no", label: "No reliable verification" },
        ],
      },
      {
        key: "rollback_path",
        label: "Rollback or recovery path",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "yes", label: "Defined" },
          { value: "partial", label: "Manual fallback" },
          { value: "no", label: "No rollback path" },
        ],
      },
      { key: "process_owner", label: "Process owner", kind: "text", required: true, placeholder: "Named owner or role accountable for the process" },
      {
        key: "monitoring_plan",
        label: "Monitoring plan",
        kind: "radio",
        required: true,
        cols: 2,
        options: [
          { value: "yes", label: "Defined" },
          { value: "partial", label: "Draft / planned" },
          { value: "no", label: "No monitoring path" },
        ],
      },
    ],
  },
];

export function isFieldFilled(field: FieldDef, value: unknown): boolean {
  if (field.kind === "text" || field.kind === "textarea") {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (field.kind === "radio" || field.kind === "radio-cards") {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (field.kind === "repeater") {
    if (!Array.isArray(value)) return false;
    const rows = value.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    const cols = field.columns ?? [];
    const nonEmptyRows = rows.filter((row) => {
      const entries = Object.values(row);
      return entries.some((v) => typeof v === "string" && v.trim().length > 0);
    });
    if (nonEmptyRows.length === 0) return false;

    return nonEmptyRows.every((row) => {
      if (cols.length === 0) {
        return Object.values(row).some((v) => typeof v === "string" && v.trim().length > 0);
      }
      return cols.every((col) => {
        const cell = row[col.key];
        return typeof cell === "string" && cell.trim().length > 0;
      });
    });
  }
  if (field.kind === "checkbox-grid") {
    if (!Array.isArray(value)) return false;
    const count = value.length;
    if (field.minSelect != null && count < field.minSelect) return false;
    if (field.maxSelect != null && count > field.maxSelect) return false;
    return count > 0;
  }
  if (field.kind === "accordion-checkboxes") {
    if (!Array.isArray(value)) return false;
    if (field.noneOption && value.includes(field.noneOption.key)) return true;
    return value.length > 0;
  }
  if (field.kind === "chips") {
    return Array.isArray(value) && value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((row) => {
      if (!row || typeof row !== "object") return false;
      const entries = Object.values(row as Record<string, unknown>);
      return entries.some((v) => typeof v === "string" && v.trim().length > 0);
    });
  }
  return false;
}

export function validateStep(step: StepDef, values: WizardValues): string[] {
  const missing: string[] = [];
  for (const field of step.fields) {
    if (!field.required) continue;
    if (!isFieldFilled(field, values[field.key])) missing.push(field.label);
  }
  return missing;
}
