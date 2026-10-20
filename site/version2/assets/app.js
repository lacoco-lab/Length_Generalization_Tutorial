import {tokenize} from './lib.js';
const $ = id => document.getElementById(id);

/* ---- Section accordion (one open at a time) ---- */
const chapters = [...document.querySelectorAll('details.chapter')];

function setTocActive(id) {
  document.querySelectorAll('[data-open-section]').forEach(a => {
    a.classList.toggle('is-active', a.dataset.openSection === id);
  });
}

function openSection(id, {scroll = true} = {}) {
  const target = document.getElementById(id);
  if (!target || !target.classList.contains('chapter')) return;
  chapters.forEach(ch => { ch.open = ch === target; });
  setTocActive(id);
  if (scroll) {
    requestAnimationFrame(() => {
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  }
  history.replaceState(null, '', `#${id}`);
}

chapters.forEach(ch => {
  ch.addEventListener('toggle', () => {
    if (!ch.open) return;
    chapters.forEach(other => {
      if (other !== ch) other.open = false;
    });
    setTocActive(ch.id);
  });
});

document.querySelectorAll('[data-open-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    openSection(el.dataset.openSection);
  });
});

document.querySelectorAll('.next-chapter').forEach(btn => {
  btn.addEventListener('click', () => openSection(btn.dataset.next));
});

