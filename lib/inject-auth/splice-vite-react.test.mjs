import { test } from "node:test";
import assert from "node:assert/strict";
import { spliceViteReactAppJsx } from "./splice-vite-react.mjs";

test("empty App.jsx (returns plain <div/>) — inserts import + child", () => {
  const src = [
    'import { useState } from "react";',
    "",
    "export default function App() {",
    "  return (",
    "    <div>",
    "      <h1>Hello</h1>",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.ok(out.ok, JSON.stringify(out));
  assert.ok(out.changed);
  // Import placed after the existing `react` import.
  assert.match(out.content, /import \{ useState \} from "react";\s*\nimport SignInWithGoogle from "\.\/SignInWithGoogle\.jsx";/);
  // Child injected inside the <div>, before the existing <h1>.
  assert.match(out.content, /<div>\s*\n\s+<SignInWithGoogle \/>\s*\n\s+<h1>Hello<\/h1>/);
});

test("App.jsx with multiple imports — inserts after the LAST import", () => {
  const src = [
    'import { useState } from "react";',
    'import "./App.css";',
    'import logo from "./logo.svg";',
    "",
    "export default function App() {",
    "  return (",
    "    <main>",
    "      <p>hi</p>",
    "    </main>",
    "  );",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.ok(out.ok);

  // The new import sits AFTER `import logo`, NOT before.
  const logoIdx = out.content.indexOf('import logo from "./logo.svg";');
  const signinIdx = out.content.indexOf('import SignInWithGoogle from "./SignInWithGoogle.jsx";');
  assert.ok(logoIdx > -1 && signinIdx > -1);
  assert.ok(signinIdx > logoIdx, "SignInWithGoogle import must come AFTER logo import");

  // And nothing weird about how many times the import appears.
  const count = out.content.match(/import SignInWithGoogle/g);
  assert.equal(count.length, 1);
});

test("already-spliced — no-op (changed=false, original content)", () => {
  const src = [
    'import { useState } from "react";',
    'import SignInWithGoogle from "./SignInWithGoogle.jsx";',
    "",
    "export default function App() {",
    "  return (",
    "    <div>",
    "      <SignInWithGoogle />",
    "      <h1>Hello</h1>",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.ok(out.ok);
  assert.equal(out.changed, false);
  // The output must be exactly the input (no whitespace drift, no
  // duplicated import, no duplicated JSX child).
  assert.equal(out.content, src);
  // Only one of each.
  assert.equal((out.content.match(/import SignInWithGoogle/g) || []).length, 1);
  assert.equal((out.content.match(/<SignInWithGoogle/g) || []).length, 1);
});

test("unparseable (no return JSX) — returns ok:false, source unchanged", () => {
  const src = [
    'import { useState } from "react";',
    "",
    "// Just a function that doesn't return JSX — we should refuse to splice.",
    "export default function helper() {",
    "  return 42;",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.equal(out.ok, false);
  // The reason field is set so callers can log/branch.
  assert.equal(out.reason, "no-returned-jsx");
  // We return the ORIGINAL source so the caller can pass through
  // unchanged rather than writing a half-spliced file to disk.
  assert.equal(out.content, src);
});

test("self-closing top-level JSX — bails (we can't add children)", () => {
  const src = [
    "export default function App() {",
    "  return (",
    "    <Layout title=\"X\" />",
    "  );",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "top-element-is-self-closing");
  assert.equal(out.content, src);
});

test("App.jsx with no imports — adds the import at the top", () => {
  const src = [
    "export default function App() {",
    "  return (",
    "    <div>hi</div>",
    "  );",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.ok(out.ok);
  // First line is now the import.
  const lines = out.content.split("\n");
  assert.match(lines[0], /import SignInWithGoogle from "\.\/SignInWithGoogle\.jsx";/);
  // The JSX child got spliced too.
  assert.match(out.content, /<SignInWithGoogle \/>/);
});

test("fragment top-level element (`<>` shorthand) — inserts inside the fragment", () => {
  const src = [
    'import { useState } from "react";',
    "",
    "export default function App() {",
    "  return (",
    "    <>",
    "      <h1>Hi</h1>",
    "    </>",
    "  );",
    "}",
    ""
  ].join("\n");

  const out = spliceViteReactAppJsx(src);
  assert.ok(out.ok);
  // Child sits inside the fragment, before <h1>.
  assert.match(out.content, /<>\s*\n\s+<SignInWithGoogle \/>\s*\n\s+<h1>Hi<\/h1>/);
});

test("import is added only once across repeated invocations (idempotent)", () => {
  const src = [
    'import { useState } from "react";',
    "",
    "export default function App() {",
    "  return (",
    "    <div>",
    "      <h1>Hi</h1>",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n");

  const first = spliceViteReactAppJsx(src);
  assert.ok(first.ok && first.changed);

  const second = spliceViteReactAppJsx(first.content);
  assert.ok(second.ok);
  assert.equal(second.changed, false);
  // Counts stay at 1.
  assert.equal((second.content.match(/import SignInWithGoogle/g) || []).length, 1);
  assert.equal((second.content.match(/<SignInWithGoogle/g) || []).length, 1);
});
