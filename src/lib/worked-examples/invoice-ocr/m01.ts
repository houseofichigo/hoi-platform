// Worked-example-specific content for the Invoice OCR case applied to Module 01.

/**
 * Profile context passed from a module component into worked-example content
 * functions. All fields are optional — every consumer should provide a fallback
 * for the case where the profile field isn't filled in yet.
 */
export interface InvoiceOcrProfileContext {
  companyName?: string;        // workspace.name
  accountingSoftware?: string; // use_case_profile.invoice_ocr.accounting_software
  country?: string;            // workspace_profile.country
  invoiceVolume?: string;      // use_case_profile.invoice_ocr.invoice_volume
  vatContext?: string;         // use_case_profile.invoice_ocr.vat_context
}

export const M01_OCR_CONTENT = {
  placeholder: false,

  storyHeader:
    "The Smart Intern. An LLM is the smartest, fastest, most confident intern you've ever hired — who occasionally invents facts with the same confidence it states real ones. Today's job: feel the texture of a hallucination.",

  seeds: {
    'm01.reflection': [
      "Low temperature → consistent, deterministic answers — fits invoice extraction and structured tasks",
      "For OCR / accounting, defaults that minimise creativity are the right call",
    ],
  },

  step1: {
    title: "Hallucination Hunt",
    why: "Ask the same question twice — once without web search, once with. Notice what changes.",
    example:
      "The same question yields very different answers depending on whether the model is allowed to look things up. Without web search, it invents flight counts with full confidence.",
    whatToNotice: [
      "Confidence is independent of correctness",
      "Web search closes the gap on fact-checkable questions but doesn't eliminate hallucination",
    ],
    produces: "The Brief, section 1 (Scepticism log)",
    nextLabel: "Step 2 — Parameter playground",
    prompts: {
      withoutSearch: "Don't use web search.\n\nHow many flights go from Montpellier to Tunis?",
      withSearch: "Use web search.\n\nHow many flights go from Montpellier to Tunis?",
    },
  },

  step2: {
    title: "Parameter Playground",
    why: "Same question, different generation behavior. Three parameters: temperature, top-k, top-p.",
    example:
      "You can't directly set these on every chat product, but asking the model to \"act as if\" parameter X is set to Y is a useful proxy to feel the spread.",
    whatToNotice: [
      "Low temperature → deterministic, factual, repetitive",
      "High temperature / top-k / top-p → creative, varied, riskier on facts",
    ],
    produces: "The Brief, section 2 (Parameter notes)",
    nextLabel: "Method note → marks M01 complete",
    experiments: {
      temperature: {
        label: "Temperature — randomness control",
        low: { label: "Low temperature (0.1)", prompt: "Act as if your temperature is set to 0.1.\n\nExplain how a neural network works." },
        high: { label: "High temperature (0.9)", prompt: "Act as if your temperature is set to 0.9.\n\nExplain how a neural network works." },
      },
      topK: {
        label: "Top-k — choice pool size",
        low: { label: "Low top-k (10)", prompt: "Act as if top-k is set to 10.\n\nExplain blockchain technology." },
        high: { label: "High top-k (100)", prompt: "Act as if top-k is set to 100.\n\nExplain blockchain technology." },
      },
      topP: {
        label: "Top-p — probability threshold",
        low: { label: "Low top-p (0.4)", prompt: "Act as if top-p is set to 0.4.\n\nExplain cloud computing." },
        high: { label: "High top-p (0.95)", prompt: "Act as if top-p is set to 0.95.\n\nExplain cloud computing." },
      },
    },
    reflectionOptions: [
      "Low temperature → consistent, deterministic answers — fits invoice extraction and structured tasks",
      "High temperature → creative variation — fits brainstorming, copywriting, naming",
      "Top-k caps the candidate pool — lower = safer, higher = more variety",
      "Top-p (nucleus) adapts the pool to context — flexible but harder to predict",
      "For OCR / accounting, defaults that minimise creativity are the right call",
      "For ideation or marketing copy, looser settings produce richer outputs",
    ],
  },

  methodNote: {
    title: "What you'll carry into every chapter",
    why: "Each chapter ends with a single method note — the one transferable lesson you'll re-use beyond this training.",
    produces: "Method Notes archive (visible in the Handoff Pack)",
    nextLabel: "Marks M01 complete and unlocks M02",
  },
};

/**
 * The six "dangerous task" options for M01 Step 3 (method note).
 *
 * Each option is the kind of task at this company where a confidently-wrong AI
 * answer would cause real damage. Substitutes are applied where available;
 * falls back to safe generics otherwise.
 */
export function getM01DangerousTaskOptions(ctx: InvoiceOcrProfileContext): string[] {
  const company = ctx.companyName ?? "your company";
  const accounting = ctx.accountingSoftware ?? "the accounting system";
  const country = ctx.country ?? null;
  const vatLine = country
    ? `Generating a VAT return line or tax declaration entry (${country})`
    : "Generating a VAT return line or tax declaration entry";

  return [
    `Posting an invoice amount to the general ledger in ${accounting}`,
    "Approving a change to a supplier's bank details (IBAN)",
    vatLine,
    "Auto-categorising an expense to a tax-deductible account",
    "Matching an invoice to a purchase order without human review",
    `Triggering a payment to a supplier on behalf of ${company}`,
  ];
}
