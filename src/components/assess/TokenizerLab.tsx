import { useMemo, useState } from "react";

// --- Configurable estimates ----------------------------------------------
// Prices per 1M tokens (USD). Update here when model prices change.
const MODELS = {
  low: { label: "Low-cost model", input: 0.15, output: 0.6 },
  standard: { label: "Standard model", input: 2.5, output: 10 },
  premium: { label: "Premium model", input: 10, output: 30 },
} as const;

type ModelKey = keyof typeof MODELS;

const SAMPLES: { id: string; label: string; text: string }[] = [
  {
    id: "invoice_line",
    label: "Short invoice line",
    text: "Invoice 2025-0381 · Supplier: Acme GmbH · Net 1.250,00 EUR · VAT 19% 237,50 EUR · Total 1.487,50 EUR · Due 2026-06-30",
  },
  {
    id: "messy_ocr",
    label: "Messy OCR invoice text",
    text:
      "lNV0lCE  N°  20Z5-O381\nSUPPLlER : Ac me  Gm bH\nN€T   1.25O,OO  €  VAT  l9%  237,5O\nTOTAL    l,487.5O EUR\nDUE   3O-O6-2O26    REF# 8839/A\n--- OCR ARTIFACTS ---\n||||  ::  ||  scan-noise  ||  ||",
  },
  {
    id: "supplier_email",
    label: "Long supplier email",
    text:
      "Dear Accounts Payable,\n\nPlease find attached invoice 2025-0381 for the consulting engagement covering May 1 through May 31. As discussed, the engagement scope included two on-site workshops, four remote review sessions, and the delivery of the final readiness report. The invoice reflects the agreed daily rate plus travel expenses approved by your procurement team.\n\nPayment is due within 30 days per our master services agreement. Please confirm receipt and let me know if you need a purchase order reference, a breakdown of travel costs, or an additional VAT statement for your accounting system.\n\nKind regards,\nMaria — Acme GmbH",
  },
  {
    id: "policy",
    label: "Policy document excerpt",
    text:
      "All supplier invoices above EUR 1,000 require dual approval: the budget owner and the finance controller. Invoices flagged with low OCR confidence on any monetary field must be routed to manual review and may not be auto-posted. Reviewers are responsible for verifying VAT treatment against the supplier country and ensuring the purchase order reference is present. Any deviation must be logged in the audit trail with a reason code selected from the approved list.",
  },
];

