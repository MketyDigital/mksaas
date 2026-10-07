import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../src/ui.ts", import.meta.url), "utf8");

test("Models & Rates panel is not constrained to one column of the dashboard grid", () => {
  const start = ui.indexOf("export function renderOperatorPortal");
  const end = ui.indexOf("<script>", start);
  assert.notEqual(start, -1, "operator portal renderer exists");
  assert.notEqual(end, -1, "operator portal markup ends before its script");
  const markup = ui.slice(start, end);
  const stack = [];
  let found = false;

  for (const match of markup.matchAll(/<\/?div\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</div")) {
      stack.pop();
      continue;
    }
    if (tag.includes('id="modelsBox"')) {
      found = true;
      assert.ok(!stack.includes("two"), "Models & Rates should use the full dashboard width");
    }
    const classes = tag.match(/class=["']([^"']*)["']/)?.[1]?.split(/\s+/) || [];
    stack.push(...classes);
  }
  assert.ok(found, "models panel must remain present");
});

