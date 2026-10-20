import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, validateEvaluations } from "../site/assets/lib.js";
const fixture = () => ({
  schema_version: 1,
  runs: [
    {
      id: "test-only",
      task: "test fixture",
      model: "fixture",
      positional_encoding: "none",
      seed: 0,
      checkpoint: "fixture",
      evaluated_at: "2026-10-19T00:00:00Z",
      source: "test only",
      train_max_length: 10,
      metric: "sequence_accuracy",
      points: [{ length: 20, correct: 0, total: 5 }],
    },
  ],
});
test("tokenization preserves multi-character tokens and handles compact parentheses", () => {
  assert.deepEqual(tokenize(" a word "), ["a", "word"]);
  assert.deepEqual(tokenize("()"), ["(", ")"]);
  assert.throws(() => tokenize(""));
  assert.throws(() => tokenize("a ".repeat(129)));
});
test("zero observed correct is distinct from missing counts", () => {
  assert.equal(validateEvaluations(fixture()).runs[0].points[0].correct, 0);
  for (const v of [null, undefined, -1, 6, NaN]) {
    const f = fixture();
    f.runs[0].points[0].correct = v;
    assert.throws(() => validateEvaluations(f));
  }
});
test("rejects duplicate lengths and incompatible metrics", () => {
  const f = fixture();
  f.runs[0].points.push({ ...f.runs[0].points[0] });
  assert.throws(() => validateEvaluations(f));
  const g = fixture();
  g.runs[0].metric = "token_accuracy";
  assert.throws(() => validateEvaluations(g));
});
test("empty gallery is valid and selection range cannot precede training", () => {
  assert.doesNotThrow(() => validateEvaluations({ schema_version: 1, runs: [] }));
  const f = fixture();
  f.runs[0].selection_max_length = 5;
  assert.throws(() => validateEvaluations(f));
});
