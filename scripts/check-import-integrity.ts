/**
 * Source-tree integrity guard.
 *
 * Fails the build if any "@/..." alias import points to a file that does not
 * exist on disk, or if required route/shell invariants are violated.
 *
 * Run with: bun scripts/check-import-integrity.ts
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const ALIAS_PREFIX = "@/";
const ALIAS_TARGET = join(ROOT, "src");
const EXT_CANDIDATES = ["", ".ts", ".tsx", ".js", ".jsx"];
const INDEX_CANDIDATES = ["index.ts", "index.tsx", "index.js", "index.jsx"];

// ---------------------------------------------------------------------------
// Walk: collect all .ts/.tsx files under src/ and scripts/
// ---------------------------------------------------------------------------
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".git") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "scripts"))];

// ---------------------------------------------------------------------------
// Extract alias imports (static, type, dynamic, re-exports)
// ---------------------------------------------------------------------------
const IMPORT_PATTERNS: RegExp[] = [
  // import ... from "@/..."         (covers `import type` too)
  /\bimport\s+(?:type\s+)?[^"';]*?\bfrom\s*["']([^"']+)["']/g,
  // import "@/..."                  (side-effect)
  /\bimport\s*["']([^"']+)["']/g,
  // export ... from "@/..."
  /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\}|[A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["']/g,
  // dynamic import("@/...")
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function stripComments(src: string): string {
  // Remove /* ... */ block comments and // line comments so regex examples
  // inside comments don't get flagged as real imports.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function extractAliasImports(src: string): string[] {
  const cleaned = stripComments(src);
  const found = new Set<string>();
  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      const spec = m[1];
      if (spec.startsWith(ALIAS_PREFIX)) found.add(spec);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Resolve a "@/..." specifier to a real file
// ---------------------------------------------------------------------------
function resolveAlias(spec: string): string | null {
  const rel = spec.slice(ALIAS_PREFIX.length);
  const base = join(ALIAS_TARGET, rel);

  for (const ext of EXT_CANDIDATES) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const idx of INDEX_CANDIDATES) {
      const candidate = join(base, idx);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1) Scan imports
// ---------------------------------------------------------------------------
const missing: { file: string; spec: string }[] = [];
let importsChecked = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const specs = extractAliasImports(src);
  for (const spec of specs) {
    importsChecked++;
    if (!resolveAlias(spec)) {
      missing.push({ file: relative(ROOT, file), spec });
    }
  }
}

// ---------------------------------------------------------------------------
// 2) Route + shell invariants
// ---------------------------------------------------------------------------
const REQUIRED_ROUTES = [
  "src/routes/app.$workspaceSlug.build.tsx",
  "src/routes/app.$workspaceSlug.scale.tsx",
  "src/routes/app.$workspaceSlug.build.index.tsx",
  "src/routes/app.$workspaceSlug.scale.index.tsx",
];

const invariantErrors: string[] = [];

for (const rel of REQUIRED_ROUTES) {
  if (!existsSync(join(ROOT, rel))) {
    invariantErrors.push(`required route missing: ${rel}`);
  }
}

const TOPSHELL = "src/components/TopShell.tsx";
const topShellPath = join(ROOT, TOPSHELL);
if (!existsSync(topShellPath)) {
  invariantErrors.push(`required file missing: ${TOPSHELL}`);
} else {
  const src = readFileSync(topShellPath, "utf8");
  const labels = ["Assess", "Discover", "Build", "Scale"];
  const positions = labels.map((l) => src.indexOf(`"${l}"`));
  for (let i = 0; i < labels.length; i++) {
    if (positions[i] < 0) {
      invariantErrors.push(`${TOPSHELL}: missing phase label "${labels[i]}"`);
    }
  }
  if (positions.every((p) => p >= 0)) {
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] <= positions[i - 1]) {
        invariantErrors.push(
          `${TOPSHELL}: phase order must be Assess → Discover → Build → Scale ` +
            `(found "${labels[i]}" before "${labels[i - 1]}")`,
        );
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const hasErrors = missing.length > 0 || invariantErrors.length > 0;

if (missing.length > 0) {
  console.error(`\n✗ ${missing.length} missing alias import(s):\n`);
  for (const { file, spec } of missing) {
    console.error(`  ${file} -> ${spec} MISSING`);
  }
}

if (invariantErrors.length > 0) {
  console.error(`\n✗ ${invariantErrors.length} route/shell invariant violation(s):\n`);
  for (const e of invariantErrors) console.error(`  ${e}`);
}

if (hasErrors) {
  console.error(
    `\n  Scanned ${files.length} files, ${importsChecked} alias imports.\n`,
  );
  process.exit(1);
}

console.log(
  `✓ import integrity check passed (${files.length} files, ${importsChecked} alias imports, ${REQUIRED_ROUTES.length} routes verified, phase order OK)`,
);
