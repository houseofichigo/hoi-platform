import type { ProfileSchema } from "@/lib/profile/schema";
import { INVOICE_OCR_PROFILE_SCHEMA, INVOICE_OCR_PROFILE_DEFAULTS } from "./invoice-ocr/profile";

export type WorkedExampleId = 'invoice_ocr' | 'devis_generation' | 'hr_ticket_triage' | 'customer_email' | 'custom';

export interface WorkedExampleMeta {
  id: WorkedExampleId;
  name: string;
  shortName: string;
  caseName: string;
  entityName: string;
  industry: string;
  function: string;
  status: 'published' | 'coming_soon';
  description: string;
  contextBlurb: string;
  useCaseProfileSchema: ProfileSchema;
  useCaseProfileDefaults?: Record<string, string | string[]>;
}

export const WORKED_EXAMPLES: WorkedExampleMeta[] = [
  {
    id: 'invoice_ocr',
    name: 'Invoice OCR for Accounts Payable',
    shortName: 'Invoice OCR',
    caseName: 'the OCR invoice case',
    entityName: 'invoices',
    industry: 'Finance / Accounts Payable',
    function: 'Finance',
    status: 'published',
    description: 'Mid-market manufacturer automating supplier invoice processing.',
    contextBlurb:
      'An AP team manually keys ~8,000 supplier invoices per month into the ERP. High-volume, error-prone, auditable. Representative of the most common AI candidate inside operations functions.',
    useCaseProfileSchema: INVOICE_OCR_PROFILE_SCHEMA,
    useCaseProfileDefaults: {
      ...INVOICE_OCR_PROFILE_DEFAULTS,
      currencies: [...INVOICE_OCR_PROFILE_DEFAULTS.currencies],
      products: [...INVOICE_OCR_PROFILE_DEFAULTS.products],
      supplier_categories: [...INVOICE_OCR_PROFILE_DEFAULTS.supplier_categories],
    },
  },
];

export function getWorkedExample(id: WorkedExampleId | string | null | undefined): WorkedExampleMeta | null {
  if (!id) return null;
  return WORKED_EXAMPLES.find((e) => e.id === id) ?? null;
}

export function getPublishedWorkedExamples(): WorkedExampleMeta[] {
  return WORKED_EXAMPLES.filter((e) => e.status === 'published');
}

/** Gracefully resolve a stored worked_example value, falling back to invoice_ocr if it points to a non-published id. */
export function resolveWorkedExample(stored: string | null | undefined): WorkedExampleMeta | null {
  if (!stored) return null;
  const match = WORKED_EXAMPLES.find((e) => e.id === stored && e.status === 'published');
  if (match) return match;
  return WORKED_EXAMPLES.find((e) => e.id === 'invoice_ocr') ?? null;
}
