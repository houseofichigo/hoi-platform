import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useUseCase,
  useCaptures,
  useSaveCapture,
  useSubmitUseCase,
} from "@/hooks/useBuild";
import { scoreUseCase } from "@/lib/scoring.functions";
import {
  STEPS,
  isFieldFilled,
  validateStep,
  type FieldDef,
  type StepDef,
  type WizardValues,
} from "@/lib/build/wizard-schema";

export const Route = createFileRoute("/app/$workspaceSlug/build/capture/$useCaseId")({
  component: CaptureWizardPage,
});


function CaptureWizardPage() {
  const { workspaceSlug, useCaseId } = Route.useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const { data: useCase, isLoading } = useUseCase(useCaseId);
  const { data: captures = [] } = useCaptures(useCaseId);
  const save = useSaveCapture(useCaseId);
  const submit = useSubmitUseCase();
  const score = useServerFn(scoreUseCase);

  const completedBlocks = useMemo(
    () => new Set(captures.filter((c) => c.completed_at).map((c) => c.block_number)),
    [captures],
  );

  // Resume at first incomplete step; if all done, stay on the last step.
  const firstIncomplete = STEPS.findIndex((s) => !completedBlocks.has(s.number));
  const [stepIdx, setStepIdx] = useState(firstIncomplete === -1 ? STEPS.length - 1 : Math.max(firstIncomplete, 0));

  const step = STEPS[stepIdx];
  const existing = useMemo(
    () => captures.find((c) => c.block_number === step.number),
    [captures, step.number],
  );

  const [values, setValues] = useState<WizardValues>({});
  useEffect(() => {
    setValues((existing?.responses as WizardValues) ?? {});
  }, [existing, stepIdx]);

  const [showErrors, setShowErrors] = useState(false);

  if (!workspace) return null;
  if (isLoading) return <p className="text-[13px] text-graphite">Loading…</p>;
  if (!useCase) return <p className="text-[13px] text-graphite">Use case not found.</p>;

  const allComplete = STEPS.every((s) => completedBlocks.has(s.number));
  const progress = step.progress;

  const setValue = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  const saveBlock = async (markComplete: boolean) => {
    await save.mutateAsync({
      block_number: step.number,
      block_title: step.shortTitle,
      responses: values,
      completed: markComplete,
    });
  };

  const handleSaveDraft = async () => {
    try {
      await saveBlock(false);
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const goNext = async () => {
    const missing = validateStep(step, values);
    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(`Complete required fields: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
      return;
    }
    try {
      await saveBlock(true);
      setShowErrors(false);
      if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else navigate({ to: "/app/$workspaceSlug/build/capture", params: { workspaceSlug } });
  };

  const submitFinal = async () => {
    const valuesByStep = new Map<number, WizardValues>();
    for (const s of STEPS) {
      const saved = captures.find((c) => c.block_number === s.number)?.responses as WizardValues | undefined;
      valuesByStep.set(s.number, s.number === step.number ? values : saved ?? {});
    }
    const missing = STEPS.flatMap((s) =>
      validateStep(s, valuesByStep.get(s.number) ?? {}).map((label) => `${s.shortTitle}: ${label}`),
    );
    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(`Complete required fields before generating: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
      return;
    }
    try {
      await saveBlock(true);
      await score({ data: { use_case_id: useCaseId } });
      await submit.mutateAsync(useCaseId);
      toast.success("Recommendation generated and submitted for approval");
      navigate({ to: "/app/$workspaceSlug/build/approvals", params: { workspaceSlug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          to="/app/$workspaceSlug/build/capture"
          params={{ workspaceSlug }}
          className="inline-flex items-center gap-1 text-[13px] text-graphite hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> All drafts
        </Link>
        <p className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
          {useCase.function} · {useCase.status}
        </p>
      </div>

      <header>
        <h1 className="font-display text-[26px] text-navy">{useCase.name}</h1>
        {useCase.description && (
          <p className="mt-1 text-[14px] text-graphite">{useCase.description}</p>
        )}
      </header>

      {/* Stepper + progress bar (persistent) */}
      <Stepper
        currentNumber={step.number}
        completedBlocks={completedBlocks}
        progress={progress}
        onJump={(idx) => setStepIdx(idx)}
      />

      <QuickGuide step={step} />

      <section className="card">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy bg-paper font-mono text-[13px] text-navy">
            {step.number}
          </span>
          <div>
            <h2 className="font-display text-[22px] text-navy">{step.title}</h2>
            <p className="mt-1 text-[13px] text-graphite">{step.subtitle}</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {step.fields.map((f) => (
            <FieldRenderer
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => setValue(f.key, v)}
              showError={showErrors}
            />
          ))}
        </div>
      </section>

      <FooterBar
        onBack={goBack}
        onSaveDraft={handleSaveDraft}
        onContinue={stepIdx < STEPS.length - 1 ? goNext : submitFinal}
        isFinal={stepIdx === STEPS.length - 1}
        saving={save.isPending}
        submitting={submit.isPending}
        allComplete={allComplete}
      />
    </div>
  );
}

/* -------------------- Stepper -------------------- */

function Stepper({
  currentNumber,
  completedBlocks,
  progress,
  onJump,
}: {
  currentNumber: number;
  completedBlocks: Set<number>;
  progress: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-4">
        <ol className="flex flex-1 flex-wrap items-center gap-2">
          {STEPS.map((s, idx) => {
            const done = completedBlocks.has(s.number);
            const active = currentNumber === s.number;
            return (
              <li key={s.number} className="flex items-center gap-2">
                <button
                  onClick={() => onJump(idx)}
                  className={[
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition",
                    active
                      ? "border-terracotta bg-terracotta text-white"
                      : done
                      ? "border-navy bg-paper text-navy"
                      : "border-chalk bg-paper text-graphite hover:border-navy",
                  ].join(" ")}
                >
                  <span className="font-mono">{s.number}</span>
                  {done && !active && <Check className="h-3 w-3" />}
                  <span className="font-medium">{s.shortTitle}</span>
                </button>
                {idx < STEPS.length - 1 && <span className="text-graphite">→</span>}
              </li>
            );
          })}
        </ol>
        <div className="min-w-[180px]">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.16em] text-slate">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-chalk">
            <div
              className="h-full bg-terracotta transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


/* -------------------- Quick Guide -------------------- */

function QuickGuide({ step }: { step: StepDef }) {
  return (
    <section className="rounded-md border border-chalk bg-chalk/30 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <GuideBlock label="Why this matters" body={step.guide.why} />
        <GuideBlock label="What to notice" body={step.guide.notice} />
        {step.guide.example && <GuideBlock label="Example" body={step.guide.example} />}
      </div>
    </section>
  );
}

function GuideBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate">{label}</p>
      <p className="mt-1 text-[12.5px] text-navy">{body}</p>
    </div>
  );
}

/* -------------------- Footer -------------------- */

function FooterBar({
  onBack,
  onSaveDraft,
  onContinue,
  isFinal,
  saving,
  submitting,
  allComplete,
}: {
  onBack: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
  isFinal: boolean;
  saving: boolean;
  submitting: boolean;
  allComplete: boolean;
}) {
  return (
    <div className="sticky bottom-0 -mx-2 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-chalk bg-paper/95 px-3 py-3 backdrop-blur">
      <button
        onClick={onBack}
        className="rounded-md border border-chalk px-3 py-2 text-[13px] text-navy hover:border-navy"
      >
        Back
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onSaveDraft}
          disabled={saving}
          className="rounded-md border border-navy px-3 py-2 text-[13px] font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-60"
        >
          Save draft
        </button>
        {isFinal ? (
          <button
            onClick={onContinue}
            disabled={saving || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting…" : "Generate My Use Case Recommendation"}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onContinue}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {isFinal && !allComplete && (
        <p className="w-full text-[12px] text-graphite">
          Tip: every step must be marked complete before the final submission triggers approval.
        </p>
      )}
    </div>
  );
}

/* -------------------- Field renderer -------------------- */

function FieldRenderer({
  field,
  value,
  onChange,
  showError,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  showError: boolean;
}) {
  const invalid = showError && field.required && !isFieldFilled(field, value);

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <label className="text-[13px] font-medium text-navy">
          {field.label}
          {field.required && <span className="ml-1 text-terracotta">*</span>}
        </label>
        {field.helper && <span className="text-[11.5px] text-graphite">{field.helper}</span>}
      </div>
      <div className="mt-2">
        {renderInput(field, value, onChange)}
      </div>
      {invalid && (
        <p className="mt-1 text-[11.5px] text-terracotta">Required.</p>
      )}
    </div>
  );
}

function renderInput(field: FieldDef, value: unknown, onChange: (v: unknown) => void) {
  switch (field.kind) {
    case "text":
      return (
        <input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          className="w-full rounded-md border border-chalk bg-paper px-3 py-2 text-[14px] outline-none focus:border-terracotta"
        />
      );
    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full rounded-md border border-chalk bg-paper px-3 py-2 text-[14px] outline-none focus:border-terracotta"
        />
      );
    case "radio":
      return <RadioGrid field={field} value={value as string} onChange={onChange} />;
    case "radio-cards":
      return <RadioCards field={field} value={value as string} onChange={onChange} />;
    case "checkbox-grid":
      return <CheckboxGrid field={field} value={(value as string[]) ?? []} onChange={onChange} />;
    case "chips":
      return <ChipGroup field={field} value={(value as string[]) ?? []} onChange={onChange} />;
    case "accordion-checkboxes":
      return <AccordionCheckboxes field={field} value={(value as string[]) ?? []} onChange={onChange} />;
    case "repeater":
      return <Repeater field={field} value={(value as Record<string, string>[]) ?? []} onChange={onChange} />;
  }
}

/* -------------------- Inputs -------------------- */

function RadioGrid({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const cols = field.cols === 2 ? "sm:grid-cols-2" : "";
  return (
    <div className={`grid gap-2 ${cols}`}>
      {field.options?.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            className={[
              "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-[13px] transition",
              selected
                ? "border-navy bg-navy/5 text-navy"
                : "border-chalk bg-paper text-navy hover:border-navy",
              o.advanced ? "ring-1 ring-terracotta/40" : "",
            ].join(" ")}
          >
            <input
              type="radio"
              name={field.key}
              checked={selected}
              onChange={() => onChange(o.value)}
              className="mt-0.5"
            />
            <span className="flex-1">
              {o.label}
              {o.advanced && (
                <span className="ml-2 rounded-full bg-terracotta/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-terracotta">
                  advanced
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function RadioCards({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const cols = field.cols === 2 ? "sm:grid-cols-2" : "";
  return (
    <div className={`grid gap-2 ${cols}`}>
      {field.options?.map((o) => {
        const selected = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={[
              "flex flex-col items-start gap-1 rounded-md border px-3 py-3 text-left transition",
              selected
                ? "border-terracotta bg-terracotta/5"
                : "border-chalk bg-paper hover:border-navy",
              o.advanced ? "ring-1 ring-terracotta/40" : "",
            ].join(" ")}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-navy">{o.label}</span>
              {o.advanced && (
                <span className="rounded-full bg-terracotta/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-terracotta">
                  advanced
                </span>
              )}
            </span>
            {o.helper && <span className="text-[12px] text-graphite">{o.helper}</span>}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxGrid({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const cols = field.cols === 2 ? "sm:grid-cols-2" : "";
  const atMax = field.maxSelect != null && value.length >= field.maxSelect;
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!atMax) onChange([...value, v]);
  };
  return (
    <div>
      <div className={`grid gap-2 ${cols}`}>
        {field.options?.map((o) => {
          const selected = value.includes(o.value);
          const disabled = !selected && atMax;
          return (
            <label
              key={o.value}
              className={[
                "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-[13px] transition",
                selected
                  ? "border-navy bg-navy/5 text-navy"
                  : disabled
                  ? "border-chalk bg-paper text-graphite opacity-60"
                  : "border-chalk bg-paper text-navy hover:border-navy",
                o.advanced ? "ring-1 ring-terracotta/40" : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => toggle(o.value)}
                className="mt-0.5"
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {(field.maxSelect != null || field.minSelect != null) && (
        <p className="mt-2 text-[11px] text-graphite">
          {value.length} selected
          {field.maxSelect != null && ` · max ${field.maxSelect}`}
          {field.minSelect != null && ` · min ${field.minSelect}`}
        </p>
      )}
    </div>
  );
}

function ChipGroup({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {field.options?.map((o) => {
        const selected = value.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => toggle(o.value)}
            className={[
              "rounded-full border px-3 py-1 text-[12.5px] transition",
              selected
                ? "border-navy bg-navy text-white"
                : "border-chalk bg-paper text-navy hover:border-navy",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AccordionCheckboxes({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((field.groups ?? []).map((g, i) => [g.label, i === 0])),
  );
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  const noneKey = field.noneOption?.key;
  return (
    <div className="space-y-2">
      {field.groups?.map((g) => (
        <div key={g.label} className="rounded-md border border-chalk bg-paper">
          <button
            type="button"
            onClick={() => setOpen((s) => ({ ...s, [g.label]: !s[g.label] }))}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-[13px] font-medium text-navy">{g.label}</span>
            <ChevronDown
              className={`h-4 w-4 text-graphite transition ${open[g.label] ? "rotate-180" : ""}`}
            />
          </button>
          {open[g.label] && (
            <div className="border-t border-chalk px-3 py-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {g.options.map((o) => {
                  const selected = value.includes(o.value);
                  return (
                    <label
                      key={o.value}
                      className="flex cursor-pointer items-start gap-2 text-[13px] text-navy"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(o.value)}
                        className="mt-0.5"
                      />
                      <span>{o.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
      {noneKey && (
        <label className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-navy">
          <input
            type="checkbox"
            checked={value.includes(noneKey)}
            onChange={() => toggle(noneKey)}
          />
          <span>{field.noneOption?.label}</span>
        </label>
      )}
    </div>
  );
}

function Repeater({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
}) {
  const cols = field.columns ?? [];
  const atMax = field.maxRows != null && value.length >= field.maxRows;
  const update = (idx: number, key: string, v: string) => {
    const next = value.map((row, i) => (i === idx ? { ...row, [key]: v } : row));
    onChange(next);
  };
  const add = () => {
    if (atMax) return;
    onChange([...value, Object.fromEntries(cols.map((c) => [c.key, ""])) as Record<string, string>]);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-[12px] text-graphite">No rows yet.</p>
      )}
      {value.map((row, idx) => (
        <div
          key={idx}
          className="grid items-center gap-2 rounded-md border border-chalk bg-paper p-2"
          style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr)) auto` }}
        >
          {cols.map((c) => (
            <div key={c.key}>
              {c.type === "select" ? (
                <select
                  value={row[c.key] ?? ""}
                  onChange={(e) => update(idx, c.key, e.target.value)}
                  className="w-full rounded-md border border-chalk bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-terracotta"
                >
                  <option value="">{c.label}…</option>
                  {c.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={row[c.key] ?? ""}
                  onChange={(e) => update(idx, c.key, e.target.value)}
                  placeholder={c.label}
                  className="w-full rounded-md border border-chalk bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-terracotta"
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => remove(idx)}
            className="rounded-md border border-chalk p-1.5 text-graphite hover:border-terracotta hover:text-terracotta"
            aria-label="Remove row"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={atMax}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-chalk px-3 py-1.5 text-[12.5px] text-navy hover:border-navy disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" /> Add{field.maxRows != null && ` (${value.length}/${field.maxRows})`}
      </button>
    </div>
  );
}
