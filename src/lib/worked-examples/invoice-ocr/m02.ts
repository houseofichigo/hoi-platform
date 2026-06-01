import type { InvoiceOcrProfileContext } from "./m01";

// ── Reusable types ──────────────────────────────────────────────────────────

/** A single row inside an OCR walkthrough block. */
export interface OCRBlockRow {
  /** The thing being captured (e.g. "Supplier master"). */
  label: string;
  /** The chosen value/source we landed on for this row. Must appear in `options`. */
  value: string;
  /** Every option we considered, in order. Rejected ones render struck-through. */
  options: readonly string[];
  /** Why we picked `value` over the alternatives. The "methodology" moment. */
  why: string;
  /** Optional governance attributes — only set on data-source rows (Steps 1-3). */
  governance?: {
    ownership: string;
    lineage: string;
    quality: string;
    access: string;
    privacy: string;
  };
}

/** A full capture block — one block per step in Steps 1-3. */
export interface OCRBlock {
  intro: string;
  rows: readonly OCRBlockRow[];
  computed?: { label: string; body: string };
}

// ── M02 content ──────────────────────────────────────────────────────────────

export const M02_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "Data Readiness. Before you prompt, before you build, you map the data. Three layers: what lives inside the company, what rules live outside it, and the test set that proves the system works. Today's job: walk that map for the OCR case.",

  step1: {
    title: "Internal data — what already lives inside the company",
    why:
      "Internal data is the fields your systems of record already hold — invoices, suppliers, POs, chart of accounts. Before you ask a model to do anything, you map which of these the system can read, who owns each one, how clean it is, and what access you have.",
    example:
      "For OCR, the AP system already holds supplier master, invoice archive, chart of accounts, and (sometimes) PO data. Each one has an owner, an access path, and a quality profile.",
    whatToNotice: [
      "Every internal data source has a named owner — 'IT' is not a name",
      "Quality is not the same as completeness — clean records can still be wrong",
      "Access path matters as much as access itself — API beats CSV export beats screen scrape",
    ],
    produces: "Layer 01 — internal data sources",
    nextLabel: "Step 2 — contextual data",
  },

  step2: {
    title: "Contextual data — the rules the system must respect",
    why:
      "Contextual data is the external rules the assistant must respect — laws, mandates, industry-specific requirements. They never live in your database; they live in regulation, contracts, and internal policy. Miss one and you ship a non-compliant system.",
    example:
      "For OCR in the EU, the rules are: e-invoicing invoice requirements, EU AI Act governance classification, GDPR for supplier contacts, ISO 42001 data governance, internal AP policy, and supplier contract terms.",
    whatToNotice: [
      "Contextual rules have a regime (GDPR · EU AI Act · ISO 42001 · sector · internal) and a consequence for ignoring them",
      "Internal policy counts as contextual data — even if no regulator enforces it",
      "Cross-border invoices add residency and transfer rules — they don't just add VAT lines",
    ],
    produces: "Layer 02 — contextual rules and regimes",
    nextLabel: "Step 3 — task-specific data",
  },

  step3: {
    title: "Task-specific data — the test set that proves the system works",
    why:
      "Task-specific data is the deliberately-chosen examples that prove your system actually works. Not the production stream — a curated set of clean cases, edge cases, and adversarial cases. This is the data you point at every prompt iteration in M03 and every evaluation run in M11.",
    example:
      "A minimum viable OCR test set is 15 invoices: 5 clean (textbook layouts, single page, EU suppliers), 5 edge cases (missing PO reference, foreign currency, multi-page, hand-written annotation, duplicate of a prior month), 5 adversarial (typo'd amounts, swapped VAT rate, invented supplier name, manipulated total, scan-quality stress test).",
    whatToNotice: [
      "Edge cases are the ones that fail silently in production — explicitly bait them",
      "Adversarial cases are not 'errors' — they're tests of refusal, not of accuracy",
      "Test-set size matters less than coverage of the failure modes you've seen before",
    ],
    produces: "Layer 03 — task-specific test set",
    nextLabel: "Step 4 — three-layer map + gaps",
  },

  step4: {
    title: "The three-layer data map — and the gaps you need to fill",
    why:
      "The map is now in front of you: internal, contextual, task-specific. The methodology insight is that every team has gaps — sources without named owners, rules without documented consequences, test sets without adversarial cases. M02 is not done when you've listed the layers. It's done when you've named the gaps.",
    example:
      "Common gaps: supplier master with no named owner; VAT rules for cross-border cases not documented; no adversarial cases in the test archive; no audit trail on who edited the chart of accounts last quarter.",
    whatToNotice: [
      "A gap you can name is a gap you can close — every layer has them",
      "Some gaps block Build (no data owner = no Gate 1 pass)",
      "Some gaps only block Scale (no adversarial test set = fine for pilot, lethal at production volume)",
    ],
    produces: "Three-layer data map → completes M02",
  },

  internalSources: {
    intro:
      "Five internal sources mapped to the four governance dimensions. The chosen value sits next to the rejected alternatives — the methodology is in the rejection, not the selection.",
    rows: [
      {
        label: "Source of truth for invoice content",
        value: "Invoice PDF (received by email)",
        options: [
          "Invoice PDF (received by email)",
          "Pre-parsed JSON from supplier portal",
          "Hand-keyed entry in the accounting system",
          "OCR output from a prior system",
        ],
        why:
          "The PDF is what the supplier sent and what audit will go back to. Anything downstream (JSON, hand-keyed entry) is a derivative — the PDF is the only source-of-truth that survives every storage migration.",
        governance: {
          ownership: "AP Team Lead (named individual)",
          lineage: "Email → archive folder → OCR queue (logged at each step)",
          quality: "High — supplier-issued, immutable PDFs",
          access: "Read-only via storage API",
          privacy: "Confidential — financial; contains personal data (supplier contacts)",
        },
      },
      {
        label: "Supplier master",
        value: "Accounting system supplier list (single record per supplier)",
        options: [
          "Accounting system supplier list (single record per supplier)",
          "Spreadsheet maintained by the AP team",
          "Procurement system (where vendors are first onboarded)",
          "Merge of accounting + procurement (no single owner)",
        ],
        why:
          "One owner, one record, one update path. The procurement system holds richer onboarding data but it's not the AP system of record. The merged approach silently fails Gate 3 — no one is accountable when records drift.",
        governance: {
          ownership: "AP Team Lead",
          lineage: "Onboarded in procurement → synced to accounting nightly → manual edits logged",
          quality: "Adequate — ~5% of records have stale IBAN or contact details",
          access: "Read + write via API; write requires HITL for IBAN changes",
          privacy: "Confidential — contains personal data (contact name, email, phone)",
        },
      },
      {
        label: "Purchase order records",
        value: "Procurement system (where POs are issued)",
        options: [
          "Procurement system (where POs are issued)",
          "Inferred from invoice references (no real PO data)",
          "Reconstructed from accounting postings",
          "Not used — process is pre-PO",
        ],
        why:
          "POs only count if they exist independently of the invoice. Inferring a PO from the invoice itself defeats the matching control — you'd be checking the invoice against the invoice. If the org runs pre-PO, this layer is documented as 'absent', not faked.",
        governance: {
          ownership: "Procurement Manager",
          lineage: "Buyer creates PO → approval workflow → exposed to AP via read API",
          quality: "Adequate — PO references inconsistently included on supplier invoices",
          access: "Read-only via API",
          privacy: "Internal — no personal data",
        },
      },
      {
        label: "Chart of accounts (cost centres, GL codes)",
        value: "Accounting system COA (current fiscal year)",
        options: [
          "Accounting system COA (current fiscal year)",
          "Excel export from last year-end close",
          "Hand-maintained mapping document by Finance",
          "The model decides on the fly",
        ],
        why:
          "The COA changes every fiscal year. Anything other than a live read from the accounting system is stale by January. 'The model decides' is the failure mode this module exists to prevent — coding decisions need a controlled vocabulary, not a generative one.",
        governance: {
          ownership: "Financial Controller",
          lineage: "Defined at year-end close; locked during fiscal year; changes require Finance approval",
          quality: "High — locked vocabulary, single source",
          access: "Read-only via API",
          privacy: "Internal — no personal data",
        },
      },
      {
        label: "Historical invoice archive",
        value: "12-month rolling archive in the accounting system",
        options: [
          "12-month rolling archive in the accounting system",
          "Multi-year archive on shared drive",
          "Vendor portals (each supplier separately)",
          "No archive — only current month available",
        ],
        why:
          "12 months covers the seasonal cycle and gives enough vendor variety for evaluation. Multi-year is over-collection (GDPR minimisation). Per-supplier portals fragment access. No archive = no Gate 2 — you can't evaluate accuracy without a labelled past.",
        governance: {
          ownership: "AP Team Lead",
          lineage: "Posted invoices archived nightly with full metadata",
          quality: "High for last 12 months; degraded for older records (format drift)",
          access: "Read-only via API",
          privacy: "Confidential — financial; contains personal data",
        },
      },
    ],
    computed: {
      label: "Layer 01 readout — five sources, five named owners, four read-only APIs",
      body:
        "No source has 'IT' as the owner — every entry names an accountable individual. Four of five sources are reachable via read-only API; the supplier master is the only read-write path, and IBAN changes are gated by HITL. Privacy classification is consistent: financial + personal data, no residency complications inside EU.",
    },
  },

  contextualRules: {
    intro:
      "Five contextual rules that govern an OCR system in this context. Each rule has a regime classification and a consequence if ignored. The chips show alternative framings we rejected.",
    rows: [
      {
        label: "VAT calculation rules",
        value: "VAT — standard rate + e-invoicing controls",
        options: [
          "VAT — standard rate only",
          "VAT — standard rate + e-invoicing controls",
          "Cross-border multi-country flow",
          "Let the model figure out the right rate",
        ],
        why:
          "VAT and e-invoicing controls need deterministic rule tables, not model guesses. 'Let the model figure out' is the failure mode.",
        governance: {
          ownership: "Tax Manager",
          lineage: "e-invoicing requirements -> internal VAT policy doc -> applied to OCR rule engine",
          quality: "High — local rates and e-invoicing controls documented, schedule updates monitored",
          access: "Internal policy document + rate API (if available)",
          privacy: "Internal — no personal data",
        },
      },
      {
        label: "Data protection regime",
        value: "GDPR — supplier contacts are personal data; processing purpose documented",
        options: [
          "Not applicable — these are business contacts",
          "GDPR — supplier contacts are personal data; processing purpose documented",
          "GDPR + sector-specific (banking/sector regulator)",
          "We'll handle it case-by-case",
        ],
        why:
          "Business email addresses and named individuals are personal data under GDPR. Sector overlays apply for regulated industries. 'Case-by-case' is what gets flagged in audit.",
        governance: {
          ownership: "Data Protection Officer",
          lineage: "GDPR processing purpose documented in the processing register",
          quality: "High — documented in processing register",
          access: "Policy in shared drive; processing register in compliance tool",
          privacy: "Personal data, purpose-limited processing, transfer review if data leaves EU",
        },
      },
      {
        label: "EU AI Act classification",
        value: "Standard-control — AP automation is not a high-impact AI decision",
        options: [
          "Not applicable — we don't use AI",
          "Standard-control — AP automation is not a high-impact AI decision",
          "Transparency-control — user-facing AI disclosure applies",
          "High-impact — financial decisioning",
        ],
        why:
          "AP automation extracts and validates; it does not decide creditworthiness, employment, or biometric identity. Treat it as standard-control AI with EU AI Act documentation, GDPR posture, and ISO 42001 data classification. High-impact would add stronger validation and oversight.",
        governance: {
          ownership: "Head of Legal / DPO",
          lineage: "EU AI Act/GDPR/ISO 42001 analysis -> internal classification memo",
          quality: "Medium — classification memo exists but not formally signed off",
          access: "Compliance shared drive",
          privacy: "Internal — no personal data in the classification itself",
        },
      },
      {
        label: "Internal approval policy",
        value: "Two-tier — <EUR 4k auto-route to category owner; ≥EUR 4k requires CFO co-signature",
        options: [
          "Single tier — everything goes to the CFO",
          "Two-tier — <EUR 4k auto-route to category owner; ≥EUR 4k requires CFO co-signature",
          "Three-tier — by amount × supplier risk × cost centre",
          "Whatever the AP team decides on the day",
        ],
        why:
          "Single-tier creates a CFO bottleneck. Three-tier is over-engineered for this volume. 'Whatever the AP team decides' is the implicit policy that audit always catches — and it's the one the OCR system would silently inherit if it isn't named here.",
        governance: {
          ownership: "Financial Controller",
          lineage: "Documented in AP policy v3.2; reviewed annually at year-end close",
          quality: "Medium — written policy exists; ~10% of invoices route differently in practice",
          access: "AP policy doc on shared drive",
          privacy: "Internal — no personal data",
        },
      },
      {
        label: "Cross-border / residency rules",
        value: "EU-hosted supplier flow — transfer review for occasional offshore processing",
        options: [
          "All processing stays in EU — no extra transfer rules",
          "EU-hosted supplier flow — transfer review for occasional offshore processing",
          "Mixed EU + global vendor — processor and transfer review",
          "Case-by-case transfer impact assessment",
        ],
        why:
          "'No extra rules' fails the moment a vendor or processor touches personal data outside the approved hosting pattern. Cross-border transfer and processor evidence need to be explicit.",
        governance: {
          ownership: "Data Protection Officer",
          lineage: "GDPR transfer review stored in compliance tool; processor terms per supplier",
          quality: "High for approved processors; gaps for one-off transfers",
          access: "Compliance tool + signed copies in supplier records",
          privacy: "Personal data, cross-border review, EU residency preferred",
        },
      },
    ],
    computed: {
      label: "Layer 02 readout — five regimes, all named, two with known quality gaps",
      body:
        "VAT, GDPR, and EU AI Act classification are documented. Internal approval policy is the weakest link — the gap between the written policy (v3.2) and actual practice (~10% drift) shows up at every audit. Cross-border processor evidence is good for active suppliers but thin for one-off transfers. No regime is unaddressed; two have known quality gaps to close before Build.",
    },
  },

  testSet: {
    intro:
      "A minimum viable OCR test set: 15 invoices across three buckets. Each row names the bucket, the composition rationale, a sample case, and which failure mode it tests.",
    rows: [
      {
        label: "Clean cases (5 invoices)",
        value: "Textbook layouts · single page · EU suppliers · standard 15% VAT",
        options: [
          "All the same supplier (low variance)",
          "Textbook layouts · single page · EU suppliers · standard 15% VAT",
          "A mix of every layout we've ever seen",
          "Random sample from last month's archive",
        ],
        why:
          "Textbook cases set the baseline accuracy. Same-supplier is too narrow; 'every layout' confounds clean and edge in one bucket; random sample doesn't guarantee bucket coverage. The clean bucket exists to answer: does the system get the easy cases right, every time?",
        governance: {
          ownership: "AP Team Lead",
          lineage: "Manually curated from Q4 archive; labelled and frozen for evaluation",
          quality: "Verified — every field hand-checked against the source PDF",
          access: "Read-only evaluation set; not in production stream",
          privacy: "Anonymised — supplier names and amounts redacted in display copy",
        },
      },
      {
        label: "Edge cases (5 invoices)",
        value: "Missing PO · foreign currency · multi-page · hand-written annotation · duplicate of prior month",
        options: [
          "Whatever last quarter's exceptions were",
          "Missing PO · foreign currency · multi-page · hand-written annotation · duplicate of prior month",
          "Three random failure cases",
          "Only the failure mode we care about most",
        ],
        why:
          "Edge cases are the ones that fail silently. We pick five specific failure modes we've seen in production and put one of each in the bucket. 'Last quarter's exceptions' overweights whatever happened to be loud; 'three random failure cases' is under-coverage; 'only the one we care about' makes the system worse on every other mode.",
        governance: {
          ownership: "AP Team Lead",
          lineage: "Failure modes catalogued from incident log; one example per mode pulled from archive",
          quality: "Verified — each case carries the expected output (what 'correct' looks like)",
          access: "Read-only evaluation set",
          privacy: "Anonymised",
        },
      },
      {
        label: "Adversarial cases (5 invoices)",
        value: "Typo'd amounts · swapped VAT rate · invented supplier · manipulated total · scan-quality stress test",
        options: [
          "We don't test adversarial — we trust suppliers",
          "Typo'd amounts · swapped VAT rate · invented supplier · manipulated total · scan-quality stress test",
          "Real fraud cases from the past year",
          "Whatever the security team gives us",
        ],
        why:
          "Adversarial cases test refusal, not accuracy. A correct response to 'invented supplier' is to flag and stop, not to extract. 'We trust suppliers' is the position that turns fraud detection from a system property into a manual review burden. Real fraud cases are scarce and sensitive; synthesised adversarial cases reproduce the failure modes without exposing live evidence.",
        governance: {
          ownership: "Internal Audit (joint with AP Team Lead)",
          lineage: "Synthesised from fraud-typology research; each case mapped to a control objective",
          quality: "Verified — expected outputs include 'flag and refuse', not just 'extract correctly'",
          access: "Read-only evaluation set; not visible in production logs",
          privacy: "Fully synthetic — no real supplier or amount data",
        },
      },
    ],
    computed: {
      label: "Layer 03 readout — 15 invoices, three buckets, one named owner per bucket",
      body:
        "Total set size (15) is small enough to hand-curate, large enough to give the engine signal. Adversarial cases are fully synthetic — none come from real fraud events. Bucket ownership is split between AP and Internal Audit, which is the correct boundary: AP owns 'does it work', Audit owns 'does it refuse'.",
    },
  },

  gapOptions: [
    "We don't have a named owner for the supplier master — it's maintained by 'whoever notices'",
    "Our chart of accounts changes mid-fiscal-year and the rule engine isn't notified",
    "We don't have a historical archive longer than 3 months — past accuracy is unmeasurable",
    "VAT rules for cross-border invoices aren't documented — we apply 'whatever last time was'",
    "We have a written approval policy but real practice drifts from it by 10%+",
    "We have no processor or transfer evidence for occasional offshore supplier processing",
    "Our test set has no edge cases — only clean invoices ever get evaluated",
    "We have no adversarial cases — fraud detection is entirely manual review",
    "GDPR lawful basis for supplier contacts isn't documented in our processing register",
    "EU AI Act classification has never been formally signed off (memo exists, no signature)",
  ] as const,

  seeds: {
    "m02.test_set": {
      clean: 5,
      edge: 5,
      adversarial: 5,
    },
  },

  methodNote:
    "Every data layer has a gap. Naming it is the first deliverable. M02 is not done when the layers are listed — it's done when the gaps are named.",
} as const;

