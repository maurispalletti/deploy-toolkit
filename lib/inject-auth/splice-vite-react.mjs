// splice-vite-react — given the contents of a Vite-React `App.jsx`,
// idempotently splice in:
//
//   1. `import SignInWithGoogle from "./SignInWithGoogle.jsx";` after the
//      last existing top-level `import` line.
//   2. `<SignInWithGoogle />` as the first child of the top-level JSX
//      element returned by the default-exported component.
//
// This is intentionally a regex-based splice rather than a full AST
// rewrite. Reasons:
//
//   - We don't want a runtime dep on @babel/parser / acorn / typescript.
//   - "Vibecoded" App.jsx files we've seen are small and shape-regular:
//     a few imports, one default-exported function/arrow, a return
//     statement with JSX.
//   - When the file is too weird to recognise confidently, we BAIL —
//     return `{ ok: false, reason }`. Callers fall back to the
//     refactor-prompt path. We'd rather skip than corrupt user code.
//
// Public API:
//
//   spliceViteReactAppJsx(source, opts?) → {
//     ok: true,
//     content: string,         // the modified source
//     changed: boolean,        // false when already-spliced (no-op)
//     notes: string[]          // optional human-readable notes
//   } | {
//     ok: false,
//     reason: string,          // why we couldn't splice
//     content: string          // unchanged source (so callers can pass through)
//   }
//
// Idempotency rules:
//   - If a `SignInWithGoogle` import already exists (any path), skip the
//     import splice.
//   - If the source already references `<SignInWithGoogle` anywhere
//     (case-sensitive), skip the JSX splice.
//   - If both are already present, return changed=false.
//
// Conservative bailouts (return ok=false):
//   - No JSX `return ( ... )` we can parse.
//   - The returned JSX has no openable top-level element (e.g. a
//     conditional return of `null` or a primitive).
//   - The top-level element opens as a fragment shorthand `<>` mid-line
//     with non-trivial leading content (we handle plain fragments, but
//     unusual prefixes like `return cond ? <>…</> : null;` we punt on).

const IMPORT_RE = /^\s*import\s.+?["'][^"']+["'];?\s*$/;
const SIGNIN_IMPORT_RE = /\bimport\s+SignInWithGoogle\b/;
const SIGNIN_JSX_RE = /<SignInWithGoogle\b/;