const initialHash = location.hash.replace(/^#/, '');
if (initialHash && document.getElementById(initialHash)?.classList.contains('chapter')) {
  openSection(initialHash, {scroll: false});
} else {
  setTocActive(chapters.find(ch => ch.open)?.id || 'question');
}


const examples = {
  dyck: {tokens: '( ) ( ( ) )', source: 'C_open = # "("\nC_close = # ")"\nV = C_open < C_close\nCV = # V\nM = (CV == 0)\nB = (C_open == C_close)\nD = M && B'},
  anbn: {tokens: 'a a a b b b', source: 'A = # "a"\nB = # "b"\nBad = "a" && (B > 0)\nOther = !("a" || "b")\nErrors = #(Bad || Other)\nAccept = (A == B) && (Errors == 0) && (A > 0)'},
  previous: {tokens: 'b a b a', source: '#import pred\nC = #[pred] "a"\nPair = "b" && (C > 0)\nPairs = # Pair\nAccept = Pairs > 0'}
};

/* ---- Guided walkthrough on ( ) ---- */
const walkTokens = ['(', ')'];
const walkProgramLines = [
  'C_open  = # "("',
  'C_close = # ")"',
  'V       = C_open < C_close',
  'CV      = # V',
  'M       = (CV == 0)',
  'B       = (C_open == C_close)',
  'D       = M && B',
];
const walkRows = [
  {name: 'C_open', values: [1, 1]},
  {name: 'C_close', values: [0, 1]},
  {name: 'V', values: [false, false]},
  {name: 'CV', values: [0, 0]},
  {name: 'M', values: [true, true]},
  {name: 'B', values: [false, true]},
  {name: 'D', values: [false, true]},
];
const walkSteps = [
  {
    reveal: -1,
    line: -1,
    caption: 'Each column is one input position. Each program line will fill a whole row (a vector). We start from token markers and build the two Dyck conditions out of counts.',
    verdict: '',
  },
  {
    reveal: 0,
    line: 0,
    caption: 'C_open = # "(" — prefix count of opens. Under “(” the count is 1; under “)” it stays 1. This is the running open-count both Dyck conditions need.',
    verdict: '',
  },
  {
    reveal: 1,
    line: 1,
    caption: 'C_close = # ")" — same for closes: 0, then 1. Now every prefix has a pair of numbers we can compare.',
    verdict: '',
  },
  {
    reveal: 2,
    line: 2,
    caption: 'V marks a prefix violation: more closes than opens (C_open < C_close). Here both entries are false. On ())( this row would turn true in the middle.',
    verdict: '',
  },
  {
    reveal: 3,
    line: 3,
    caption: 'CV = # V — how many violations so far. Once this leaves zero, a bad prefix is remembered for the rest of the string. Here it stays 0.',
    verdict: '',
  },
  {
    reveal: 4,
    line: 4,
    caption: 'M means “no violation yet”: CV == 0. That is condition (1) as a Boolean at each position.',
    verdict: '',
  },
  {
    reveal: 5,
    line: 5,
    caption: 'B means equal open and close counts—condition (2). False after “(” (1≠0), true after “)” (1=1). Alone, B would wrongly accept ())( ; that is why M is required too.',
    verdict: '',
  },
  {
    reveal: 6,
    line: 6,
    caption: 'D = M && B joins both conditions. Accept iff the last entry of D is true. Here it is → accept. Same program, longer inputs: only the vectors grow.',
    verdict: 'Accepted',
  },
];
let walkIndex = 0;

function fmt(v) {
  if (typeof v === 'boolean') return v ? '✓' : '·';
  return String(v);
}

function renderWalkProgram(activeLine) {
  const pre = $('walk-program');
  pre.replaceChildren();
  walkProgramLines.forEach((text, i) => {
    const line = document.createElement('div');
    line.className = 'program-line' + (i === activeLine ? ' active' : '');
    line.textContent = text;
    pre.append(line);
  });
}

function renderWalk() {
  const step = walkSteps[walkIndex];
  renderWalkProgram(step.line);
  const table = $('walk-table');
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  ['', ...walkTokens].forEach((t, i) => {
    const th = document.createElement('th');
    th.textContent = i === 0 ? 'Assignment' : `${i - 1}: ${t}`;
    head.append(th);
  });
  const body = table.createTBody();
  walkRows.forEach((row, ri) => {
    const tr = body.insertRow();
    if (ri === step.reveal) tr.classList.add('reveal');
    const th = document.createElement('th');
    th.textContent = row.name;
    tr.append(th);
    row.values.forEach(v => {
      const td = tr.insertCell();
      if (ri > step.reveal) {
        td.textContent = '·';
        td.classList.add('dim');
      } else {
        td.textContent = fmt(v);
      }
    });
  });
  $('walk-caption').textContent = step.caption;
  $('walk-step-label').textContent = `Step ${walkIndex + 1} / ${walkSteps.length}`;
  $('walk-prev').disabled = walkIndex === 0;
  $('walk-next').disabled = walkIndex === walkSteps.length - 1;
  const verdict = $('walk-verdict');
  verdict.textContent = step.verdict;
  verdict.className = step.verdict ? 'result accepted' : 'result';
}

$('walk-prev').onclick = () => { walkIndex = Math.max(0, walkIndex - 1); renderWalk(); };
$('walk-next').onclick = () => { walkIndex = Math.min(walkSteps.length - 1, walkIndex + 1); renderWalk(); };
$('walk-reset').onclick = () => { walkIndex = 0; renderWalk(); };
renderWalk();

/* ---- Interactive interpreter ---- */
let trace, selected = 0, worker, timer, running = false, lastRequest;
let playIndex = -1;
let playTimer = null;
const PLAY_MS = 650;

function status(message, error = false) {
  $('engine-status').textContent = message;
  $('engine-status').classList.toggle('error', error);
}
function setRunMode(mode) {
  const btn = $('run');
  const pausing = mode === 'stop';
  btn.dataset.mode = pausing ? 'stop' : 'play';
  const label = pausing ? 'Pause' : (canResumePlayback() ? 'Resume' : 'Run program');
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
function isBusy() {
  return running || playTimer !== null;
}
function inputUnchanged() {
  if (!lastRequest) return false;
  const tokens = (() => {
    try { return tokenize($('tokens').value); } catch { return null; }
  })();
  if (!tokens) return false;
  return lastRequest.source === currentProgramSource()
    && tokens.length === lastRequest.tokens.length
    && tokens.every((t, i) => t === lastRequest.tokens[i]);
}
function canResumePlayback() {
  return Boolean(trace && !running && playTimer === null
    && playIndex >= 0 && playIndex < trace.rows.length - 1
    && inputUnchanged());
}
function syncRunButton() {
  setRunMode(isBusy() ? 'stop' : 'play');
}
function stop() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(timer);
  running = false;
  syncRunButton();
}
function stopPlayback() {
  clearInterval(playTimer);
  playTimer = null;
  syncRunButton();
}
function advancePlaybackTick() {
  if (!trace) return;
  if (playIndex >= trace.rows.length - 1) {
    stopPlayback();
    status('Evaluated by the pinned Python interpreter.');
    return;
  }
  playIndex += 1;
  paintTrace();
  if (playIndex >= trace.rows.length - 1) {
    stopPlayback();
    status('Evaluated by the pinned Python interpreter.');
  }
}
function resumePlayback() {
  if (!trace || playIndex >= trace.rows.length - 1) return;
  status('Resumed…');
  playTimer = setInterval(advancePlaybackTick, PLAY_MS);
  syncRunButton();
}
function markStale() {
  stopPlayback();
  $('download-trace').disabled = true;
  $('result').textContent = 'Edits not evaluated';
  $('result').className = 'result';
  $('acceptance-note').textContent = 'Edits not evaluated yet — choose Run program.';
  status('Program or input changed. Run to update the trace.');
  renderExecProgram(null);
  showTraceUI(false);
  trace = null;
  playIndex = -1;
  $('row-label').textContent = '—';
  $('result').textContent = '';
  $('result').className = 'result';
  $('acceptance-note').textContent = '';
  $('command-link').textContent = '';
}

function lineIndexForAssignment(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^\\s*${escaped}\\s*=`);
  return source.split('\n').findIndex(line => re.test(line));
}

function currentProgramSource() {
  return $('program').value;
}

function renderExecProgram(activeName) {
  const pre = $('exec-program');
  const source = (playIndex >= 0 && lastRequest?.source) ? lastRequest.source : currentProgramSource();
  pre.replaceChildren();
  const active = activeName ? lineIndexForAssignment(source, activeName) : -1;
  source.split('\n').forEach((text, i) => {
    const line = document.createElement('div');
    line.className = 'program-line' + (i === active ? ' active' : '');
    line.textContent = text || ' ';
    pre.append(line);
  });
}

/* ---- Block builder (pencil → drag & drop, not free typing) ---- */
let builderLines = [];
let builderDragType = null;
let builderReorderFrom = null;
let builderCommitted = false;
let builderBaseline = ''; // program text when builder was opened / last restored
let builderHistory = [];
let builderHistoryIndex = -1;
let builderHistoryLock = false;
let builderHistoryTimer = 0;
let builderSelectedIndex = -1;
let checkWorker;

function freshName(prefix = 'P') {
  const used = new Set(builderLines.map(l => l.name));
  let i = 1;
  while (used.has(`${prefix}${i}`)) i += 1;
  return `${prefix}${i}`;
}

function defaultBlock(type) {
  switch (type) {
    case 'count_token':
      return {type, name: freshName('C'), token: '('};
    case 'count_pred':
      return {type, name: freshName('C'), pred: 'true', negate: false};
    case 'marker':
      return {type, name: freshName('T'), token: 'a'};
    case 'compare':
      return {type, name: freshName('P'), left: 'C1', op: '<', right: 'C2'};
    case 'and':
      return {type, name: freshName('P'), left: 'P1', right: 'P2'};
    case 'or':
      return {type, name: freshName('P'), left: 'P1', right: 'P2'};
    case 'not':
      return {type, name: freshName('P'), arg: 'P1'};
    default:
      return {type: 'raw', name: freshName('X'), text: 'true'};
  }
}

function serializeBlock(b) {
  const n = (b.name || 'P').trim() || 'P';
  switch (b.type) {
    case 'count_token':
      return `${n} = # "${(b.token || '').replace(/"/g, '')}"`;
    case 'count_pred': {
      const pred = (b.pred || 'true').trim() || 'true';
      return `${n} = # ${b.negate ? `!${pred}` : pred}`;
    }
    case 'marker':
      return `${n} = "${(b.token || '').replace(/"/g, '')}"`;
    case 'compare': {
      const left = (b.left || '0').trim();
      const right = (b.right || '0').trim();
      const op = b.op || '==';
      return `${n} = (${left} ${op} ${right})`;
    }
    case 'and':
      return `${n} = ${(b.left || 'P').trim()} && ${(b.right || 'Q').trim()}`;
    case 'or':
      return `${n} = ${(b.left || 'P').trim()} || ${(b.right || 'Q').trim()}`;
    case 'not':
      return `${n} = !${(b.arg || 'P').trim()}`;
    case 'raw':
      return `${n} = ${(b.text || 'true').trim()}`;
    default:
      return `${n} = true`;
  }
}

