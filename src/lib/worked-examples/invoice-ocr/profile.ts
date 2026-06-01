import type { ProfileSchema } from "@/lib/profile/schema";

const SOFTWARE_GROUPS = [
  {
    label: "Cloud / modern",
    options: [
      "Pennylane", "Dext (formerly Receipt Bank)", "Qonto", "Indy", "Tiime",
      "Fygr", "Libeo", "Spendesk", "iPaidThat", "Georges.tech",
      "QuickBooks Online", "Xero", "FreshBooks", "Zoho Books",
    ],
  },
  {
    label: "Traditional / on-premise",
    options: [
      "Sage 100 (ex-Ligne 100)", "Sage 50 (ex-Ciel Compta)", "Cegid Loop / Cegid XRP",
      "EBP Compta", "ACD (Agiris)", "Quadratus / Cegid Quadra", "Coala", "ISAGRI", "Ciel (legacy)",
    ],
  },
  {
    label: "ERP / enterprise",
    options: [
      "SAP Business One", "SAP S/4HANA", "Oracle NetSuite", "Microsoft Dynamics 365 BC",
      "Odoo", "Divalto", "Sage X3", "Infor M3",
    ],
  },
  {
    label: "Invoicing-only / billing",
    options: [
      "Facture.net", "Henrri", "Sellsy", "Axonaut", "Evoliz",
      "PayFit (payroll + expenses)", "Sinao",
    ],
  },
  { label: "Other", options: ["Excel / manual", "Other"] },
] as const;

const INVOICE_VOLUMES = ["<50", "50-200", "200-1000", "1000-5000", "5000+"] as const;

const VAT_PRESETS = [
  "France standard 20% only",
  "France standard 20% + reduced 5.5% (food/agriculture)",
  "France standard 20% + reduced 10% (services/renovation)",
  "France standard 20% + intra-EU reverse charge",
  "France standard 20% + import VAT (non-EU suppliers)",
  "France standard 20% + reduced 5.5% + import VAT",
  "EU multi-country (OSS regime)",
  "VAT-exempt (Article 293 B — micro-enterprise)",
  "Mixed — multiple rates and regimes",
] as const;

const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "MAD", "TND", "SAR",
  "AED", "QAR", "XOF", "SEK", "DKK", "NOK", "PLN", "CZK", "RON", "CNY",
  "SGD", "HKD", "Other",
] as const;

const SUPPLIER_CATEGORIES = [
  "Raw materials",
  "Finished goods / merchandise",
  "Packaging & labelling",
  "Freight & logistics (EU)",
  "Freight & logistics (international)",
  "IT & software",
  "Professional services (legal, audit, consulting)",
  "Marketing & communications",
  "Office supplies & equipment",
  "Utilities & telecom",
  "Temporary staffing",
  "Maintenance & facilities",
  "Insurance",
  "Travel & expenses",
  "Subcontractors / freelancers",
] as const;

export const INVOICE_OCR_PROFILE_SCHEMA: ProfileSchema = [
  {
    key: "accounting_software",
    label: "Accounting software",
    kind: "grouped_select",
    groups: SOFTWARE_GROUPS,
    required: true,
  },
  {
    key: "invoice_volume",
    label: "Invoice volume / month",
    kind: "select",
    options: INVOICE_VOLUMES,
    required: true,
  },
  {
    key: "vat_context",
    label: "VAT context",
    kind: "preset_or_custom",
    presets: VAT_PRESETS,
    customLabel: "Custom (type below)",
    customPlaceholder: "Describe your VAT setup",
    required: true,
  },
  {
    key: "currencies",
    label: "Currencies",
    kind: "multiselect",
    options: CURRENCIES,
    required: true,
  },
  {
    key: "products",
    label: "Products / services",
    hint: "Type and press Enter to add tags.",
    placeholder: "e.g. Loose-leaf tea",
    kind: "chip_input",
    required: false,
  },
  {
    key: "supplier_categories",
    label: "Supplier categories",
    kind: "multiselect",
    options: SUPPLIER_CATEGORIES,
    allowCustom: true,
    required: true,
  },
] as const;

export const INVOICE_OCR_PROFILE_DEFAULTS = {
  accounting_software: "Pennylane",
  invoice_volume: "50-200",
  vat_context: "",
  currencies: ["EUR"],
  products: [],
  supplier_categories: [],
} as const;
