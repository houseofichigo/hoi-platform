import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { submitPostPilotReview } from "@/lib/scale/scale.functions";

export const Route = createFileRoute("/app/$workspaceSlug/scale/$useCaseId/review")({
  component: PostPilotReview,
});

const LOADS = [
  { v: "reduced", label: "Reduced" },
  { v: "unchanged", label: "Unchanged" },
  { v: "increased", label: "Increased" },
] as const;
const SAT = [
  { v: "positive", label: "Positive" },
  { v: "neutral", label: "Neutral" },
  { v: "negative", label: "Negative" },
] as const;
const RECS = [
  { v: "promote_to_production", label: "Promote to production", hint: "Unlocks Pilot → Production." },
  { v: "extend_pilot", label: "Extend pilot", hint: "Keep iterating with current cohort." },
  { v: "redesign", label: "Redesign", hint: "Material changes required before retrying." },
  { v: "retire", label: "Retire", hint: "Do not continue this use case." },
] as const;

type LoadV = (typeof LOADS)[number]["v"];
type SatV = (typeof SAT)[number]["v"];
type RecV = (typeof RECS)[number]["v"];

function PostPilotReview() {
  const { workspaceSlug, useCaseId } = Route.useParams();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitPostPilotReview);

  const [accuracy, setAccuracy] = useState<number>(80);
  const [accuracySet, setAccuracySet] = useState(false);
  const [hours, setHours] = useState<string>("");
  const [errorRate, setErrorRate] = useState<string>("");
  const [load, setLoad] = useState<LoadV | "">("");
  const [sat, setSat] = useState<SatV | "">("");
  const [rec, setRec] = useState<RecV | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: uc } = useQuery({
    queryKey: ["use_case_for_review", useCaseId],
    enabled: !!useCaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_cases")
        .select("id, name, function, workspace_id")
        .eq("id", useCaseId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["post_pilot_reviews", useCaseId],
    enabled: !!useCaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_pilot_reviews")
        .select("id, submitted_by, submitted_at, recommendation, accuracy_score, time_saved_hours_per_week, error_rate_percent, reviewer_load, user_satisfaction, evidence_notes")
        .eq("use_case_id", useCaseId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: submitterMap = {} } = useQuery({
    queryKey: ["post_pilot_review_submitters", history.map((h) => h.submitted_by).join(",")],
    enabled: history.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(history.map((h) => h.submitted_by).filter(Boolean))) as string[];
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.user_id] = p.full_name ?? "Member";
      return map;
    },
  });

  if (!workspace) return null;

  const canSubmit = rec !== "" && notes.trim().length >= 10 && !busy;

  const submit = async () => {
    if (!uc || !rec) return;
    setBusy(true);
    try {
      const res = await submitFn({
        data: {
          useCaseId: uc.id,
          accuracyScore: accuracySet ? accuracy : null,
          timeSavedHoursPerWeek: hours ? Number(hours) : null,
          errorRatePercent: errorRate ? Number(errorRate) : null,
          reviewerLoad: load || null,
          userSatisfaction: sat || null,
          recommendation: rec,
          evidenceNotes: notes.trim(),
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Pilot review submitted");
      qc.invalidateQueries({ queryKey: ["post_pilot_reviews", useCaseId] });
      qc.invalidateQueries({ queryKey: ["roadmap_entries"] });
      navigate({ to: "/app/$workspaceSlug/scale/roadmap", params: { workspaceSlug } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <p className="eyebrow">SCALE · PILOT REVIEW</p>
        <h1 className="h-display-sm mt-2">Pilot review.</h1>
        <p className="text-[13px] text-graphite mt-1">
          Capture pilot evidence before promoting a use case to production.
        </p>
        {uc && (
          <p className="text-[12px] text-slate mt-2">
            For <span className="font-medium text-navy">{uc.name}</span>
            {uc.function ? ` · ${uc.function}` : ""}
          </p>
        )}
      </header>

      <div className="card space-y-5">
        <div className="rounded border border-chalk bg-mist/40 p-2.5 text-[12px] text-graphite">
          <span className="font-medium text-navy">How this unlocks production: </span>
          Pilot → Production is blocked until the latest review here recommends{" "}
          <span className="font-medium text-navy">Promote to production</span>.
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-medium text-navy">Accuracy score</p>
            <p className="text-[12px] text-graphite">
              {accuracySet ? `${accuracy}%` : "Not set"}
            </p>
          </div>
          <Slider
            value={[accuracy]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => {
              setAccuracy(v[0] ?? 0);
              setAccuracySet(true);
            }}
            className="mt-2"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <NumField label="Time saved (hours/week)" value={hours} onChange={setHours} step="0.5" min="0" />
          <NumField label="Error rate (%)" value={errorRate} onChange={setErrorRate} step="0.1" min="0" max="100" />
        </div>

        <ChipRow
          label="Reviewer load"
          value={load}
          options={LOADS}
          onChange={(v) => setLoad(v as LoadV | "")}
        />
        <ChipRow
          label="User satisfaction"
          value={sat}
          options={SAT}
          onChange={(v) => setSat(v as SatV | "")}
        />

        <div>
          <p className="text-[12px] font-medium text-navy mb-1">Recommendation</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RECS.map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => setRec(rec === r.v ? "" : r.v)}
                className={[
                  "rounded border p-2 text-left",
                  rec === r.v
                    ? "border-navy bg-navy text-white"
                    : "border-chalk bg-paper text-navy hover:bg-mist",
                ].join(" ")}
              >
                <p className="text-[13px] font-medium">{r.label}</p>
                <p className={[
                  "text-[11px] mt-0.5",
                  rec === r.v ? "text-white/80" : "text-graphite",
                ].join(" ")}>{r.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-medium text-navy">Evidence notes</p>
            <p className="text-[11px] text-slate">{notes.trim().length} / 10 min</p>
          </div>
          <p className="text-[11px] text-graphite mb-1">
            One short paragraph: what shipped, what worked, what didn't.
          </p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Link
            to="/app/$workspaceSlug/scale/roadmap"
            params={{ workspaceSlug }}
            className="text-[12px] text-graphite hover:text-navy underline"
          >
            ← Back to roadmap
          </Link>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-full bg-terracotta px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-[16px] text-navy">Review history</h2>
        {history.length === 0 ? (
          <p className="text-[12px] text-slate">No reviews yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="card space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-navy">
                    {recLabel(r.recommendation)}
                  </p>
                  <p className="text-[11px] text-slate">
                    {submitterMap[r.submitted_by ?? ""] ?? "Member"} ·{" "}
                    {new Date(r.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-graphite">
                  {r.accuracy_score != null && <span>Accuracy {Number(r.accuracy_score)}%</span>}
                  {r.time_saved_hours_per_week != null && (
                    <span>Saves {Number(r.time_saved_hours_per_week)} h/wk</span>
                  )}
                  {r.error_rate_percent != null && <span>Errors {Number(r.error_rate_percent)}%</span>}
                  {r.reviewer_load && <span>Reviewer load: {r.reviewer_load}</span>}
                  {r.user_satisfaction && <span>Users: {r.user_satisfaction}</span>}
                </div>
                {r.evidence_notes && (
                  <p className="text-[12px] text-navy whitespace-pre-wrap">{r.evidence_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function recLabel(v: string | null): string {
  const found = RECS.find((r) => r.v === v);
  return found?.label ?? (v ?? "—");
}

function NumField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-navy">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        className="mt-1 w-full rounded border border-chalk bg-paper px-2 py-1 text-[13px]"
      />
    </label>
  );
}

function ChipRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ v: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-[12px] font-medium text-navy mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(value === o.v ? "" : o.v)}
            className={[
              "rounded-full px-2.5 py-1 text-[12px] border",
              value === o.v
                ? "bg-navy text-white border-navy"
                : "bg-paper text-navy border-chalk hover:bg-mist",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