function serializeBuilder() {
  return builderLines.map(serializeBlock).join('\n');
}

function setCommitStatus(text, kind = '') {
  const el = $('builder-commit-status');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'builder-commit-status' + (kind ? ` is-${kind}` : '');
}

function updateBuilderSource() {
  const src = serializeBuilder();
  const pre = $('builder-source');
  if (pre) {
    pre.replaceChildren();
    if (!builderLines.length) {
      // empty ::before handles placeholder
    } else {
      builderLines.forEach((block, i) => {
        const line = document.createElement('div');
        line.className = 'builder-source-line' + (i === builderSelectedIndex ? ' is-active' : '');
        line.dataset.index = String(i);
        line.textContent = serializeBlock(block);
        line.addEventListener('click', () => selectBuilderLine(i));
        pre.append(line);
      });
    }
  }
  if ($('program')) $('program').value = src;
  highlightBuilderLinks();
}

function selectBuilderLine(index) {
  if (index < 0 || index >= builderLines.length) {
    builderSelectedIndex = -1;
  } else {
    builderSelectedIndex = index;
  }
  document.querySelectorAll('.builder-card').forEach((card, i) => {
    card.classList.toggle('is-selected', i === builderSelectedIndex);
  });
  document.querySelectorAll('.builder-source-line').forEach(line => {
    line.classList.toggle('is-active', Number(line.dataset.index) === builderSelectedIndex);
  });
  highlightBuilderLinks();
  const activeLine = document.querySelector('.builder-source-line.is-active');
  activeLine?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  const activeCard = document.querySelector('.builder-card.is-selected');
  activeCard?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}

function highlightBuilderLinks() {
  const type = builderSelectedIndex >= 0 ? builderLines[builderSelectedIndex]?.type : null;
  document.querySelectorAll('.palette-block').forEach(btn => {
    const match = type && btn.dataset.block === type;
    btn.classList.toggle('is-linked', Boolean(match));
  });
}

function snapshotBuilder() {
  return JSON.parse(JSON.stringify(builderLines));
}

function pushBuilderHistory({immediate = false} = {}) {
  if (builderHistoryLock) return;
  const doPush = () => {
    const snap = snapshotBuilder();
    const serialized = JSON.stringify(snap);
    if (builderHistoryIndex >= 0 && JSON.stringify(builderHistory[builderHistoryIndex]) === serialized) {
      syncBuilderNavButtons();
      return;
    }
    builderHistory = builderHistory.slice(0, builderHistoryIndex + 1);
    builderHistory.push(snap);
    if (builderHistory.length > 80) {
      builderHistory.shift();
      builderHistoryIndex = builderHistory.length - 1;
    } else {
      builderHistoryIndex = builderHistory.length - 1;
    }
    syncBuilderNavButtons();
  };
  if (immediate) {
    clearTimeout(builderHistoryTimer);
    doPush();
    return;
  }
  clearTimeout(builderHistoryTimer);
  builderHistoryTimer = setTimeout(doPush, 280);
}

function applyBuilderSnapshot(snap) {
  builderHistoryLock = true;
  builderLines = JSON.parse(JSON.stringify(snap));
  renderBuilder();
  builderCommitted = false;
  setCommitStatus('Uncommitted changes', 'pending');
  updateBuilderSource();
  markStale();
  document.querySelector('.program-panel')?.classList.add('editing');
  $('program-builder').hidden = false;
  builderHistoryLock = false;
  syncBuilderNavButtons();
}

function syncBuilderNavButtons() {
  const back = $('builder-back');
  const forth = $('builder-forth');
  if (back) back.disabled = builderHistoryIndex <= 0;
  if (forth) forth.disabled = builderHistoryIndex < 0 || builderHistoryIndex >= builderHistory.length - 1;
}

function builderUndo() {
  if (builderHistoryIndex <= 0) return;
  builderHistoryIndex -= 1;
  applyBuilderSnapshot(builderHistory[builderHistoryIndex]);
}

function builderRedo() {
  if (builderHistoryIndex >= builderHistory.length - 1) return;
  builderHistoryIndex += 1;
  applyBuilderSnapshot(builderHistory[builderHistoryIndex]);
}