// --- Lightweight pseudo-tokenizer ----------------------------------------
// Not a real BPE; produces visually meaningful chunks similar to what learners
// see in OpenAI's tokenizer: long words split into sub-pieces, punctuation and
// whitespace as their own tokens, numbers grouped.
function tokenize(text: string): string[] {
  if (!text) return [];
  const parts = text.match(/(\s+|\d+|[A-Za-z]+|[^\s\w])/g) ?? [];
  const tokens: string[] = [];
  for (const part of parts) {
    if (/^[A-Za-z]+$/.test(part) && part.length > 5) {
      for (let i = 0; i < part.length; i += 4) {
        tokens.push(part.slice(i, i + 4));
      }
    } else if (/^\d+$/.test(part) && part.length > 3) {
      for (let i = 0; i < part.length; i += 3) {
        tokens.push(part.slice(i, i + 3));
      }
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

// Pastel chip palette inspired by OpenAI's tokenizer view.
const CHIP_COLORS = [
  "rgba(255, 179, 102, 0.55)",
  "rgba(255, 217, 102, 0.55)",
  "rgba(163, 230, 165, 0.55)",
  "rgba(125, 211, 252, 0.55)",
  "rgba(196, 181, 253, 0.55)",
  "rgba(244, 168, 195, 0.55)",
  "rgba(252, 211, 77, 0.55)",
  "rgba(110, 231, 183, 0.55)",
];

function colorFor(tok: string, idx: number): string {
  // Deterministic per-token hash so identical tokens get the same shade,
  // mixed with index so neighbours never collide.
  let h = idx;
  for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) | 0;
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}

function fmtUSD(n: number): string {
  if (n === 0) return "$0.0000";
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

interface Props {
  /** Compact = inline panel for Work page; full = Study page lab. */
  compact?: boolean;
  /** Optional: notify parent of current input token count + model. */
  onChange?: (state: { inputTokens: number; model: ModelKey }) => void;
}

export function TokenizerLab({ compact = false, onChange }: Props) {
  const [text, setText] = useState<string>(SAMPLES[0].text);
  const [model, setModel] = useState<ModelKey>("standard");
  const [outputRatio, setOutputRatio] = useState<number>(0.5);
  const [view, setView] = useState<"text" | "ids">("text");

  const tokens = useMemo(() => tokenize(text), [text]);
  const inputTokens = tokens.length;
  const outputTokens = useMemo(
    () => Math.max(1, Math.round(inputTokens * outputRatio)),
    [inputTokens, outputRatio],
  );

  const m = MODELS[model];
  const inputCost = (inputTokens * m.input) / 1_000_000;
  const outputCost = (outputTokens * m.output) / 1_000_000;
  const totalPerRun = inputCost + outputCost;

  useMemo(() => {
    onChange?.({ inputTokens, model });
  }, [inputTokens, model, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow-muted">TOKENIZER LAB</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
          Approximate · not billing truth
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-medium text-navy">Try a preset</p>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setText(s.text)}
              className="rounded-full border border-chalk bg-paper px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.1em] text-slate hover:border-terracotta hover:text-terracotta"
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setText("")}
            className="rounded-full border border-chalk bg-paper px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.1em] text-slate hover:border-slate"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[12px] font-medium text-navy">Text</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={compact ? 4 : 8}
          placeholder="Paste or edit text to see token + cost estimates."
          className="w-full rounded-md border border-chalk bg-paper p-3 font-mono text-[12px] leading-relaxed text-navy outline-none focus:border-terracotta"
        />
        <p className="font-mono text-[11px] text-slate">
          {text.length} chars · {inputTokens} tokens
        </p>
      </div>

      {/* Tokenized visualization (live, colored chips) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-navy">Tokenized view</p>
          <div className="inline-flex overflow-hidden rounded-md border border-chalk">
            <button
              type="button"
              onClick={() => setView("text")}
              className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                view === "text" ? "bg-navy text-white" : "bg-paper text-slate hover:text-navy"
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setView("ids")}
              className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                view === "ids" ? "bg-navy text-white" : "bg-paper text-slate hover:text-navy"
              }`}
            >
              Token IDs
            </button>
          </div>
        </div>
        <div className="min-h-[80px] rounded-md border border-chalk bg-white p-3 font-mono text-[12px] leading-[1.9] text-navy">
          {tokens.length === 0 ? (
            <span className="text-slate">Tokens will appear here as you type…</span>
          ) : view === "text" ? (
            tokens.map((tok, i) => {
              // Render whitespace tokens as raw spacing (incl. newlines) so the
              // visualization preserves line breaks without coloring blank chips.
              if (/^\s+$/.test(tok)) {
                return (
                  <span key={i} style={{ whiteSpace: "pre-wrap" }}>
                    {tok}
                  </span>
                );
              }
              return (
                <span
                  key={i}
                  style={{
                    backgroundColor: colorFor(tok, i),
                    padding: "1px 2px",
                    borderRadius: 3,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {tok}
                </span>
              );
            })
          ) : (
            <span className="break-all text-[11px] text-slate">
              [{tokens.map((tok, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: colorFor(tok, i),
                    padding: "0 3px",
                    margin: "0 2px",
                    borderRadius: 3,
                    color: "var(--ichigo-navy, #1e2b4d)",
                  }}
                >
                  {/* Pseudo-id derived from hash — purely illustrative */}
                  {(Math.abs(
                    (tok.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, i) % 99000) +
                      1000,
                  )).toString()}
                </span>
              ))}]
            </span>
          )}
        </div>
        <p className="text-[10px] italic text-slate">
          Illustrative tokenization — colors group sub-word pieces so you can see how a model
          would chunk this text. Real tokenizers (BPE, SentencePiece) split differently.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[12px] font-medium text-navy">Model tier</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelKey)}
            className="w-full rounded-md border border-chalk bg-paper p-2 text-[13px] text-navy outline-none focus:border-terracotta"
          >
            {(Object.keys(MODELS) as ModelKey[]).map((k) => (
              <option key={k} value={k}>
                {MODELS[k].label} — ${MODELS[k].input}/M in · ${MODELS[k].output}/M out
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[12px] font-medium text-navy">
            Expected output length: {Math.round(outputRatio * 100)}% of input
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={outputRatio}
            onChange={(e) => setOutputRatio(Number(e.target.value))}
            className="w-full accent-terracotta"
          />
        </label>
      </div>

      <div className="grid gap-2 rounded-md border border-chalk bg-white p-3 sm:grid-cols-3">
        <Stat label="Input tokens" value={inputTokens.toLocaleString()} />
        <Stat label="Output tokens" value={outputTokens.toLocaleString()} />
        <Stat label="Cost / run" value={fmtUSD(totalPerRun)} highlight />
        <Stat label="Input cost / run" value={fmtUSD(inputCost)} muted />
        <Stat label="Output cost / run" value={fmtUSD(outputCost)} muted />
        <Stat label="—" value="" />
        <Stat label="× 100 runs" value={fmtUSD(totalPerRun * 100)} />
        <Stat label="× 1,000 runs" value={fmtUSD(totalPerRun * 1000)} />
        <Stat label="× 10,000 runs" value={fmtUSD(totalPerRun * 10000)} />
      </div>

      <p className="text-[11px] italic text-slate">
        Estimates use a simplified tokenizer. Real token counts depend on the model's
        tokenizer; real bills depend on your provider invoice. Use this lab to build intuition,
        not to forecast billing.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`space-y-0.5 ${muted ? "opacity-70" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{label}</p>
      <p
        className={`font-mono ${
          highlight ? "text-[16px] font-semibold text-terracotta" : "text-[13px] text-navy"
        }`}
      >
        {value || "\u00A0"}
      </p>
    </div>
  );
}
