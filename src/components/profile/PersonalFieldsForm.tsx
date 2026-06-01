import { DEPARTMENT_OTHER, DEPARTMENT_PRESETS } from "@/lib/profile/departments";

interface PersonalFieldsProps {
  jobRole: string;
  department: string;
  onJobRoleChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  /** Optional layout — "card" matches profile card row style, "form" matches onboarding inputs. */
  variant?: "card" | "form";
}

/**
 * Editable inputs for the optional personal profile fields (job role + department).
 * Department is a dropdown with an "Other" sentinel that reveals a free-text input.
 */
export function PersonalFieldsForm({
  jobRole,
  department,
  onJobRoleChange,
  onDepartmentChange,
  variant = "form",
}: PersonalFieldsProps) {
  const presetSet = new Set<string>(DEPARTMENT_PRESETS);
  const isPreset = presetSet.has(department);
  const isCustom = department.length > 0 && !isPreset;
  const SENTINEL = "__custom__";
  const selectValue = isPreset ? department : isCustom ? SENTINEL : "";

  const labelClass =
    variant === "card"
      ? "text-[12px] font-mono uppercase tracking-[0.16em] text-slate"
      : "block text-[13px] font-medium text-navy";
  const inputClass =
    variant === "card"
      ? "mt-2 w-full rounded-md border border-chalk bg-white px-3 py-2 text-[14px] text-navy focus:border-terracotta focus:outline-none"
      : "input-ichigo mt-1.5 w-full";

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Job role (optional)</label>
        <input
          type="text"
          value={jobRole}
          onChange={(e) => onJobRoleChange(e.target.value)}
          placeholder="e.g. Head of Operations"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Department (optional)</label>
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === SENTINEL) onDepartmentChange(isCustom ? department : "");
            else onDepartmentChange(v);
          }}
          className={inputClass}
        >
          <option value="">Select…</option>
          {DEPARTMENT_PRESETS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value={SENTINEL}>{DEPARTMENT_OTHER}…</option>
        </select>
        {(selectValue === SENTINEL || isCustom) && (
          <input
            type="text"
            value={isPreset ? "" : department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder="Describe your department"
            className={`${inputClass} mt-2`}
          />
        )}
      </div>
    </div>
  );
}