// Tries to find the default-exported component's return JSX block.
// Returns { start, end, openEnd } indices into source, or null if we
// couldn't locate it confidently. `start` points at the first char of
// the matched JSX (`<` of the opening tag). `openEnd` points at the
// first char AFTER the matched opening tag's `>`.
function findReturnedJsxRange(source) {
  // Strategy: find every `return (` followed by JSX, prefer the LAST one
  // (Likely the export-default function), then locate the opening tag.
  // We use indexOf scans rather than regex because we need to walk past
  // JSX-style attributes that can contain `>` inside strings.
  const candidates = [];
  const reParen = /return\s*\(\s*</g;
  const reBare = /return\s+</g;
  let m;
  while ((m = reParen.exec(source)) !== null) {
    candidates.push({ openIdx: m.index + m[0].length - 1, kind: "paren" });
  }
  // For `return <Foo>` (no paren) — but ONLY if the next non-space char
  // is a JSX element. We re-scan.
  while ((m = reBare.exec(source)) !== null) {
    // Skip if this index is already covered by a paren return.
    const overlap = candidates.find(c => Math.abs(c.openIdx - (m.index + m[0].length - 1)) < 6);
    if (overlap) continue;
    candidates.push({ openIdx: m.index + m[0].length - 1, kind: "bare" });
  }
  if (candidates.length === 0) return null;

  // Prefer the LAST candidate — App.jsx files usually have helper
  // returns earlier (e.g. inside conditionals) but the export-default
  // is the bottom-most function. The bottom-most return is the safest
  // guess.
  candidates.sort((a, b) => a.openIdx - b.openIdx);
  const pick = candidates[candidates.length - 1];

  // Now walk forward to find the end of the opening tag (first
  // unbalanced `>` that isn't inside a quoted attribute).
  const openIdx = pick.openIdx;
  if (source[openIdx] !== "<") return null;

  // Detect fragments: `<>` or `<React.Fragment ...>`.
  // For `<>` the next char is `>` — we still want to splice INSIDE the
  // fragment so the new child sits between `<>` and the existing first child.
  let i = openIdx + 1;
  // Skip the opening tag's name and attributes until matching `>`.
  let quote = null;
  let inBrace = 0;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    // JSX expression containers `{ ... }` inside attributes — count
    // braces so a `>` inside an expression isn't treated as end-of-tag.
    if (ch === "{") { inBrace++; i++; continue; }
    if (ch === "}") { inBrace = Math.max(0, inBrace - 1); i++; continue; }
    if (inBrace > 0) { i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
    if (ch === ">") {
      // Self-closing `/>` — we can't splice a child INTO a self-closing
      // element. Bail.
      if (source[i - 1] === "/") return { selfClosing: true };
      return { start: openIdx, openEnd: i + 1, selfClosing: false };
    }
    i++;
  }
  return null;
}

// Find the index just after the LAST top-level `import` line. Returns
// 0 if no import lines were found (then we insert at top).
function findInsertAfterImports(source) {
  const lines = source.split("\n");
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (IMPORT_RE.test(lines[i])) lastImportLine = i;
  }
  if (lastImportLine === -1) return 0;
  // Index just after the trailing newline of the last import line.
  let offset = 0;
  for (let i = 0; i <= lastImportLine; i++) {
    offset += lines[i].length + 1; // +1 for the "\n" we split on
  }
  return offset;
}

export function spliceViteReactAppJsx(source, opts = {}) {
  if (typeof source !== "string") {
    return { ok: false, reason: "source-not-string", content: "" };
  }
  const importPath = opts.importPath ?? "./SignInWithGoogle.jsx";

  let working = source;
  const notes = [];

  const hasImport = SIGNIN_IMPORT_RE.test(working);
  const hasJsx = SIGNIN_JSX_RE.test(working);

  // Idempotent shortcut: both already present.
  if (hasImport && hasJsx) {
    return { ok: true, content: working, changed: false, notes: ["already-spliced"] };
  }

  // ── Step 1: splice the import ───────────────────────────────────────
  if (!hasImport) {
    const insertAt = findInsertAfterImports(working);
    const importLine = `import SignInWithGoogle from "${importPath}";\n`;
    // If there were no imports, leave a blank line after our new import.
    const suffix = insertAt === 0 ? "\n" : "";
    working = working.slice(0, insertAt) + importLine + suffix + working.slice(insertAt);
    notes.push("import-added");
  } else {
    notes.push("import-already-present");
  }

  // ── Step 2: splice the JSX into the returned element ────────────────
  if (!hasJsx) {
    const range = findReturnedJsxRange(working);
    if (!range) {
      return {
        ok: false,
        reason: "no-returned-jsx",
        content: source  // give back the original — we don't want a half-done splice on disk
      };
    }
    if (range.selfClosing) {
      return {
        ok: false,
        reason: "top-element-is-self-closing",
        content: source
      };
    }
    const before = working.slice(0, range.openEnd);
    const after = working.slice(range.openEnd);
    // Detect indentation of the next non-empty line inside the JSX so the
    // injected child sits in the right column.
    const afterTrim = after.replace(/^\n*/, "");
    const indentMatch = afterTrim.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : "      ";
    // If `after` starts with `</` (immediately-closing element), don't
    // double up newlines — insert on its own line.
    const insertion = `\n${indent}<SignInWithGoogle />`;
    working = before + insertion + after;
    notes.push("jsx-added");
  } else {
    notes.push("jsx-already-present");
  }

  return { ok: true, content: working, changed: true, notes };
}