function builderRestoreInitial() {
  builderLines = parseProgramToBlocks(builderBaseline);
  renderBuilder();
  pushBuilderHistory({immediate: true});
  builderCommitted = false;
  setCommitStatus('Restored initial program', 'pending');
  updateBuilderSource();
  markStale();
  document.querySelector('.program-panel')?.classList.add('editing');
  $('program-builder').hidden = false;
  status('Restored the program from when you opened the builder.');
}

function syncBuilderToProgram({immediateHistory = false} = {}) {
  builderCommitted = false;
  setCommitStatus('Uncommitted changes', 'pending');
  updateBuilderSource();
  pushBuilderHistory({immediate: immediateHistory});
  markStale();
  // Keep builder visible after markStale clears trace
  document.querySelector('.program-panel')?.classList.add('editing');
  $('program-builder').hidden = false;
}

function localWellFormedCheck(source) {
  const issues = [];
  const lines = source.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  if (!lines.length) issues.push('Add at least one assignment.');
  const seen = new Set();
  const defined = new Set();
  lines.forEach((line, i) => {
    if (line.startsWith('#import')) {
      const imp = line.match(/^#import\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (imp) defined.add(imp[1]);
      return;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!m) {
      issues.push(`Line ${i + 1}: expected Name = expression.`);
      return;
    }
    const [, name, rhs] = m;
    if (seen.has(name)) issues.push(`Duplicate name “${name}”.`);
    seen.add(name);
    const stripped = rhs.replace(/"(?:\\.|[^"\\])*"/g, '""');
    for (const ref of stripped.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) {
      if (['true', 'false', 'min', 'max', 'if', 'else'].includes(ref)) continue;
      if (!defined.has(ref)) {
        issues.push(`“${ref}” is used before it is defined (or is unknown).`);
      }
    }
    defined.add(name);
  });
  return [...new Set(issues)];
}

