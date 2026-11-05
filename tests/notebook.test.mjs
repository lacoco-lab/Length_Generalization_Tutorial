import test from "node:test";
import assert from "node:assert/strict";
import {
  DYCK,
  CONTAINS,
  BOTH_SYMBOLS,
  A_BEFORE_B,
  compile,
  validateProgram,
  moveBlock,
} from "../site/assets/notebook-model.js";
import { evaluateBlocks } from "../site/assets/notebook-engine.js";

test("block editor rejects undefined and incorrectly typed inputs", () => {
  assert.throws(() => compile([{ id: "Count", kind: "count", input: "Missing" }]), /earlier/);
  assert.throws(
    () =>
      compile([
        { id: "N", kind: "tokenCount", token: "a" },
        { id: "Bad", kind: "count", input: "N" },
      ]),
    /earlier/,
  );
  assert.throws(() => compile(CONTAINS, "A2"), /yes\/no/);
  assert.throws(
    () => compile([{ id: "X", kind: "token", token: '"; arbitrary' }]),
    /supported token/,
  );
  assert.throws(() => compile([{ id: "Result", kind: "token", token: "a" }]), /names/);
});
test("dependency-violating reorder is rejected without mutating the program", () => {
  const before = structuredClone(DYCK);
  assert.throws(() => moveBlock(DYCK, 3, 0), /earlier/);
  assert.deepEqual(DYCK, before);
  const moved = moveBlock(DYCK, 1, 0);
  assert.equal(moved[0].id, "Closes");
  assert.doesNotThrow(() => validateProgram(moved));
});
test("generated output is separate from exploratory number vectors", () => {
  assert.equal(compile([]), "Result = (0 == 0)");
  assert.match(compile(CONTAINS, "A3"), /Result = A3$/);
  assert.match(compile(DYCK, "Accept"), /Accept = Safe && Balanced/);
});

test("prefix counting is inclusive and respects causality", () => {
  const trace = evaluateBlocks(DYCK, [..."()(())"], "Accept");
  assert.deepEqual(trace.rows[0].values, [1, 1, 2, 3, 3, 3]);
  assert.equal(trace.accepted, true);
  const changed = evaluateBlocks(DYCK, [..."()(()("], "Accept");
  for (let i = 0; i < trace.rows.length; i++)
    assert.deepEqual(trace.rows[i].values.slice(0, 5), changed.rows[i].values.slice(0, 5));
  assert.equal(changed.accepted, false);
  assert.equal(evaluateBlocks(DYCK, [..."())(()"], "Accept").accepted, false);
});
test("empty and unsupported inputs are rejected", () => {
  assert.throws(() => evaluateBlocks(DYCK, [], "Accept"), /1–16/);
  assert.throws(() => evaluateBlocks(DYCK, ["x"], "Accept"), /1–16/);
  assert.throws(() => evaluateBlocks(DYCK, Array(17).fill("("), "Accept"), /1–16/);
});

test("general starters separate presence from order", () => {
  for (const input of ["ab", "ba"])
    assert.equal(evaluateBlocks(BOTH_SYMBOLS, [...input], "Accept").accepted, true);
  assert.equal(evaluateBlocks(BOTH_SYMBOLS, [..."aa"], "Accept").accepted, false);
  assert.equal(evaluateBlocks(A_BEFORE_B, [..."ab"], "Accept").accepted, true);
  assert.equal(evaluateBlocks(A_BEFORE_B, [..."ba"], "Accept").accepted, false);
  assert.equal(evaluateBlocks(A_BEFORE_B, [..."a()b"], "Accept").accepted, true);
});
