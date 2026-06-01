import type {
  DriftRule,
  DriftTypeId,
} from "@/lib/worked-examples/invoice-ocr/m11";

export interface DriftRuleState {
  detection: string;
  response: string;
}

interface Props {
  rules: readonly DriftRule[];
  state: Record<DriftTypeId, DriftRuleState>;
  onChange: (id: DriftTypeId, next: DriftRuleState) => void;
}

/**
 * Drift rule UX: each drift type ships with a reference detection signal
 * and response. The user reviews and adopts them with a single checkbox.
 * Custom prose stays available under "Advanced edit" but is never required.
 *
 * State shape is preserved: { detection, response } as strings, so
 * downstream output key `m11.drift_response` is unchanged.
 */
export function DriftRuleCards({ rules, state, onChange }: Props) {
  return (
    <div className="space-y-3">
      {rules.map((r) => {
        const s = state[r.id] ?? { detection: "", response: "" };
        const adopted =
          s.detection.trim() === r.detectionSignal.trim() &&
          s.response.trim() === r.response.trim();
        const filled =
          s.detection.trim().length > 0 && s.response.trim().length > 0;
        const customized = filled && !adopted;

        return (
          <div
            key={r.id}
            className={`card space-y-3 border-l-[3px] ${
              filled ? "border-l-terracotta" : "border-l-chalk"
            }`}
          >
            <div>
              <p className="eyebrow-muted">{r.label.toUpperCase()}</p>
              <p className="mt-1 text-[13px] text-slate">
                <span className="font-medium">Reference signal: </span>
                {r.detectionSignal}
              </p>
              <p className="text-[13px] text-slate">
                <span className="font-medium">Reference response: </span>
                {r.response}
              </p>
              <p className="text-[12px] text-slate">
                <span className="font-medium">Re-scoring trigger: </span>
                {r.rescoringTrigger}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-navy">
              <input
                type="checkbox"
                checked={filled}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange(r.id, {
                      detection: r.detectionSignal,
                      response: r.response,
                    });
                  } else {
                    onChange(r.id, { detection: "", response: "" });
                  }
                }}
                className="mt-0.5 h-4 w-4 accent-terracotta"
              />
              <span>
                Adopt the reference detection signal and response for{" "}
                <span className="font-medium">{r.label.toLowerCase()}</span>
                {customized ? (
                  <span className="ml-1 text-[12px] text-slate">
                    (edited)
                  </span>
                ) : null}
              </span>
            </label>

            <details className="group rounded-md border border-chalk bg-paper">
              <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate hover:text-navy">
                Advanced edit (optional)
              </summary>
              <div className="space-y-3 p-3 pt-2">
                <label className="space-y-1 block">
                  <span className="eyebrow-muted">DETECTION RULE</span>
                  <textarea
                    value={s.detection}
                    onChange={(e) =>
                      onChange(r.id, { ...s, detection: e.target.value })
                    }
                    rows={2}
                    placeholder={r.detectionSignal}
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="eyebrow-muted">RESPONSE</span>
                  <textarea
                    value={s.response}
                    onChange={(e) =>
                      onChange(r.id, { ...s, response: e.target.value })
                    }
                    rows={2}
                    placeholder={r.response}
                    className="w-full rounded-md border border-chalk bg-paper p-2 font-mono text-[12px] text-navy outline-none focus:border-terracotta"
                  />
                </label>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