function parseProgramToBlocks(source) {
  const lines = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#import')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const name = m[1];
    let rhs = m[2].trim();
    // strip outer parens once
    if (rhs.startsWith('(') && rhs.endsWith(')')) {
      const inner = rhs.slice(1, -1).trim();
      if (!inner.includes('(')) rhs = inner;
    }
    let block = null;
    let mm;
    if ((mm = rhs.match(/^#\s*"([^"]*)"\s*$/))) {
      block = {type: 'count_token', name, token: mm[1]};
    } else if ((mm = rhs.match(/^#\s*!?\s*([A-Za-z_][A-Za-z0-9_]*|true|false)\s*$/))) {
      block = {type: 'count_pred', name, pred: mm[1], negate: /^#\s*!/.test(rhs)};
    } else if ((mm = rhs.match(/^"([^"]*)"\s*$/))) {
      block = {type: 'marker', name, token: mm[1]};
    } else if ((mm = rhs.match(/^(.+?)\s*(<=|>=|==|!=|<|>)\s*(.+)$/))) {
      block = {type: 'compare', name, left: mm[1].replace(/^\(|\)$/g, '').trim(), op: mm[2], right: mm[3].replace(/^\(|\)$/g, '').trim()};
    } else if ((mm = rhs.match(/^(.+?)\s*&&\s*(.+)$/))) {
      block = {type: 'and', name, left: mm[1].trim(), right: mm[2].trim()};
    } else if ((mm = rhs.match(/^(.+?)\s*\|\|\s*(.+)$/))) {
      block = {type: 'or', name, left: mm[1].trim(), right: mm[2].trim()};
    } else if ((mm = rhs.match(/^!\s*(.+)$/))) {
      block = {type: 'not', name, arg: mm[1].trim()};
    } else {
      block = {type: 'raw', name, text: rhs};
    }
    lines.push(block);
  }
  return lines;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function field(label, control) {
  return el('label', {}, [label, control]);
}

function renderBuilderCard(block, index) {
  const card = el('div', {
    className: 'builder-card' + (index === builderSelectedIndex ? ' is-selected' : ''),
    draggable: 'true',
    'data-index': String(index),
  });
  card.addEventListener('click', e => {
    if (e.target.closest('input, select, button, textarea')) return;
    selectBuilderLine(index);
  });
  card.addEventListener('dragstart', e => {
    builderReorderFrom = index;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', `reorder:${index}`);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    builderReorderFrom = null;
  });

  const handle = el('div', {className: 'builder-card-handle', title: 'Drag to reorder', text: '⋮⋮'});
  const body = el('div', {className: 'builder-card-body'});

  const nameInput = el('input', {value: block.name, 'aria-label': 'Variable name'});
  nameInput.addEventListener('input', () => {
    block.name = nameInput.value.trim() || block.name;
    syncBuilderToProgram();
    updateBuilderPreview(card, block);
  });
  body.append(field('name', nameInput));

  if (block.type === 'count_token' || block.type === 'marker') {
    const tok = el('input', {value: block.token ?? '', 'aria-label': 'Token'});
    tok.addEventListener('input', () => {
      block.token = tok.value;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    });
    body.append(field('token', tok));
  } else if (block.type === 'count_pred') {
    const pred = el('input', {value: block.pred ?? 'true', list: 'builder-name-list', 'aria-label': 'Predicate'});
    const neg = el('input', {type: 'checkbox', 'aria-label': 'Negate'});
    neg.checked = Boolean(block.negate);
    pred.addEventListener('input', () => {
      block.pred = pred.value;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    });
    neg.addEventListener('change', () => {
      block.negate = neg.checked;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    });
    body.append(field('predicate', pred), field('not', neg));
  } else if (block.type === 'compare') {
    const left = el('input', {value: block.left ?? '', list: 'builder-name-list'});
    const op = el('select', {}, ['<', '<=', '>', '>=', '==', '!='].map(o => {
      const opt = el('option', {value: o, text: o});
      if (o === block.op) opt.selected = true;
      return opt;
    }));
    const right = el('input', {value: block.right ?? '', list: 'builder-name-list'});
    const bump = () => {
      block.left = left.value;
      block.op = op.value;
      block.right = right.value;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    };
    left.addEventListener('input', bump);
    op.addEventListener('change', bump);
    right.addEventListener('input', bump);
    body.append(field('left', left), field('op', op), field('right', right));
  } else if (block.type === 'and' || block.type === 'or') {
    const left = el('input', {value: block.left ?? '', list: 'builder-name-list'});
    const right = el('input', {value: block.right ?? '', list: 'builder-name-list'});
    const bump = () => {
      block.left = left.value;
      block.right = right.value;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    };
    left.addEventListener('input', bump);
    right.addEventListener('input', bump);
    body.append(field('left', left), el('span', {text: block.type === 'and' ? '&&' : '||'}), field('right', right));
  } else if (block.type === 'not') {
    const arg = el('input', {value: block.arg ?? '', list: 'builder-name-list'});
    arg.addEventListener('input', () => {
      block.arg = arg.value;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    });
    body.append(el('span', {text: '!'}), field('predicate', arg));
  } else {
    const text = el('input', {value: block.text ?? '', style: 'max-width:220px'});
    text.addEventListener('input', () => {
      block.text = text.value;
      syncBuilderToProgram();
      updateBuilderPreview(card, block);
    });
    body.append(field('expression', text));
  }

  const preview = el('code', {className: 'builder-preview', text: serializeBlock(block)});
  body.append(preview);

  const remove = el('button', {
    type: 'button',
    className: 'builder-card-remove',
    title: 'Remove line',
    text: '×',
    onclick: () => {
      builderLines.splice(index, 1);
      renderBuilder();
      syncBuilderToProgram({immediateHistory: true});
    },
  });

  card.append(handle, body, remove);
  return card;
}

function updateBuilderPreview(card, block) {
  const preview = card.querySelector('.builder-preview');
  if (preview) preview.textContent = serializeBlock(block);
}

function renderBuilder() {
  const host = $('builder-lines');
  const empty = $('builder-empty');
  host.replaceChildren();
  // datalist of names for inputs
  let list = document.getElementById('builder-name-list');
  if (!list) {
    list = el('datalist', {id: 'builder-name-list'});
    document.body.append(list);
  }
  list.replaceChildren(...builderLines.map(l => el('option', {value: l.name})));

  empty.hidden = builderLines.length > 0;
  if (builderSelectedIndex >= builderLines.length) builderSelectedIndex = builderLines.length ? builderLines.length - 1 : -1;
  builderLines.forEach((block, i) => host.append(renderBuilderCard(block, i)));
  updateBuilderSource();
}

function addBuilderBlock(type, atIndex = builderLines.length) {
  const block = defaultBlock(type);
  // Prefer sensible names from earlier lines when possible
  if (type === 'compare' && builderLines.length >= 2) {
    block.left = builderLines[builderLines.length - 2].name;
    block.right = builderLines[builderLines.length - 1].name;
  }
  if ((type === 'and' || type === 'or') && builderLines.length >= 2) {
    block.left = builderLines[builderLines.length - 2].name;
    block.right = builderLines[builderLines.length - 1].name;
  }
  if (type === 'count_pred' && builderLines.length) {
    block.pred = builderLines[builderLines.length - 1].name;
  }
  if (type === 'not' && builderLines.length) {
    block.arg = builderLines[builderLines.length - 1].name;
  }
  builderLines.splice(atIndex, 0, block);
  builderSelectedIndex = atIndex;
  renderBuilder();
  syncBuilderToProgram({immediateHistory: true});
}

function setupBuilderDnD() {
  document.querySelectorAll('.palette-block').forEach(btn => {
    btn.addEventListener('dragstart', e => {
      builderDragType = btn.dataset.block;
      e.dataTransfer.setData('text/plain', `palette:${btn.dataset.block}`);
      e.dataTransfer.effectAllowed = 'copy';
    });
    btn.addEventListener('dragend', () => { builderDragType = null; });
    btn.addEventListener('click', () => addBuilderBlock(btn.dataset.block));
  });

  const canvas = $('builder-canvas');
  canvas.addEventListener('dragover', e => {
    e.preventDefault();
    canvas.classList.add('drag-over');
    e.dataTransfer.dropEffect = builderDragType ? 'copy' : 'move';
  });
  canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const data = e.dataTransfer.getData('text/plain') || '';
    if (data.startsWith('palette:')) {
      addBuilderBlock(data.slice(8));
      return;
    }
    if (data.startsWith('reorder:')) {
      const from = Number(data.slice(8));
      if (Number.isNaN(from)) return;
      // drop at end for simplicity when dropping on canvas background
      const [item] = builderLines.splice(from, 1);
      builderLines.push(item);
      renderBuilder();
      syncBuilderToProgram({immediateHistory: true});
    }
  });

  $('builder-lines').addEventListener('dragover', e => {
    const card = e.target.closest('.builder-card');
    if (!card) return;
    e.preventDefault();
  });
  $('builder-lines').addEventListener('drop', e => {
    const card = e.target.closest('.builder-card');
    if (!card) return;
    e.preventDefault();
    e.stopPropagation();
    const to = Number(card.dataset.index);
    const data = e.dataTransfer.getData('text/plain') || '';
    if (data.startsWith('palette:')) {
      addBuilderBlock(data.slice(8), to);
      return;
    }
    if (data.startsWith('reorder:')) {
      const from = Number(data.slice(8));
      if (Number.isNaN(from) || from === to) return;
      const [item] = builderLines.splice(from, 1);
      builderLines.splice(to, 0, item);
      renderBuilder();
      syncBuilderToProgram({immediateHistory: true});
    }
  });
}

function setProgramEditing(on) {
  const panel = document.querySelector('.program-panel');
  const wasEditing = panel.classList.contains('editing');
  panel.classList.toggle('editing', on);
  $('program-builder').hidden = !on;
  $('edit-program').hidden = on;
  $('edit-program').setAttribute('aria-pressed', String(on));
  const builderActions = document.querySelector('.program-actions-builder');
  const runActions = document.querySelector('.program-actions-run');
  if (builderActions) builderActions.hidden = !on;
  if (runActions) runActions.hidden = on;
  if (on) {
    stopPlayback();
    builderCommitted = false;
    builderBaseline = currentProgramSource();
    builderLines = parseProgramToBlocks(builderBaseline);
    builderHistory = [snapshotBuilder()];
    builderHistoryIndex = 0;
    builderSelectedIndex = builderLines.length ? 0 : -1;
    renderBuilder();
    syncBuilderNavButtons();
    setCommitStatus(builderLines.length ? 'Edit, then Commit to check' : 'Drag commands into Your program', 'pending');
  } else {
    if (wasEditing && builderLines.length) {
      $('program').value = serializeBuilder();
    }
    renderExecProgram(playIndex >= 0 && trace ? trace.rows[playIndex]?.name : null);
  }
  if (!trace) updateTraceEmptyHint();
}

function stopCheckWorker() {
  if (!checkWorker) return;
  checkWorker.terminate();
  checkWorker = undefined;
}

async function commitProgram() {
  updateBuilderSource();
  const source = serializeBuilder().trim();
  $('program').value = source;
  const localIssues = localWellFormedCheck(source);
  if (localIssues.length) {
    builderCommitted = false;
    setCommitStatus(`Not well-formed — ${localIssues[0]}`, 'bad');
    status(localIssues.join(' '), true);
    return;
  }
  let tokens;
  try {
    tokens = tokenize($('tokens').value);
  } catch (e) {
    builderCommitted = false;
    setCommitStatus(`Not well-formed — ${e.message}`, 'bad');
    status(e.message, true);
    return;
  }
  setCommitStatus('Checking with interpreter…', 'pending');
  status('Checking whether the program is well-formed…');
  stopCheckWorker();
  checkWorker = new Worker('runtime/python-worker.js');
  const timer = setTimeout(() => {
    stopCheckWorker();
    builderCommitted = false;
    setCommitStatus('Check timed out', 'bad');
    status('Well-formedness check timed out. Try again.', true);
  }, 120000);
  checkWorker.onmessage = ({data}) => {
    if (data.status) status(data.status);
    if (data.error) {
      clearTimeout(timer);
      stopCheckWorker();
      builderCommitted = false;
      const msg = String(data.error).replace(/^Error:\s*/i, '');
      setCommitStatus(`Not well-formed — ${msg}`, 'bad');
      status(msg, true);
      return;
    }
    if (data.check) {
      clearTimeout(timer);
      stopCheckWorker();
      builderCommitted = true;
      const acceptNote = data.check.accepted === true ? ' · accepts this input'
        : data.check.accepted === false ? ' · rejects this input' : '';
      setCommitStatus(`Well-formed ✓ (${data.check.statements} lines)${acceptNote}`, 'ok');
      updateBuilderSource();
      status('Program is well-formed. Leaving the builder — Run to step through the trace.');
      setProgramEditing(false);
      markStale();
    }
  };
  checkWorker.onerror = e => {
    clearTimeout(timer);
    stopCheckWorker();
    builderCommitted = false;
    setCommitStatus('Check failed to start', 'bad');
    status(`Could not start checker: ${e.message}`, true);
  };
  checkWorker.postMessage({mode: 'check', source, tokens});
}

$('edit-program').onclick = () => setProgramEditing(true);
$('builder-back').onclick = () => builderUndo();
$('builder-forth').onclick = () => builderRedo();
$('builder-restore').onclick = () => builderRestoreInitial();
$('commit-program').onclick = () => { commitProgram(); };
setupBuilderDnD();

// If user edits advanced text, re-parse into cards
$('program').addEventListener('change', () => {
  if (document.querySelector('.program-panel')?.classList.contains('editing')) {
    builderCommitted = false;
    builderLines = parseProgramToBlocks(currentProgramSource());
    renderBuilder();
    pushBuilderHistory();
    setCommitStatus('Uncommitted text edits', 'pending');
  }
});

function setTokensEditing(on) {
  const input = $('tokens');
  input.readOnly = !on;
  $('edit-tokens').hidden = on;
  $('edit-tokens').setAttribute('aria-pressed', String(on));
  $('done-edit-tokens').hidden = !on;
  if (on) {
    input.focus();
    input.select();
  } else {
    input.blur();
  }
}
$('edit-tokens').onclick = () => setTokensEditing(true);
$('done-edit-tokens').onclick = () => {
  markStale();
  setTokensEditing(false);
};
$('tokens').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('tokens').readOnly) {
    e.preventDefault();
    markStale();
    setTokensEditing(false);
  }
});
$('copy-program').onclick = async () => {
  try {
    await navigator.clipboard.writeText(currentProgramSource());
    status('Program copied to clipboard.');
  } catch {
    status('Could not copy program.', true);
  }
};

