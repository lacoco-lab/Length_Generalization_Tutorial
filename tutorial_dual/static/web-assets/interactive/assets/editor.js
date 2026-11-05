import { tokenize, validateEvaluations } from "./lib.js";
const $ = (id) => document.getElementById(id);
// -----------------------------------------------------------------------------
// Example programs and playground state
// -----------------------------------------------------------------------------
const examples = {
  dyck: {
    tokens: "( ) ( ( ) )",
    source:
      'C_open = # "("\nC_close = # ")"\nV = C_open < C_close\nCV = # V\nM = (CV == 0)\nB = (C_open == C_close)\nD = M && B',
  },
  anbn: {
    tokens: "a a a b b b",
    source:
      'A = # "a"\nB = # "b"\nBad = "a" && (B > 0)\nOther = !("a" || "b")\nErrors = #(Bad || Other)\nAccept = (A == B) && (Errors == 0) && (A > 0)',
  },
  previous: {
    tokens: "b a b a",
    source:
      '#import pred\nC = #[pred] "a"\nPair = "b" && (C > 0)\nPairs = # Pair\nAccept = Pairs > 0',
  },
};
let trace,
  selected = 0,
  worker,
  timer,
  running = false,
  lastRequest;
function status(message, error = false) {
  $("engine-status").textContent = message;
  $("engine-status").classList.toggle("error", error);
}
function stop() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(timer);
  running = false;
  $("run").disabled = false;
  $("stop").hidden = true;
}
function markStale() {
  $("download-trace").disabled = true;
  $("result").textContent = "Edits not evaluated";
  $("result").className = "result";
  $("acceptance-note").textContent =
    "The trace below belongs to the previous input and program. Choose Run program to replace it.";
  status("The table shows the previous run. Run the interpreter to evaluate your edits.");
}
// -----------------------------------------------------------------------------
// Trace rendering and assignment explanations
// -----------------------------------------------------------------------------
function renderTrace(data) {
  trace = data;
  selected = Math.min(selected, data.rows.length - 1);
  const table = $("trace");
  table.replaceChildren();
  const caption = table.createCaption();
  caption.textContent = "Interpreter values by token position (zero-based)";
  const head = table.createTHead().insertRow();
  ["Assignment", ...data.tokens.map((t, i) => `${i}: ${t}`)].forEach((t) => {
    const th = document.createElement("th");
    th.textContent = t;
    head.append(th);
  });
  const body = table.createTBody();
  data.rows.forEach((row, ri) => {
    const tr = body.insertRow();
    tr.dataset.row = ri;
    const th = document.createElement("th");
    const b = document.createElement("button");
    b.className = "secondary";
    b.textContent = row.name;
    b.onclick = () => selectRow(ri);
    th.append(b);
    tr.append(th);
    row.values.forEach((value, ci) => {
      const td = tr.insertCell();
      td.textContent = typeof value === "boolean" ? (value ? "✓" : "·") : value;
      td.tabIndex = 0;
      const inspect = () => {
        selectRow(ri);
        table
          .querySelectorAll(".active,.contributes")
          .forEach((e) => e.classList.remove("active", "contributes"));
        td.classList.add("active");
        // Only infer a contributor explanation for the named, unedited Dyck example.
        if (
          lastRequest?.source === examples.dyck.source &&
          ["C_open", "C_close"].includes(row.name)
        ) {
          const token = row.name === "C_open" ? "(" : ")";
          [...head.cells].forEach((cell, k) => {
            if (k > 0 && k - 1 <= ci && data.tokens[k - 1] === token)
              cell.classList.add("contributes");
          });
          $("cell-note").textContent =
            `${row.name}[${ci}] = ${value}: count “${token}” at positions 0 through ${ci}, inclusive. Highlighted column headings contribute.`;
        } else
          $("cell-note").textContent =
            `${row.name}[${ci}] = ${value}. This is the value returned by the Python interpreter.`;
      };
      td.onclick = inspect;
      td.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inspect();
        }
      };
    });
  });
  selectRow(selected);
  $("result").textContent = data.accepted ? "Accepted" : "Rejected";
  $("result").className = `result ${data.accepted ? "accepted" : "rejected"}`;
  $("download-trace").disabled = false;
  $("acceptance-note").textContent =
    `The final assignment is ${data.rows.at(-1).name}. Its value at the last token is ${data.accepted ? "true (✓), so this input is accepted." : "false (·), so this input is rejected."}`;
}
function selectRow(i) {
  if (!trace) return;
  selected = Math.max(0, Math.min(i, trace.rows.length - 1));
  $("trace")
    .querySelectorAll("[data-row]")
    .forEach((tr) => tr.classList.toggle("selected", +tr.dataset.row === selected));
  $("row-label").textContent =
    `${selected + 1} / ${trace.rows.length} · ${trace.rows[selected].name}`;
  explainRow();
  $("prev-row").disabled = selected === 0;
  $("next-row").disabled = selected === trace.rows.length - 1;
}

