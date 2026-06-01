/** A single field in a profile form. The renderer chooses the input type from `kind`. */
export type ProfileField =
  | {
      key: string;
      label: string;
      hint?: string;
      placeholder?: string;
      required: boolean;
      kind: "text";
    }
  | {
      key: string;
      label: string;
      hint?: string;
      required: boolean;
      kind: "select";
      options: readonly string[];
    }
  | {
      key: string;
      label: string;
      hint?: string;
      required: boolean;
      kind: "grouped_select";
      groups: ReadonlyArray<{ label: string; options: readonly string[] }>;
    }
  | {
      key: string;
      label: string;
      hint?: string;
      required: boolean;
      kind: "multiselect";
      options: readonly string[];
      allowCustom?: boolean;
    }
  | {
      key: string;
      label: string;
      hint?: string;
      placeholder?: string;
      required: boolean;
      kind: "chip_input";
    }
  | {
      key: string;
      label: string;
      hint?: string;
      required: boolean;
      kind: "preset_or_custom";
      presets: readonly string[];
      customLabel: string;
      customPlaceholder?: string;
    };

export type ProfileSchema = readonly ProfileField[];

export type ProfileValues = Record<string, string | string[] | undefined>;

/** Validates that all `required: true` fields in the schema have a non-empty value. */
export function isProfileComplete(schema: ProfileSchema, values: ProfileValues): boolean {
  return schema.every((field) => {
    if (!field.required) return true;
    const v = values[field.key];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Strips unknown keys and returns only values that match the schema. Safe to upsert. */
export function pruneProfileValues(schema: ProfileSchema, values: ProfileValues): ProfileValues {
  const keys = new Set(schema.map((f) => f.key));
  const out: ProfileValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (keys.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}
