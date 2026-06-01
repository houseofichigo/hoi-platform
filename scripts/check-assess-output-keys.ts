/**
 * Assess output-key guard.
 *
 * Verifies that every canonical output key declared in
 * `src/lib/assess/completion.ts` (ARTIFACTS[].outputKeys) is either:
 *   - written directly via `useAssessOutput("<key>")` in a module work component, OR
 *   - covered by an explicit alias in `OUTPUT_KEY_ALIASES` whose alias key
 *     IS written somewhere via `useAssessOutput("<alias>")`.
 *
 * Run with: bun scripts/check-assess-output-keys.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS, OUTPUT_KEY_ALIASES } from "../src/lib/assess/completion";

const MODULES_DIR = join(process.cwd(), "src/components/assess/modules");

function collectWrittenKeys(): Set<string> {
  const keys = new Set<string>();
  const re = /useAssessOutput\s*(?:<[^>]*>)?\s*\(\s*["']([^"']+)["']/g;
  for (const file of readdirSync(MODULES_DIR)) {
    if (!file.endsWith(".tsx")) continue;
    const src = readFileSync(join(MODULES_DIR, file), "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) keys.add(m[1]);
  }
  return keys;
}

function main() {
  const written = collectWrittenKeys();
  const canonical = new Set<string>();
  for (const a of ARTIFACTS) for (const k of a.outputKeys) canonical.add(k);

  const missing: { key: string; note: string }[] = [];
  for (const key of canonical) {
    if (written.has(key)) continue;
    const aliases = OUTPUT_KEY_ALIASES[key] ?? [];
    const aliasHit = aliases.find((a) => written.has(a));
    if (aliasHit) continue;
    missing.push({
      key,
      note: aliases.length
        ? `no writer for canonical key or any alias [${aliases.join(", ")}]`
        : "no writer and no alias configured",
    });
  }

  // Also surface aliases whose canonical key has no writer AND no alias writer.
  // (Same as above, but explicit so a stale alias map is obvious.)
  const danglingAliases: string[] = [];
  for (const [canonicalKey, aliases] of Object.entries(OUTPUT_KEY_ALIASES)) {
    if (!canonical.has(canonicalKey)) {
      danglingAliases.push(
        `alias entry "${canonicalKey}" -> [${aliases.join(", ")}] does not match any canonical artifact output key`,
      );
    }
  }

  if (missing.length === 0 && danglingAliases.length === 0) {
    console.log(`✓ assess output-key check passed (${canonical.size} canonical keys, ${written.size} written keys)`);
    process.exit(0);
  }

  console.error("✗ assess output-key check failed\n");
  for (const m of missing) console.error(`  missing writer: ${m.key} — ${m.note}`);
  for (const d of danglingAliases) console.error(`  dangling alias: ${d}`);
  process.exit(1);
}

main();