const rowDescriptions = {
  C_open:
    "Count opening parentheses from the start through each column, including the current token.",
  C_close: "Count closing parentheses in the same inclusive prefix.",
  V: "Mark a violation wherever the number of closes exceeds the number of opens. Equal final totals do not rule out an earlier violation.",
  CV: "Count how many prefix violations have occurred so far. Once this is positive, an earlier invalid prefix remains recorded.",
  M: "True if no invalid prefix has occurred up to this position: CV equals zero.",
  B: "True where the opening and closing counts agree. This checks balance, but does not alone check earlier prefixes.",
  D: "Combine M and B: no prefix violation and equal counts. The last cell decides acceptance for the whole input.",
};
function explainRow() {
  const row = trace.rows[selected];
  $("row-explanation").textContent =
    lastRequest?.source === examples.dyck.source
      ? rowDescriptions[row.name]
      : `${row.name}: values produced by this assignment at each token position. Compare this row with the assignment in the program above.`;
}
function updateGuide() {
  const k = $("example").value;
  $("try-valid").hidden = $("try-invalid").hidden = k !== "dyck";
  $("example-guide").textContent =
    k === "dyck"
      ? "Compare two inputs: both have three opens and three closes, but only one has valid prefixes. Load an input, then choose Run program."
      : k === "anbn"
        ? "This program accepts one or more a tokens followed by the same number of b tokens. Run “a a a b b b”, then try “a b a b”: equal totals alone do not ensure the correct order."
        : "This program checks whether an a is immediately followed by b anywhere in the input. Run “b a b a”, then try “b a a”: the second input has both symbols but no adjacent ab.";
}
$("try-valid").onclick = () => {
  $("tokens").value = "()(())";
  markStale();
};
$("try-invalid").onclick = () => {
  $("tokens").value = "())(()";
  markStale();
};
$("try-invalid").textContent = "Load invalid input: ())(()";
updateGuide();

$("prev-row").onclick = () => selectRow(selected - 1);
$("next-row").onclick = () => selectRow(selected + 1);
// -----------------------------------------------------------------------------
// Python worker lifecycle and execution controls
// -----------------------------------------------------------------------------
$("run").onclick = () => {
  if (running) return;
  let request;
  try {
    request = { source: $("program").value, tokens: tokenize($("tokens").value) };
    if (request.source.length > 12000) throw new Error("Program is limited to 12,000 characters.");
  } catch (e) {
    status(e.message, true);
    return;
  }
  running = true;
  $("run").disabled = true;
  $("stop").hidden = false;
  $("download-trace").disabled = true;
  status("Starting interpreter…");
  worker ??= new Worker("runtime/python-worker.js");
  timer = setTimeout(() => {
    stop();
    status(
      "Stopped after 90 seconds. The first run needs internet access to load Python and the interpreter. You can retry.",
      true,
    );
  }, 90000);
  worker.onmessage = ({ data }) => {
    if (data.status) status(data.status);
    if (data.result || data.error) {
      clearTimeout(timer);
      running = false;
      $("run").disabled = false;
      $("stop").hidden = true;
      if (data.error) {
        status(data.error, true);
        worker.terminate();
        worker = undefined;
      } else {
        lastRequest = request;
        renderTrace(data.result);
        status("Evaluated by the pinned Python interpreter.");
        if ($("program").value !== request.source || $("tokens").value !== request.inputText)
          markStale();
      }
    }
  };
  worker.onerror = (e) => {
    stop();
    status(`Interpreter could not start: ${e.message}`, true);
  };
  request.inputText = $("tokens").value;
  worker.postMessage(request);
};
$("stop").onclick = () => {
  stop();
  status("Execution stopped.");
};
$("program").oninput = markStale;
$("tokens").oninput = markStale;
function reset() {
  stop();
  const e = examples[$("example").value];
  $("tokens").value = e.tokens;
  $("program").value = e.source;
  updateGuide();
  markStale();
}
$("example").onchange = reset;
$("reset").onclick = reset;
// -----------------------------------------------------------------------------
// Trace export and shareable program links
// -----------------------------------------------------------------------------
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
$("download-trace").onclick = () =>
  download("crasp-trace.json", {
    ...trace,
    program: lastRequest.source,
    interpreter_commit: "1e821d7279015ce0e77830faa7932575447c5164",
  });
$("share").onclick = async () => {
  const url = new URL(location.href);
  url.hash =
    "program=" +
    encodeURIComponent(JSON.stringify({ source: $("program").value, tokens: $("tokens").value }));
  try {
    await navigator.clipboard.writeText(url.href);
    status("Program link copied. Shared links do not execute automatically.");
  } catch {
    history.replaceState(null, "", url);
    status("Program saved in the address bar. Copy the URL to share it.");
  }
};
// Initialize the saved trace and gallery; shared URLs never execute automatically.
try {
  const response = await fetch("data/default-trace.json");
  if (!response.ok) throw new Error("Saved trace unavailable.");
  lastRequest = { source: examples.dyck.source, tokens: tokenize(examples.dyck.tokens) };
  renderTrace(await response.json());
} catch (e) {
  status(e.message, true);
  $("download-trace").disabled = true;
}
if (location.hash.startsWith("#program=")) {
  try {
    const shared = JSON.parse(decodeURIComponent(location.hash.slice(9)));
    if (
      typeof shared.source !== "string" ||
      typeof shared.tokens !== "string" ||
      shared.source.length > 12000 ||
      shared.tokens.length > 10000
    )
      throw new Error("Invalid shared program.");
    $("program").value = shared.source;
    $("tokens").value = shared.tokens;
    markStale();
    $("playground").scrollIntoView();
  } catch (e) {
    status(`Could not load shared program: ${e.message}`, true);
  }
}