function focusAssignment(ri) {
  if (!trace || ri < 0 || ri >= trace.rows.length) return;
  stopPlayback();
  playIndex = ri;
  selected = ri;
  paintTrace();
  const active = $('exec-program')?.querySelector('.program-line.active');
  active?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}

function updateTraceEmptyHint() {
  const empty = $('trace-empty');
  if (!empty) return;
  const editing = document.querySelector('.program-panel')?.classList.contains('editing');
  if (editing) {
    empty.dataset.mode = 'builder';
    empty.innerHTML = 'Finish editing in the builder first. Press <strong>Commit</strong> to check that the program is well-formed — then you can run it and fill this area with the execution trace.';
  } else {
    empty.dataset.mode = 'idle';
    empty.textContent = 'Nothing has run yet. Press play to fill this area with the execution trace.';
  }
}

function showTraceUI(hasTrace) {
  $('trace-empty').hidden = hasTrace;
  $('trace-scroll').hidden = !hasTrace;
  $('command-link').hidden = !hasTrace;
  if (!hasTrace) updateTraceEmptyHint();
}

function paintTrace() {
  if (!trace) return;
  showTraceUI(true);
  const reveal = playIndex;
  const source = lastRequest?.source || currentProgramSource();
  const table = $('trace');
  table.replaceChildren();
  const caption = table.createCaption();
  caption.className = 'small';
  caption.textContent = 'Click an assignment to highlight its program line. Values by token position (zero-based).';
  const head = table.createTHead().insertRow();
  ['Assignment', ...trace.tokens.map((t, i) => `${i}: ${t}`)].forEach(t => {
    const th = document.createElement('th');
    th.textContent = t;
    head.append(th);
  });
  const body = table.createTBody();
  const done = reveal >= trace.rows.length - 1;
  trace.rows.forEach((row, ri) => {
    const tr = body.insertRow();
    tr.dataset.row = ri;
    if (ri === reveal) tr.classList.add('reveal', 'selected');
    const th = document.createElement('th');
    th.className = 'assign-cell';
    const lineText = assignmentLine(source, row.name);
    if (ri <= reveal) {
      const b = document.createElement('button');
      b.className = 'assign-btn';
      b.type = 'button';
      b.textContent = lineText;
      b.title = 'Show this line in the program';
      b.onclick = () => focusAssignment(ri);
      th.append(b);
    } else {
      th.textContent = lineText;
      th.classList.add('dim');
    }
    tr.append(th);
    row.values.forEach(value => {
      const td = tr.insertCell();
      if (ri > reveal) {
        td.textContent = '·';
        td.classList.add('dim');
      } else {
        td.textContent = typeof value === 'boolean' ? (value ? '✓' : '·') : value;
        td.onclick = () => focusAssignment(ri);
      }
    });
  });

  selected = Math.max(0, reveal);
  const row = trace.rows[selected];
  $('row-label').textContent = reveal < 0
    ? 'Waiting…'
    : `${selected + 1} / ${trace.rows.length}`;
  renderExecProgram(reveal >= 0 ? row.name : null);
  updateCommandLink(reveal >= 0 ? row.name : null);

  $('prev-row').disabled = reveal <= 0;
  $('next-row').disabled = reveal >= trace.rows.length - 1;
  $('replay-trace').disabled = !trace;
  $('skip-trace').disabled = done;

  if (done) {
    $('result').textContent = trace.accepted ? 'Accepted' : 'Rejected';
    $('result').className = `result ${trace.accepted ? 'accepted' : 'rejected'}`;
    $('download-trace').disabled = false;
    $('acceptance-note').textContent = `Accept/reject is the last cell of the final Boolean row (${trace.rows.at(-1).name}).`;
  } else {
    $('result').textContent = reveal < 0 ? '' : `Executing ${row.name}…`;
    $('result').className = 'result';
    $('download-trace').disabled = true;
    $('acceptance-note').textContent = '';
  }
}

