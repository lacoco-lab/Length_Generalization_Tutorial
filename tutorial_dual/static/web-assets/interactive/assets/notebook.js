import {
  TYPES,
  DYCK,
  CONTAINS,
  BOTH_SYMBOLS,
  A_BEFORE_B,
  QUESTIONS,
  compile,
  expression,
  moveBlock,
  references,
} from "./notebook-model.js";
import { evaluateBlocks } from "./notebook-engine.js";
const $ = (id) => document.getElementById(id);
const requestedEmbed = new URLSearchParams(location.search).get("embed");
const embeddedMode = ["walk", "build"].includes(requestedEmbed) ? requestedEmbed : null;
if (embeddedMode) document.documentElement.dataset.embed = embeddedMode;
const clone = (x) => structuredClone(x);
const MODES = [
  {
    id: "walk",
    title: "01 · Walkthrough",
    short: "One assignment at a time",
    heading: "Follow the computation",
    description:
      "Start with one row, then add the next. Every column belongs to a token position. Select a token to inspect the prefix ending there; future tokens do not contribute to its count.",
  },
  {
    id: "build",
    title: "02 · Block builder",
    short: "Assemble a typed program",
    heading: "Build with operations",
    description:
      "Drag an operation onto the program, or click it to add it. Number operations accept number inputs; yes/no operations accept yes/no inputs. Menus offer only earlier compatible variables. Values update as you change a block.",
  },
  {
    id: "repair",
    title: "03 · Repair a rule",
    short: "Learn from a counterexample",
    heading: "What is missing from this rule?",
    description:
      "Equal final counts do not guarantee balanced parentheses. The starter rule accepts a string with an invalid prefix. Change the two choices and inspect the short test inputs to find out why.",
  },
  {
    id: "tokens",
    title: "04 · Token sandbox",
    short: "Change symbols, watch values",
    heading: "Edit the input, watch the counts",
    description:
      "Click a parenthesis to flip it. Add or remove tokens using the buttons. The program stays fixed: watch how a small input change affects this and later positions, but not earlier ones.",
  },
  {
    id: "predict",
    title: "05 · Predict a value",
    short: "Think before revealing",
    heading: "Predict one cell",
    description:
      "Look at the highlighted prefix and predict the requested value. The answer is computed from the same program used in the walkthrough. After choosing, reveal the relevant row and compare it with your reasoning.",
  },
];
const explanations = {
  Opens: "Count opening parentheses through each position, including that token.",
  Closes:
    "Count closing parentheses through each position. These counts share the same prefix as Opens.",
  Violation:
    "Yes means that this prefix has more closes than opens. One such prefix is enough to invalidate the input.",
  Violations:
    "Count the positions where Violation is yes. This remembers an earlier problem even if the counts later become equal.",
  Safe: "Yes means no violation has occurred in any prefix so far.",
  Balanced:
    "Yes means the two counts at this position are equal. This does not check earlier prefixes.",
  Accept:
    "Both checks are needed: no invalid prefix and equal counts. The value at the final position decides the whole input.",
};
const cases = [
  { tokens: "())(()", want: false, label: "Equal totals, bad prefix" },
  { tokens: "()(())", want: true, label: "Balanced input" },
  { tokens: "(()", want: false, label: "Unclosed input" },
  { tokens: ")(", want: false, label: "Starts with a close" },
];
let mode = "walk",
  tokens = [..."()(())"],
  step = 0,
  focus = 3,
  question = 0,
  nodes = clone(CONTAINS),
  output = "A3",
  nextId = 4,
  repairOp = "==",
  repairJoin = "or",
  caseIndex = 0,
  currentTrace = null,
  drag = null;
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function button(text, fn, cls = "secondary") {
  const node = el("button", text, cls);
  node.type = "button";
  node.onclick = fn;
  return node;
}
function say(text, error = false) {
  $("interaction-message").textContent = text;
  $("interaction-message").classList.toggle("error", error);
}
function choice(label, options, value, onChange) {
  const wrap = el("label", label),
    select = el("select");
  for (const o of options) {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    select.add(new Option(t, v));
  }
  select.value = value;
  select.onchange = () => onChange(select.value);
  wrap.append(select);
  return wrap;
}
function fmt(value) {
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
}
function currentNodes() {
  if (mode === "build") return nodes;
  const n = clone(DYCK);
  if (mode === "repair") {
    n[2].op = repairOp;
    n[6].kind = repairJoin;
  }
  return n;
}
function currentOutput() {
  return mode === "build" ? output : "Accept";
}
function source() {
  return compile(currentNodes(), currentOutput());
}
function rowValue(name, col) {
  return currentTrace?.rows.find((r) => r.name === name)?.values[col];
}
function schedule() {
  // The small typed program runs synchronously: every displayed value belongs
  // to the current controls, including during rapid edits or offline use.
  currentTrace = null;
  $("results").setAttribute("aria-busy", "true");
  $("decision").textContent = "";
  $("inspection").textContent = "";
  $("source-code").textContent = source();
  if (mode === "tokens") $("mode-workspace").replaceChildren();
  try {
    currentTrace = evaluateBlocks(currentNodes(), [...tokens], currentOutput());
    $("results").setAttribute("aria-busy", "false");
    $("runtime-status").textContent = "Live values · evaluated locally · no network needed";
    renderResults();
  } catch (error) {
    $("runtime-status").textContent = error.message;
    $("inspection").textContent = "No values are shown for this edit.";
    document
      .querySelectorAll(".block-values")
      .forEach((node) => (node.textContent = "Unavailable"));
  }
}
function setMode(id) {
  mode = id;
  tokens = [...(id === "build" ? "abba" : id === "repair" ? cases[caseIndex].tokens : "()(())")];
  focus = Math.min(3, tokens.length - 1);
  const config = MODES.find((m) => m.id === mode);
  $("mode-kicker").textContent = config.short;
  $("mode-title").textContent = config.heading;
  $("mode-description").textContent = config.description;
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === id));
  $("mode-controls").replaceChildren();
  $("mode-workspace").replaceChildren();
  $("values").replaceChildren();
  say("");
  $("results").hidden = false;
  $("result-intro").textContent =
    "Select a value to inspect it. Positions are zero-based; prefix counts include the current token.";
  if (mode === "walk") renderWalk();
  if (mode === "build") renderBuilder();
  if (mode === "repair") renderRepair();
  if (mode === "predict") renderPrediction();
  renderInput();
  schedule();
  history.replaceState(null, "", `#${id}`);
}
for (const m of MODES) {
  const b = button("", () => setMode(m.id), "");
  b.dataset.mode = m.id;
  b.append(el("strong", m.title), el("small", m.short));
  b.setAttribute("aria-pressed", "false");
  $("mode-nav").append(b);
}
$("reset-design").onclick = () => {
  if (mode === "walk") step = 0;
  if (mode === "build") {
    nodes = clone(CONTAINS);
    output = "A3";
    nextId = 4;
  }
  if (mode === "repair") {
    repairOp = "==";
    repairJoin = "or";
    caseIndex = 0;
  }
  if (mode === "predict") question = 0;
  setMode(mode);
};
function renderInput() {
  const area = $("input-area");
  area.replaceChildren();
  const box = el("div", undefined, "input-workbench"),
    head = el("div", undefined, "input-heading");
  head.append(
    el("h3", "Input sequence"),
    el("p", `${tokens.length} tokens · positions 0–${tokens.length - 1}`, "small"),
  );
  box.append(head);
  const strip = el("div", undefined, "token-buttons");
  strip.id = "input-tokens";
  const prediction = mode === "predict" ? QUESTIONS[question] : null;
  tokens.forEach((t, i) => {
    const b = button(
      "",
      () => {
        if (mode === "tokens") {
          tokens[i] = t === "(" ? ")" : "(";
          focus = i;
          renderInput();
          schedule();
          say(`Flipped position ${i}. Earlier prefix values stay unchanged.`);
        } else if (mode === "build") {
          tokens[i] = t === "a" ? "b" : t === "b" ? "a" : t === "(" ? ")" : "(";
          renderInput();
          schedule();
        } else {
          focus = i;
          renderInput();
          renderResults();
        }
      },
      "input-token",
    );
    b.dataset.position = i;
    b.setAttribute(
      "aria-label",
      `${mode === "tokens" || mode === "build" ? "Flip" : "Inspect"} token ${t} at position ${i}`,
    );
    b.setAttribute("aria-pressed", String(i === (prediction ? prediction.col : focus)));
    b.append(el("span", t, "symbol"), el("small", `position ${i}`));
    if (prediction) {
      b.classList.toggle("outside", i > prediction.col);
      b.disabled = true;
    }
    strip.append(b);
  });
  box.append(strip);
  const hint =
    mode === "tokens"
      ? "Click any token to flip it. The numbers below each token are Opens / Closes."
      : mode === "build"
        ? "Click a token to flip a ↔ b or ( ↔ ). Try the same program on different inputs."
        : mode === "predict"
          ? "The outlined box is the queried position. Muted tokens lie outside its prefix."
          : "Select a token to inspect the prefix ending there.";
  box.append(el("p", hint, "small"));
  const actions = el("div", undefined, "toolbar");
  if (mode === "walk") {
    actions.append(
      button("Balanced: ()(())", () => changeInput("()(())")),
      button("Counterexample: ())(()", () => changeInput("())(()")),
    );
  }
  if (mode === "tokens" || mode === "build") {
    const alphabet = mode === "tokens" ? ["(", ")"] : ["a", "b", "(", ")"];
    for (const t of alphabet) {
      const b = button(`Add ${t}`, () => {
        tokens.push(t);
        focus = tokens.length - 1;
        renderInput();
        schedule();
      });
      b.disabled = tokens.length >= 16;
      actions.append(b);
    }
    const remove = button("Remove last", () => {
      tokens.pop();
      focus = Math.min(focus, tokens.length - 1);
      renderInput();
      schedule();
    });
    remove.disabled = tokens.length <= 1;
    actions.append(remove);
    if (mode === "tokens") actions.append(button("Restore ()(())", () => changeInput("()(())")));
  }
  box.append(actions);
  area.append(box);
}
function changeInput(text) {
  tokens = [...text];
  focus = Math.min(focus, tokens.length - 1);
  renderInput();
  schedule();
}
function renderWalk() {
  const controls = $("mode-controls");
  controls.replaceChildren();
  const toolbar = el("div", undefined, "toolbar");
  const previous = button("← Previous assignment", () => {
    step--;
    renderWalk();
    renderResults();
  });
  previous.disabled = step === 0;
  const next = button("Add next assignment →", () => {
    step++;
    renderWalk();
    renderResults();
  });
  next.disabled = step === DYCK.length - 1;
  toolbar.append(previous, el("span", `${step + 1} of ${DYCK.length}`), next);
  controls.append(toolbar);
  const progress = el("div", undefined, "step-progress");
  progress.setAttribute("aria-hidden", "true");
  DYCK.forEach((_, i) => progress.append(el("span", undefined, i <= step ? "done" : "")));
  controls.append(progress);
  const copy = el("div", undefined, "step-copy");
  copy.append(el("h3", `${step + 1}. ${DYCK[step].id}`), el("p", explanations[DYCK[step].id]));
  controls.append(copy);
}
function renderTable(rows) {
  const scroll = el("div", undefined, "value-scroll"),
    table = el("table", undefined, "value-table");
  table.append(
    el("caption", "Each column is one token position. Yes/no values are Boolean predicates."),
  );
  const head = table.createTHead().insertRow();
  ["Variable", ...tokens.map((t, i) => `${i}: ${t}`)].forEach((t) => {
    const th = el("th", t);
    th.scope = "col";
    head.append(th);
  });
  const body = table.createTBody();
  rows.forEach((row) => {
    const tr = body.insertRow();
    tr.dataset.variable = row.name;
    if (mode === "walk" && row.name === DYCK[step].id) tr.className = "focus-row";
    const label = el("th", row.name);
    label.scope = "row";
    tr.append(label);
    row.values.forEach((v, i) => {
      const td = tr.insertCell();
      const b = button(fmt(v), () => inspect(row.name, i), "");
      b.setAttribute("aria-label", `${row.name} at position ${i}: ${fmt(v)}`);
      td.append(b);
      if (i === focus && mode === "walk" && row.name === DYCK[step].id)
        td.classList.add("focus-cell");
    });
  });
  scroll.append(table);
  return scroll;
}
function inspect(name, col) {
  focus = col;
  const value = rowValue(name, col);
  let note = `${name} at position ${col} is ${fmt(value)}. `;
  const node = currentNodes().find((n) => n.id === name);
  const refs = node ? references(node) : [];
  if (node?.kind === "tokenCount") {
    const indices = tokens
      .map((t, i) => (t === node.token && i <= col ? i : null))
      .filter((i) => i !== null);
    note += `Count “${node.token}” at ${indices.length ? "positions " + indices.join(", ") : "no positions"} in the prefix 0–${col}.`;
  } else if (node?.kind === "count") {
    const inputs = currentTrace.rows.find((r) => r.name === node.input).values;
    note += `${node.input} is yes at ${inputs.slice(0, col + 1).filter(Boolean).length} positions in this prefix.`;
  } else if (refs.length) {
    note +=
      refs.map((id) => `${id} = ${fmt(rowValue(id, col))}`).join("; ") +
      `. The operation is ${expression(node)}.`;
  } else note += "This value belongs to the current input, not to a later token.";
  $("inspection").textContent = note;
  document.querySelectorAll("#input-tokens button").forEach((b, i) => {
    b.classList.toggle("outside", i > col);
    b.classList.toggle(
      "contributor",
      node?.kind === "tokenCount" && i <= col && tokens[i] === node.token,
    );
    b.setAttribute("aria-pressed", String(i === col));
  });
}
function renderResults() {
  if (!currentTrace) return;
  $("values").replaceChildren();
  $("decision").className = "decision";
  if (mode === "build") {
    $("result-heading").textContent = "Program output";
    $("result-intro").textContent =
      "Each block above shows its vector in input order. The selected yes/no variable determines the decision at the last token.";
    for (const node of nodes) {
      const values = document.querySelector(`[data-values="${node.id}"]`);
      if (values) {
        values.replaceChildren();
        currentTrace.rows
          .find((r) => r.name === node.id)
          .values.forEach((v, i) => {
            const cell = el("span", `${i}: ${fmt(v)}`);
            values.append(cell);
          });
      }
    }
    if (!output) {
      $("decision").textContent = "No decision selected";
      $("inspection").textContent =
        "Explore number vectors, or select a yes/no variable to define acceptance.";
      return;
    }
  } else if (mode === "predict") {
    renderPrediction();
    return;
  } else {
    let rows = currentTrace.rows.filter((r) => r.name !== "Result");
    if (mode === "walk") rows = rows.slice(0, step + 1);
    $("result-heading").textContent =
      mode === "walk" ? "Assignments revealed so far" : "Values at each position";
    $("values").append(renderTable(rows));
  }
  if (mode === "walk" && step < DYCK.length - 1) {
    $("decision").textContent = "Decision introduced at step 7";
    inspect(DYCK[step].id, focus);
  } else {
    $("decision").textContent = currentTrace.accepted
      ? "Accepted at the last token"
      : "Rejected at the last token";
    $("decision").classList.add(currentTrace.accepted ? "yes" : "no");
  }
  if (mode === "repair") renderRepairFeedback();
  if (mode === "tokens") renderLiveSummary();
}
// Block builder: all choices are typed, generated names are unique, and moves
// are committed only after checking every dependency in the resulting order.
const operations = [
  ["token", "Is this token…?", "yes/no"],
  ["tokenCount", "Count a token", "number"],
  ["count", "Count yes values", "number"],
  ["compare", "Compare numbers", "yes/no"],
  ["and", "Both are yes", "yes/no"],
  ["or", "Either is yes", "yes/no"],
  ["not", "Reverse yes/no", "yes/no"],
  ["add", "Add numbers", "number"],
];
function available(kind) {
  return (
    !["count", "and", "or", "not"].includes(kind) || nodes.some((n) => TYPES[n.kind] === "bool")
  );
}
function addBlock(kind) {
  if (nodes.length >= 24) {
    say("The learning editor is limited to 24 blocks.", true);
    return;
  }
  if (!available(kind)) {
    say("First add a yes/no block, such as “Is this token…?”.", true);
    return;
  }
  const bools = nodes.filter((n) => TYPES[n.kind] === "bool").map((n) => n.id),
    ints = nodes.filter((n) => TYPES[n.kind] === "int").map((n) => n.id);
  const n = { id: `A${nextId++}`, kind };
  if (["token", "tokenCount"].includes(kind)) n.token = tokens.includes("a") ? "a" : "(";
  if (["count", "not"].includes(kind)) n.input = bools.at(-1);
  if (["and", "or"].includes(kind)) {
    n.left = bools.at(-1);
    n.right = bools.at(-2) || bools.at(-1);
  }
  if (["compare", "add"].includes(kind)) {
    n.left = ints.at(-1) || "0";
    n.right = "0";
    if (kind === "compare") n.op = ">";
  }
  nodes.push(n);
  if (TYPES[kind] === "bool") output = n.id;
  renderBuilder();
  schedule();
  say(`Added ${n.id}. Change its inputs in the menus; values update automatically.`);
}
function reorder(from, to) {
  try {
    nodes = moveBlock(nodes, from, to);
    renderBuilder();
    schedule();
    say("Moved the block. Dependencies remain defined before use.");
  } catch {
    say("That move would use a variable before it is defined. The order was kept unchanged.", true);
  }
}
function drop(e, to) {
  e.preventDefault();
  document.querySelectorAll(".drag-over").forEach((n) => n.classList.remove("drag-over"));
  if (!drag) return;
  if (drag.kind) addBlock(drag.kind);
  else reorder(drag.index, to);
  drag = null;
}
function renderBuilder() {
  const area = $("mode-workspace");
  area.replaceChildren();
  const tools = el("div", undefined, "toolbar");
  tools.append(
    button("Start empty", () => {
      nodes = [];
      output = "";
      nextId = 1;
      renderBuilder();
      schedule();
      say("Add “Is this token…?”, then “Count yes values”, then “Compare numbers”.");
    }),
    button("Load “contains a”", () => {
      nodes = clone(CONTAINS);
      output = "A3";
      nextId = 4;
      tokens = [..."abba"];
      renderInput();
      renderBuilder();
      schedule();
    }),
    choice(
      "More starters",
      [
        ["", "Choose a program"],
        ["both", "Contains both a and b"],
        ["before", "An a occurs before a b"],
        ["dyck", "Balanced parentheses"],
      ],
      "",
      (value) => {
        if (!value) return;
        nodes = clone(value === "both" ? BOTH_SYMBOLS : value === "before" ? A_BEFORE_B : DYCK);
        output = "Accept";
        tokens = [...(value === "dyck" ? "()(())" : "ab")];
        nextId = 4;
        renderInput();
        renderBuilder();
        schedule();
        say(
          value === "before"
            ? "Try ab, then ba. The rule asks for order, not adjacency."
            : value === "both"
              ? "Try ab and ba, then aa. Does order matter for this rule?"
              : "This is the complete program from the walkthrough.",
        );
      },
    ),
  );
  area.append(tools);
  area.append(
    el(
      "p",
      "Click an operation or drag it to the dashed area. Drag the ↕ handle or use ↑ / ↓ to reorder. A block cannot move before a variable it uses.",
      "drag-help",
    ),
  );
  const grid = el("div", undefined, "builder-grid"),
    palette = el("aside", undefined, "palette");
  palette.setAttribute("aria-label", "Operation palette");
  palette.append(el("h3", "Operations"));
  for (const [kind, title, type] of operations) {
    const b = button("", () => addBlock(kind), "");
    b.dataset.operation = kind;
    b.append(el("span", title), el("small", `Produces ${type}`));
    b.disabled = !available(kind) || nodes.length >= 24;
    b.draggable = !b.disabled;
    b.ondragstart = (e) => {
      drag = { kind };
      e.dataTransfer.setData("text/plain", kind);
      e.dataTransfer.effectAllowed = "copy";
    };
    b.ondragend = () => (drag = null);
    palette.append(b);
  }
  grid.append(palette);
  const stack = el("div", undefined, "block-stack");
  nodes.forEach((n, index) => {
    const card = el("div", undefined, `program-block ${TYPES[n.kind] === "int" ? "number" : ""}`);
    card.dataset.block = n.id;
    card.ondragover = (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
    };
    card.ondragleave = () => card.classList.remove("drag-over");
    card.ondrop = (e) => drop(e, index);
    const header = el("div", undefined, "block-title"),
      label = el("strong", `${index + 1}. ${n.id} `);
    label.append(el("span", TYPES[n.kind] === "int" ? "number" : "yes/no", "type-tag"));
    header.append(label);
    const actions = el("div", undefined, "block-tools");
    const handle = el("span", "↕");
    handle.draggable = true;
    handle.title = "Drag to reorder; use the arrow buttons with keyboard or touch";
    handle.ondragstart = (e) => {
      drag = { index };
      e.dataTransfer.setData("text/plain", n.id);
      e.dataTransfer.effectAllowed = "move";
    };
    handle.ondragend = () => (drag = null);
    const up = button("↑", () => reorder(index, index - 1), ""),
      down = button("↓", () => reorder(index, index + 1), "");
    up.disabled = index === 0;
    down.disabled = index === nodes.length - 1;
    up.setAttribute("aria-label", `Move ${n.id} up`);
    down.setAttribute("aria-label", `Move ${n.id} down`);
    const remove = button(
      "Remove",
      () => {
        if (nodes.some((other) => references(other).includes(n.id))) {
          say(
            `${n.id} is used by another block. Change or remove that dependent block first.`,
            true,
          );
          return;
        }
        nodes.splice(index, 1);
        if (output === n.id)
          output = nodes.filter((x) => TYPES[x.kind] === "bool").at(-1)?.id || "";
        renderBuilder();
        schedule();
      },
      "",
    );
    remove.setAttribute("aria-label", `Remove ${n.id}`);
    actions.append(handle, up, down, remove);
    header.append(actions);
    card.append(header);
    const fields = el("div", undefined, "block-fields");
    const earlier = nodes.slice(0, index);
    const bools = earlier.filter((x) => TYPES[x.kind] === "bool").map((x) => x.id),
      ints = ["0", ...earlier.filter((x) => TYPES[x.kind] === "int").map((x) => x.id)];
    const field = (label, key, opts) =>
      choice(label, opts, n[key], (v) => {
        n[key] = v;
        schedule();
      });
    if (n.kind === "token" || n.kind === "tokenCount")
      fields.append(
        field(n.kind === "token" ? "Token is" : "Count token", "token", ["a", "b", "(", ")"]),
      );
    if (n.kind === "count" || n.kind === "not")
      fields.append(field(n.kind === "count" ? "Count yes in" : "Reverse", "input", bools));
    if (["compare", "add", "and", "or"].includes(n.kind)) {
      const opts = ["compare", "add"].includes(n.kind) ? ints : bools;
      fields.append(field("Input", "left", opts));
      if (n.kind === "compare")
        fields.append(field("Comparison", "op", ["<", "<=", "==", ">=", ">"]));
      else fields.append(el("span", { add: "plus", and: "and", or: "or" }[n.kind]));
      fields.append(field("Input", "right", opts));
    }
    card.append(fields);
    const values = el("div", "Updating…", "block-values");
    values.dataset.values = n.id;
    values.setAttribute("aria-label", `${n.id} values by position`);
    card.append(values);
    stack.append(card);
  });
  const zone = el(
    "div",
    nodes.length ? "Drop an operation here to append it" : "Drop your first operation here",
    "drop-end",
  );
  zone.id = "block-drop";
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  };
  zone.ondragleave = () => zone.classList.remove("drag-over");
  zone.ondrop = (e) => drop(e, Math.max(0, nodes.length - 1));
  stack.append(zone);
  grid.append(stack);
  area.append(grid);
  const decision = el("div", undefined, "builder-output");
  decision.append(
    choice(
      "Decision at the last token",
      [["", "No decision yet"], ...nodes.filter((n) => TYPES[n.kind] === "bool").map((n) => n.id)],
      output,
      (v) => {
        output = v;
        schedule();
      },
    ),
    el(
      "p",
      "Only yes/no variables can decide acceptance. A number vector can still be inspected without selecting a decision.",
    ),
  );
  area.append(decision);
}
function renderRepair() {
  const area = $("mode-controls");
  area.replaceChildren();
  const rule = el("div", undefined, "puzzle-rule");
  rule.append(
    choice("A prefix is a violation when Opens", ["<", "==", ">"], repairOp, (v) => {
      repairOp = v;
      schedule();
    }),
    el("p", "Closes. Safe means the number of violations so far is zero.", "small"),
  );
  rule.append(
    choice(
      "Accept when Safe",
      [
        ["and", "AND"],
        ["or", "OR"],
      ],
      repairJoin,
      (v) => {
        repairJoin = v;
        schedule();
      },
    ),
    el("p", "Balanced. Balanced means Opens equals Closes.", "small"),
  );
  area.append(rule);
  const buttons = el("div", undefined, "case-buttons");
  cases.forEach((c, i) => {
    const b = button(
      `${c.tokens} · should ${c.want ? "accept" : "reject"}`,
      () => {
        caseIndex = i;
        renderRepair();
        changeInput(c.tokens);
      },
      "",
    );
    b.setAttribute("aria-pressed", String(i === caseIndex));
    buttons.append(b);
  });
  area.append(buttons);
  const feedback = el("div", undefined, "puzzle-feedback");
  feedback.id = "repair-feedback";
  feedback.append(
    el(
      "p",
      "Change one choice and inspect how the rows change. Passing these examples is not a proof for all inputs.",
    ),
  );
  area.append(feedback);
}
function renderRepairFeedback() {
  const expected = cases[caseIndex].want,
    match = currentTrace.accepted === expected;
  const box = $("repair-feedback");
  box.replaceChildren();
  let why =
    repairJoin === "or"
      ? "With OR, equal final counts can accept an input even when Safe is false."
      : repairOp !== "<"
        ? "Check the violation condition: an invalid prefix has fewer opens than closes."
        : "The rule checks both the absence of invalid prefixes and equal final counts.";
  box.append(
    el(
      "p",
      `${match ? "Matches" : "Does not match"} the expected result for this input. ${why} Try the other inputs too; this small set is not an exhaustive proof.`,
    ),
  );
}
function renderLiveSummary() {
  const area = $("mode-workspace");
  area.replaceChildren();
  const summary = el("div", undefined, "live-summary");
  const violation = currentTrace.rows.find((r) => r.name === "Violation").values.findIndex(Boolean);
  for (const [value, label] of [
    [rowValue("Opens", tokens.length - 1), "opens in the whole input"],
    [rowValue("Closes", tokens.length - 1), "closes in the whole input"],
    [violation < 0 ? "none" : violation, "first invalid prefix (position)"],
  ]) {
    const box = el("div");
    box.append(el("strong", value), el("span", label));
    summary.append(box);
  }
  area.append(summary);
  document.querySelectorAll("#input-tokens button").forEach((b, i) => {
    b.querySelector(".count-under")?.remove();
    b.append(el("span", `${rowValue("Opens", i)} / ${rowValue("Closes", i)}`, "count-under"));
  });
  $("inspection").textContent =
    violation < 0
      ? "No prefix has more closes than opens. Check the final counts separately."
      : `The first invalid prefix ends at position ${violation}. Later tokens cannot erase that earlier violation.`;
}
function renderPrediction() {
  const area = $("mode-controls");
  area.replaceChildren();
  const q = QUESTIONS[question],
    card = el("div", undefined, "prediction");
  card.append(
    el("p", `Question ${question + 1} of ${QUESTIONS.length}`, "small"),
    el("h3", q.prompt),
    el("p", `Requested cell: ${q.row}[${q.col}]`),
  );
  const options = el("div", undefined, "prediction-options");
  for (const value of q.options) {
    const b = button(fmt(value), () => {
      const actual = rowValue(q.row, q.col);
      $("prediction-feedback").textContent =
        `${value === actual ? "Correct." : "Not quite."} ${q.row}[${q.col}] = ${fmt(actual)}. ${q.why}`;
      options.querySelectorAll("button").forEach((x) => (x.disabled = true));
      $("values").replaceChildren(renderTable([currentTrace.rows.find((r) => r.name === q.row)]));
      $("result-heading").textContent = "Revealed row";
      $("result-intro").textContent = q.why;
      $("decision").textContent = "";
      next.disabled = question === QUESTIONS.length - 1;
    });
    b.disabled = !currentTrace;
    options.append(b);
  }
  card.append(options);
  const feedback = el(
    "p",
    currentTrace ? "Choose a value to reveal the row." : "Choose a value after the input is ready.",
    "prediction-feedback",
  );
  feedback.id = "prediction-feedback";
  feedback.setAttribute("role", "status");
  card.append(feedback);
  const next = button("Next question →", () => {
    question++;
    renderInput();
    renderPrediction();
    $("values").replaceChildren();
    $("result-heading").textContent = "The answer is hidden until you choose";
    $("result-intro").textContent = "";
  });
  next.disabled = true;
  card.append(
    next,
    button("Start again", () => {
      question = 0;
      renderInput();
      renderPrediction();
      $("values").replaceChildren();
    }),
  );
  area.append(card);
  $("values").replaceChildren();
  $("decision").textContent = "";
  $("result-heading").textContent = "The answer is hidden until you choose";
  $("result-intro").textContent = "";
  $("inspection").textContent = "";
}
$("toggle-code").onclick = () => {
  const hidden = !$("generated-code").hidden;
  $("generated-code").hidden = hidden;
  $("toggle-code").setAttribute("aria-expanded", String(!hidden));
  $("toggle-code").textContent = hidden ? "View generated C-RASP" : "Hide generated C-RASP";
};
$("open-editor").onclick = () => {
  (embeddedMode ? window.top : window).location.href =
    "text-editor.html#program=" +
    encodeURIComponent(JSON.stringify({ source: source(), tokens: tokens.join(" ") }));
};
setMode(
  embeddedMode ||
    (MODES.some((m) => m.id === location.hash.slice(1)) ? location.hash.slice(1) : "walk"),
);
if (embeddedMode) {
  $("reset-design").textContent =
    embeddedMode === "walk" ? "Restart walkthrough" : "Reset playground";
  let previousHeight = 0;
  const notifyHeight = () => {
    const height = Math.ceil(
      document.querySelector(".notebook-shell").getBoundingClientRect().height,
    );
    if (height !== previousHeight) {
      previousHeight = height;
      window.parent.postMessage({ type: "crasp-notebook-height", height }, location.origin);
    }
  };
  new ResizeObserver(notifyHeight).observe(document.querySelector(".notebook-shell"));
  window.addEventListener("load", notifyHeight);
  notifyHeight();
}
