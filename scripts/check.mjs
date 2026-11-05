import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateEvaluations } from "../site/assets/lib.js";
const root = new URL("../site/", import.meta.url);
for (const page of ["index.html", "notebook.html", "text-editor.html"]) {
  const html = fs.readFileSync(new URL(page, root), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "Duplicate HTML IDs");
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (ref.startsWith("#")) {
      if (ref.length > 1) assert(ids.includes(ref.slice(1)), `Missing anchor ${ref}`);
    } else if (!/^[a-z]+:/i.test(ref))
      assert(fs.existsSync(new URL(ref, root)), `Missing local asset ${ref}`);
  }
}
validateEvaluations(JSON.parse(fs.readFileSync(new URL("data/evaluations.json", root))));
for (const f of JSON.parse(fs.readFileSync(new URL("data/figure-provenance.json", root))))
  assert.equal(
    createHash("sha256")
      .update(fs.readFileSync(new URL(f.file, root)))
      .digest("hex"),
    f.sha256,
  );
const trace = JSON.parse(fs.readFileSync(new URL("data/default-trace.json", root)));
assert.equal(trace.accepted, true);
assert(trace.rows.every((r) => r.values.length === trace.tokens.length));
console.log(
  "Local links, anchors, evaluation data, trace shape and original figure checksums pass.",
);