function startPlayback(data, {animate = true, fromIndex = 0} = {}) {
  stopPlayback();
  trace = data;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduceMotion || !data.rows.length) {
    playIndex = Math.max(0, data.rows.length - 1);
    paintTrace();
    syncRunButton();
    return;
  }
  playIndex = Math.max(0, Math.min(fromIndex, data.rows.length - 1));
  paintTrace();
  status(fromIndex > 0 ? 'Resumed…' : 'Playing execution…');
  if (playIndex >= data.rows.length - 1) {
    status('Evaluated by the pinned Python interpreter.');
    syncRunButton();
    return;
  }
  playTimer = setInterval(advancePlaybackTick, PLAY_MS);
  syncRunButton();
}

function renderTrace(data, opts) {
  startPlayback(data, opts);
}

function selectRow(i) {
  if (!trace) return;
  stopPlayback();
  playIndex = Math.max(0, Math.min(i, trace.rows.length - 1));
  selected = playIndex;
  paintTrace();
}

function assignmentLine(source, name) {
  const i = lineIndexForAssignment(source, name);
  if (i < 0) return name;
  return source.split('\n')[i].trim() || name;
}

function assignmentRhs(source, name) {
  const line = assignmentLine(source, name);
  const eq = line.indexOf('=');
  return eq < 0 ? line : line.slice(eq + 1).trim();
}

