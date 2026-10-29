import { validateEvaluations } from "./lib.js";
const $ = (id) => document.getElementById(id);
function download(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function tokenElement(label, cls = "") {
  const el = document.createElement("span");
  el.className = `token ${cls}`;
  el.textContent = label;
  return el;
}
function attention() {
  const n = +$("prefix").value,
    tokens = ["(", ")", "(", "(", ")", ")"];
  $("prefix-label").textContent = n;
  const strip = $("attention-tokens");
  strip.replaceChildren();
  ["BOS", ...tokens].forEach((t, k) => {
    const visible = k <= n;
    const el = tokenElement(t, visible ? "visible" : "masked");
    const note = document.createElement("small");
    note.textContent = visible
      ? `value ${t === "(" ? 1 : 0} · weight 1/${n + 1}`
      : "masked · weight 0";
    el.append(note);
    strip.append(el);
  });
  const count = tokens.slice(0, n).filter((t) => t === "(").length;
  $("attention-equation").textContent = `${count} opening tokens × 1/${n + 1} = ${count}/${n + 1}`;
  $("attention-explanation").textContent =
    `There are ${n + 1} visible positions: BOS and ${n} ordinary tokens. ${count} opening parentheses contribute 1 each; all other values are 0. Their average is ${(count / (n + 1)).toFixed(3)}. A separate BOS-only indicator contributes once, giving 1/${n + 1} as the encoded constant 1.`;
}
$("prefix").oninput = attention;
attention();
function positions() {
  const i = +$("query").value,
    kind = $("relation").value;
  $("query-label").textContent = i;
  const strip = $("position-tokens");
  strip.replaceChildren();
  for (let j = 0; j < 12; j++) {
    const match =
      j <= i && (kind === "previous" ? j === i - 1 : kind === "even" ? (i - j) % 2 === 0 : j === 0);
    const el = tokenElement(j, match ? "match" : j > i ? "masked" : "");
    const label = document.createElement("small");
    label.textContent = [
      j === i ? "query" : "",
      j > i ? "masked" : match ? "selected" : "not selected",
    ]
      .filter(Boolean)
      .join(" · ");
    el.append(label);
    strip.append(el);
  }
  const keys = Array.from({ length: i + 1 }, (_, j) => j).filter((j) =>
    kind === "previous" ? j === i - 1 : kind === "even" ? (i - j) % 2 === 0 : j === 0,
  );
  $("position-selection").textContent =
    `Query i = ${i}. Selected keys: ${keys.length ? keys.join(", ") : "none"}. ${kind === "previous" ? "Move the query one position to the right: the selected predecessor moves with it." : kind === "even" ? "Moving the query changes which parity of key positions is selected." : "Moving the query leaves key 0 selected; the relation stays tied to the sequence start."}`;
  $("relation-description").textContent =
    kind === "previous"
      ? "j = i − 1: local (distance 1) and translation-invariant. At query 0 there is no preceding token."
      : kind === "even"
        ? "i − j is even: translation-invariant, but not local—matching keys can be arbitrarily far away. This is a binary relation, unlike the periodic unary predicate “position is even”."
        : "j = 0: selects the start of the sequence. Shifting both positions changes the relation; it is not translation-invariant. Only keys in the causal prefix are shown as selected.";
}
$("query").oninput = positions;
$("relation").onchange = positions;
positions();
// -----------------------------------------------------------------------------
// Published figure selector
// -----------------------------------------------------------------------------
const figureLabels = {
  main: "Figure 1: main comparison across tasks and formal languages.",
  languages: "Figure 2: named formal languages and their generalization results.",
};
document.querySelectorAll("[data-figure]").forEach(
  (b) =>
    (b.onclick = () => {
      const k = b.dataset.figure;
      $("paper-figure").src = `assets/paper-${k}.svg`;
      $("figure-link").href = `assets/paper-${k}.svg`;
      $("paper-figure").alt =
        `Huang et al. (2025), ${figureLabels[k]} See the original paper for the full caption.`;
      $("paper-caption").textContent =
        `Huang et al. (2025), ${figureLabels[k]} Published experiment results; not new runs. Open the image for full detail.`;
      document
        .querySelectorAll("[data-figure]")
        .forEach((x) => x.classList.toggle("secondary", x !== b));
    }),
);
// -----------------------------------------------------------------------------
// Saved evaluation validation, plotting, and import
// -----------------------------------------------------------------------------
let evaluations = { schema_version: 1, runs: [] };
const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
function showRun() {
  const r = evaluations.runs[$("run-select").value];
  if (!r) return;
  const points = [...r.points].sort((a, b) => a.length - b.length),
    max = Math.max(r.train_max_length, r.selection_max_length || 0, ...points.map((p) => p.length));
  const x = (n) => 60 + (n / max) * 670,
    y = (n) => 290 - n * 240;
  const chart = $("evaluation-plot");
  chart.replaceChildren(svg("title", {}, `${r.task}: ${r.model}, seed ${r.seed}`));
  chart.append(
    svg("rect", { x: 60, y: 50, width: x(r.train_max_length) - 60, height: 240, fill: "#e3eee7" }),
  );
  if (r.selection_max_length > r.train_max_length)
    chart.append(
      svg("rect", {
        x: x(r.train_max_length),
        y: 50,
        width: x(r.selection_max_length) - x(r.train_max_length),
        height: 240,
        fill: "#f5e6ca",
      }),
    );
  for (const a of [0, 0.25, 0.5, 0.75, 1]) {
    chart.append(
      svg("line", { x1: 60, x2: 730, y1: y(a), y2: y(a), stroke: "#d9ddd8" }),
      svg("text", { x: 48, y: y(a) + 4, "text-anchor": "end", "font-size": 12 }, `${100 * a}%`),
    );
  }
  for (const n of [
    ...new Set([0, r.train_max_length, r.selection_max_length, max].filter((n) => n !== undefined)),
  ])
    chart.append(svg("text", { x: x(n), y: 310, "text-anchor": "middle", "font-size": 12 }, n));
  chart.append(
    svg("polyline", {
      points: points.map((p) => `${x(p.length)},${y(p.correct / p.total)}`).join(" "),
      fill: "none",
      stroke: "#246d66",
      "stroke-width": 2,
    }),
  );
  for (const p of points) {
    const c = svg("circle", { cx: x(p.length), cy: y(p.correct / p.total), r: 4, fill: "#246d66" });
    c.append(svg("title", {}, `Length ${p.length}: ${p.correct}/${p.total}`));
    chart.append(c);
  }
  chart.append(
    svg(
      "text",
      { x: 60, y: 25, "font-size": 13 },
      "Green: training range · Sand: selection range (when supplied)",
    ),
    svg("text", { x: 390, y: 340, "text-anchor": "middle", "font-size": 13 }, "Input length"),
  );
  const meta = $("run-meta");
  meta.replaceChildren();
  for (const k of [
    "task",
    "model",
    "positional_encoding",
    "seed",
    "checkpoint",
    "evaluated_at",
    "source",
  ]) {
    const p = document.createElement("p");
    p.textContent = `${k.replaceAll("_", " ")}: ${r[k]}`;
    meta.append(p);
  }
  const table = $("evaluation-table");
  table.replaceChildren();
  table.createCaption().textContent =
    "Recorded sequence accuracy; no interpolation of missing evaluations";
  const h = table.createTHead().insertRow();
  ["Length", "Correct", "Total", "Accuracy"].forEach((t) => {
    const th = document.createElement("th");
    th.textContent = t;
    h.append(th);
  });
  const body = table.createTBody();
  points.forEach((p) => {
    const row = body.insertRow();
    [p.length, p.correct, p.total, `${((100 * p.correct) / p.total).toFixed(1)}%`].forEach(
      (v) => (row.insertCell().textContent = v),
    );
  });
}
function loadEvaluations(data) {
  evaluations = validateEvaluations(data);
  const sel = $("run-select");
  sel.replaceChildren();
  data.runs.forEach((r, i) => {
    const o = new Option(`${r.task} · ${r.model} · seed ${r.seed} · ${r.id}`, i);
    sel.add(o);
  });
  const empty = !data.runs.length;
  if (empty) sel.add(new Option("No saved runs supplied", ""));
  sel.disabled = empty;
  $("export-data").disabled = empty;
  $("evaluation-empty").hidden = !empty;
  $("evaluation-view").hidden = empty;
  showRun();
}
$("run-select").onchange = showRun;
$("export-data").onclick = () => download("evaluations.json", evaluations);
$("evaluation-file").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10_000_000) throw new Error("Use a JSON file smaller than 10 MB.");
    loadEvaluations(JSON.parse(await f.text()));
    $("evaluation-status").textContent =
      `Loaded ${evaluations.runs.length} runs locally. Nothing was uploaded.`;
  } catch (err) {
    $("evaluation-status").textContent = err.message;
  }
};
try {
  const response = await fetch("data/evaluations.json");
  loadEvaluations(await response.json());
} catch (e) {
  $("evaluation-status").textContent = `Could not load saved evaluations: ${e.message}`;
}

// Each notebook owns its state. Resize only messages from our two same-origin frames.
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.data?.type !== "crasp-notebook-height") return;
  const frame = [...document.querySelectorAll(".notebook-frame")].find(
    (f) => f.contentWindow === event.source,
  );
  const height = event.data.height;
  if (frame && Number.isFinite(height) && height > 0 && height < 20000)
    frame.style.height = `${Math.ceil(height)}px`;
});
// Retain old shared-program URLs from earlier editions.
if (location.hash.startsWith("#program=")) location.replace("text-editor.html" + location.hash);
