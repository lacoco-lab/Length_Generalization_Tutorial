import { TYPES, validateProgram } from "./notebook-model.js";

// Execute the typed block model directly. No parser, network, worker, or eval().
// The public editor has at most 24 blocks and 16 tokens. Arithmetic is checked
// rather than silently accepting loss of integer precision.
export function evaluateBlocks(nodes, tokens, output) {
  validateProgram(nodes);
  if (
    !Array.isArray(tokens) ||
    tokens.length < 1 ||
    tokens.length > 16 ||
    tokens.some((t) => !["a", "b", "(", ")"].includes(t))
  )
    throw new Error("Use 1–16 tokens from a, b, (, ).");
  if (output && !nodes.some((n) => n.id === output && TYPES[n.kind] === "bool"))
    throw new Error("Choose a yes/no output.");
  const env = new Map(),
    rows = [];
  const at = (name, i) => (name === "0" ? 0 : env.get(name)[i]);
  for (const n of nodes) {
    let total = 0;
    const values = tokens.map((token, i) => {
      switch (n.kind) {
        case "token":
          return token === n.token;
        case "tokenCount":
          total += Number(token === n.token);
          return total;
        case "count":
          total += Number(at(n.input, i));
          return total;
        case "not":
          return !at(n.input, i);
        case "and":
          return at(n.left, i) && at(n.right, i);
        case "or":
          return at(n.left, i) || at(n.right, i);
        case "add": {
          const sum = at(n.left, i) + at(n.right, i);
          if (!Number.isSafeInteger(sum))
            throw new Error("This value exceeds the exact integer range of this learning editor.");
          return sum;
        }
        case "compare": {
          const left = at(n.left, i),
            right = at(n.right, i);
          switch (n.op) {
            case "<":
              return left < right;
            case "<=":
              return left <= right;
            case "==":
              return left === right;
            case ">=":
              return left >= right;
            case ">":
              return left > right;
          }
        }
      }
    });
    env.set(n.id, values);
    rows.push({ name: n.id, values });
  }
  const result = output ? env.get(output) : tokens.map(() => true);
  rows.push({ name: "Result", values: [...result] });
  return {
    tokens: [...tokens],
    rows,
    accepted: result.at(-1),
    engine: "typed-block-evaluator",
    index_base: 0,
  };
}