/** Map a program line to the C-RASP command kinds from §02. */
function describeCommands(name) {
  const source = lastRequest?.source || currentProgramSource();
  const rhs = assignmentRhs(source, name);
  if (!rhs) {
    return `${name}: could not find this assignment in the program text.`;
  }
  const parts = [];
  if (/#/.test(rhs)) parts.push('prefix count (#)');
  if (/"[^"]*"/.test(rhs)) parts.push('input marker');
  if (/\bif\b/.test(rhs)) parts.push('conditional');
  if (/\bmin\s*\(/.test(rhs)) parts.push('min');
  if (/\bmax\s*\(/.test(rhs)) parts.push('max');
  if (/(<=|>=|==|!=|<|>)/.test(rhs)) parts.push('count comparison');
  if (/&&/.test(rhs)) parts.push('conjunction (and)');
  if (/\|\|/.test(rhs)) parts.push('disjunction (or)');
  if (/!(?!=)/.test(rhs)) parts.push('negation');
  if (/\+/.test(rhs)) parts.push('addition');
  if (/(?<![<>=!])-(?!>)/.test(rhs)) parts.push('subtraction');
  if (/^\d+$/.test(rhs) || /^(true|false)$/i.test(rhs)) parts.push('constant');
  const uniq = [...new Set(parts)];
  if (!uniq.length) {
    return `${name} = ${rhs} — combines earlier vectors with the allowed Boolean / count operations.`;
  }
  return `${name} uses: ${uniq.join(' · ')} — same command kinds as in “What is C-RASP.”`;
}

function updateCommandLink(name) {
  const el = $('command-link');
  if (!name) {
    el.textContent = 'After Run, the active line is highlighted above and this note names the C-RASP command behind it.';
    return;
  }
  el.textContent = describeCommands(name);
}

$('prev-row').onclick = () => selectRow(playIndex - 1);
$('next-row').onclick = () => {
  stopPlayback();
  selectRow(playIndex + 1);
};
$('replay-trace').onclick = () => {
  if (!trace) return;
  startPlayback(trace, {animate: true});
};
$('skip-trace').onclick = () => {
  if (!trace) return;
  stopPlayback();
  playIndex = trace.rows.length - 1;
  paintTrace();
  status('Evaluated by the pinned Python interpreter.');
};
$('run').onclick = () => {
  // Pause animation or cancel an in-flight interpreter run
  if (playTimer) {
    stopPlayback();
    status('Paused — press play to resume from this step.');
    return;
  }
  if (running) {
    stop();
    status('Interpreter run cancelled.');
    return;
  }
  // Resume paused playback without re-running the interpreter
  if (canResumePlayback()) {
    resumePlayback();
    return;
  }
  // Replay finished trace from the start (same program/input)
  if (trace && inputUnchanged() && playIndex >= trace.rows.length - 1) {
    startPlayback(trace, {animate: true, fromIndex: 0});
    return;
  }

  let request;
  try {
    setProgramEditing(false);
    setTokensEditing(false);
    request = {source: currentProgramSource(), tokens: tokenize($('tokens').value)};
    if (request.source.length > 12000) throw new Error('Program is limited to 12,000 characters.');
  } catch (e) {
    status(e.message, true);
    return;
  }
  running = true;
  syncRunButton();
  $('download-trace').disabled = true;
  status('Starting interpreter…');
  worker ??= new Worker('runtime/python-worker.js');
  timer = setTimeout(() => {
    stop();
    status('Stopped after 90 seconds. The first run needs internet access to load Python and the interpreter. You can retry.', true);
  }, 90000);
  worker.onmessage = ({data}) => {
    if (data.status) status(data.status);
    if (data.result || data.error) {
      clearTimeout(timer);
      running = false;
      if (data.error) {
        syncRunButton();
        status(data.error, true);
        worker.terminate();
        worker = undefined;
      } else {
        lastRequest = request;
        lastRequest.tokens = request.tokens;
        renderTrace(data.result);
        if ($('program').value !== request.source || $('tokens').value !== request.inputText) markStale();
      }
    }
  };
  worker.onerror = e => {
    stop();
    status(`Interpreter could not start: ${e.message}`, true);
  };
  request.inputText = $('tokens').value;
  worker.postMessage(request);
};
syncRunButton();
$('program').oninput = markStale;
$('tokens').oninput = markStale;
function reset() {
  stop();
  const e = examples[$('example').value];
  $('tokens').value = e.tokens;
  $('program').value = e.source;
  builderLines = [];
  setProgramEditing(false);
  setTokensEditing(false);
  markStale();
  $('command-link').textContent = 'Example restored. Run to step through each line and see which C-RASP commands it uses.';
}
$('example').onchange = reset;
$('reset').onclick = reset;
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download-trace').onclick = () => {
  if (!trace || !lastRequest) return;
  download('crasp-trace.json', {
    ...trace,
    program: lastRequest.source,
    interpreter_commit: '1e821d7279015ce0e77830faa7932575447c5164',
  });
};

$('download-trace').disabled = true;
$('prev-row').disabled = true;
$('next-row').disabled = true;
$('replay-trace').disabled = true;
$('skip-trace').disabled = true;
$('row-label').textContent = '—';
status('');
$('command-link').textContent = '';
$('acceptance-note').textContent = '';
$('result').textContent = '';
$('result').className = 'result';
showTraceUI(false);
if (location.hash.startsWith('#program=')) {
  try {
    const shared = JSON.parse(decodeURIComponent(location.hash.slice(9)));
    if (typeof shared.source !== 'string' || typeof shared.tokens !== 'string' || shared.source.length > 12000 || shared.tokens.length > 10000) {
      throw new Error('Invalid shared program.');
    }
    $('program').value = shared.source;
    $('tokens').value = shared.tokens;
    setProgramEditing(false);
    markStale();
    openSection('playground');
  } catch (e) {
    status(`Could not load shared program: ${e.message}`, true);
  }
} else {
  // Load tokens + program from the preselected example
  const e = examples[$('example').value] || examples.dyck;
  $('tokens').value = e.tokens;
  $('program').value = e.source;
  setTokensEditing(false);
  setProgramEditing(false);
  renderExecProgram(null);
}