// ── Profile-driven content functions ────────────────────────────────────────

export function getM02InternalSourceOptions(ctx: InvoiceOcrProfileContext): string[] {
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  return [
    `Supplier master in ${accounting}`,
    "Invoice archive (received PDFs)",
    "Purchase order records (procurement system)",
    `Chart of accounts in ${accounting}`,
    "Historical posting archive (last 12 months)",
    "Bank account / IBAN register (separately maintained)",
    "Cost-centre or department mapping",
  ];
}

export function getM02ContextualRuleOptions(ctx: InvoiceOcrProfileContext): string[] {
  const country = ctx.country ?? null;
  const vatLine = country
    ? `${country} VAT rules (standard + reduced rates that apply to our business)`
    : "VAT rules (standard + reduced rates that apply to our business)";
  const crossBorder = country
    ? `Cross-border / residency rules for non-${country} suppliers`
    : "Cross-border / residency rules for non-domestic suppliers";

  return [
    vatLine,
    "GDPR — supplier contacts and personal data handling",
    "EU AI Act governance classification (low / limited / high risk)",
    "Internal approval policy (thresholds, signatures)",
    crossBorder,
    "Sector-specific regulation (if our industry has one)",
    "Supplier contract terms (payment windows, dispute paths)",
    "Internal audit trail and retention requirements",
  ];
}
