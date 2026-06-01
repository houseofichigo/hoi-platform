import { useState } from "react";
import type { ProfileField, ProfileSchema, ProfileValues } from "@/lib/profile/schema";

interface ProfileFormProps {
  schema: ProfileSchema;
  initialValues: ProfileValues;
  onSubmit: (values: ProfileValues) => Promise<void> | void;
  submitLabel?: string;
  submitting?: boolean;
  onCancel?: () => void;
}

export function ProfileForm({
  schema,
  initialValues,
  onSubmit,
  submitLabel = "Save and continue",
  submitting = false,
  onCancel,
}: ProfileFormProps) {
  const [values, setValues] = useState<ProfileValues>(initialValues);

  const set = (key: string, value: string | string[]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const valid = schema.every((f) => {
    if (!f.required) return true;
    const v = values[f.key];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !submitting) onSubmit(values);
      }}
      className="space-y-6"
    >
      {schema.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(v) => set(field.key, v)}
        />
      ))}

      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ichigo">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || submitting}
          className="btn-ichigo btn-ichigo-primary"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ProfileField;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const labelEl = (
    <div className="mb-1.5">
      <label className="block text-[13px] font-medium text-navy">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {field.hint && <p className="mt-0.5 text-[12px] text-slate">{field.hint}</p>}
    </div>
  );

  if (field.kind === "text") {
    return (
      <div>
        {labelEl}
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="input-ichigo w-full"
        />
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div>
        {labelEl}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="input-ichigo w-full"
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.kind === "grouped_select") {
    return (
      <div>
        {labelEl}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="input-ichigo w-full"
        >
          <option value="">Select…</option>
          {field.groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  if (field.kind === "multiselect") {
    const current = Array.isArray(value) ? value : [];
    const knownSet = new Set(field.options as readonly string[]);
    const customValues = current.filter((v) => !knownSet.has(v));
    return (
      <div>
        {labelEl}
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const on = current.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onChange(on ? current.filter((x) => x !== o) : [...current, o])
                }
                className={
                  on
                    ? "rounded border border-navy bg-navy px-3 py-1 text-[13px] font-medium text-paper"
                    : "rounded border border-chalk bg-paper px-3 py-1 text-[13px] text-navy hover:border-navy"
                }
              >
                {o}
              </button>
            );
          })}
        </div>
        {field.allowCustom && (
          <div className="mt-3">
            <ChipInputControl
              value={customValues}
              onChange={(custom) =>
                onChange([...current.filter((c) => knownSet.has(c)), ...custom])
              }
              placeholder="Add custom category"
            />
          </div>
        )}
      </div>
    );
  }

  if (field.kind === "chip_input") {
    const current = Array.isArray(value) ? value : [];
    return (
      <div>
        {labelEl}
        <ChipInputControl
          value={current}
          onChange={onChange}
          placeholder={field.placeholder ?? ""}
        />
      </div>
    );
  }

  if (field.kind === "preset_or_custom") {
    const current = (value as string) ?? "";
    const isPreset = (field.presets as readonly string[]).includes(current);
    const showCustom = !isPreset && current.length > 0;
    const SENTINEL = "__custom__";
    return (
      <div>
        {labelEl}
        <select
          value={isPreset ? current : showCustom ? SENTINEL : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === SENTINEL) onChange("");
            else onChange(v);
          }}
          className="input-ichigo w-full"
        >
          <option value="">Select…</option>
          {field.presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={SENTINEL}>{field.customLabel}</option>
        </select>
        {(showCustom || (!isPreset && current === "")) && (
          <input
            type="text"
            value={!isPreset ? current : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.customPlaceholder}
            className="input-ichigo mt-2 w-full"
          />
        )}
      </div>
    );
  }

  return null;
}

function ChipInputControl({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1.5 rounded border border-chalk bg-mist px-2 py-1 text-[13px] text-navy"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-slate hover:text-navy"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            e.preventDefault();
            onChange([...value, draft.trim()]);
            setDraft("");
          }
        }}
        placeholder={placeholder}
        className="input-ichigo w-full"
      />
    </div>
  );
}
