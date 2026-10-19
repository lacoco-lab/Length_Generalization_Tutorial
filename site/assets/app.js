import {tokenize, validateEvaluations} from './lib.js';
const $ = id => document.getElementById(id);
const examples = {
  dyck: {tokens: '( ) ( ( ) )', source: 'C_open = # "("\nC_close = # ")"\nV = C_open < C_close\nCV = # V\nM = (CV == 0)\nB = (C_open == C_close)\nD = M && B'},
  anbn: {tokens: 'a a a b b b', source: 'A = # "a"\nB = # "b"\nBad = "a" && (B > 0)\nOther = !("a" || "b")\nErrors = #(Bad || Other)\nAccept = (A == B) && (Errors == 0) && (A > 0)'},
  previous: {tokens: 'b a b a', source: '#import pred\nC = #[pred] "a"\nPair = "b" && (C > 0)\nPairs = # Pair\nAccept = Pairs > 0'}
};
let trace, selected = 0, worker, timer, running = false, lastRequest;
function status(message, error = false) { $('engine-status').textContent = message; $('engine-status').classList.toggle('error', error); }
function stop() { worker?.terminate(); worker = undefined; clearTimeout(timer); running = false; $('run').disabled = false; $('stop').hidden = true; }
function markStale() { $('download-trace').disabled = true; $('result').textContent = 'Edits not evaluated'; status('The table shows the previous run. Run the interpreter to evaluate your edits.'); }
function renderTrace(data) {
  trace = data; selected = Math.min(selected, data.rows.length - 1);
  const table = $('trace'); table.replaceChildren();
  const caption = table.createCaption(); caption.textContent = 'Interpreter values by token position (zero-based)';
  const head = table.createTHead().insertRow();
  ['Assignment', ...data.tokens.map((t,i) => `${i}: ${t}`)].forEach(t => { const th = document.createElement('th'); th.textContent = t; head.append(th); });
  const body = table.createTBody();
  data.rows.forEach((row, ri) => {
    const tr = body.insertRow(); tr.dataset.row = ri;
    const th = document.createElement('th'); const b = document.createElement('button'); b.className = 'secondary'; b.textContent = row.name; b.onclick = () => selectRow(ri); th.append(b); tr.append(th);
    row.values.forEach((value, ci) => { const td = tr.insertCell(); td.textContent = typeof value === 'boolean' ? (value ? '✓' : '·') : value; td.tabIndex = 0;
      const inspect = () => { selectRow(ri); table.querySelectorAll('.active,.contributes').forEach(e=>e.classList.remove('active','contributes')); td.classList.add('active');
        // Only infer a contributor explanation for the named, unedited Dyck example.
        if (lastRequest?.source === examples.dyck.source && ['C_open','C_close'].includes(row.name)) {
          const token = row.name === 'C_open' ? '(' : ')';
          [...head.cells].forEach((cell,k) => { if (k > 0 && k - 1 <= ci && data.tokens[k-1] === token) cell.classList.add('contributes'); });
          $('cell-note').textContent = `${row.name}[${ci}] = ${value}: count “${token}” at positions 0 through ${ci}, inclusive. Highlighted column headings contribute.`;
        } else $('cell-note').textContent = `${row.name}[${ci}] = ${value}. This is the value returned by the Python interpreter.`;
      }; td.onclick=inspect; td.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect();}};
    });
  });
  selectRow(selected);
  $('result').textContent = data.accepted ? 'Accepted' : 'Rejected'; $('result').className = `result ${data.accepted ? 'accepted' : 'rejected'}`;
  $('download-trace').disabled = false;
}
function selectRow(i) { if (!trace) return; selected = Math.max(0,Math.min(i,trace.rows.length-1)); $('trace').querySelectorAll('[data-row]').forEach(tr=>tr.classList.toggle('selected',+tr.dataset.row===selected)); $('row-label').textContent = `${selected+1} / ${trace.rows.length} · ${trace.rows[selected].name}`; $('prev-row').disabled = selected===0; $('next-row').disabled=selected===trace.rows.length-1; }
$('prev-row').onclick=()=>selectRow(selected-1); $('next-row').onclick=()=>selectRow(selected+1);
$('run').onclick=()=>{
  if (running) return;
  let request; try { request={source:$('program').value,tokens:tokenize($('tokens').value)}; if(request.source.length>12000) throw new Error('Program is limited to 12,000 characters.'); } catch(e){status(e.message,true);return;}
  running=true; $('run').disabled=true; $('stop').hidden=false; $('download-trace').disabled=true; status('Starting interpreter…');
  worker ??= new Worker('runtime/python-worker.js');
  timer=setTimeout(()=>{stop();status('Stopped after 90 seconds. The first run needs internet access to load Python and the interpreter. You can retry.',true);},90000);
  worker.onmessage=({data})=>{
    if(data.status) status(data.status);
    if(data.result || data.error){clearTimeout(timer);running=false;$('run').disabled=false;$('stop').hidden=true;
      if(data.error){status(data.error,true);worker.terminate();worker=undefined;}
      else{lastRequest=request;renderTrace(data.result);status('Evaluated by the pinned Python interpreter.'); if($('program').value!==request.source || $('tokens').value!==request.inputText) markStale();}
    }
  };
  worker.onerror=e=>{stop();status(`Interpreter could not start: ${e.message}`,true);};
  request.inputText = $('tokens').value; worker.postMessage(request);
};
$('stop').onclick=()=>{stop();status('Execution stopped.');};
$('program').oninput=markStale; $('tokens').oninput=markStale;
function reset(){stop();const e=examples[$('example').value];$('tokens').value=e.tokens;$('program').value=e.source;markStale();}
$('example').onchange=reset; $('reset').onclick=reset;
function download(name, data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-trace').onclick=()=>download('crasp-trace.json',{...trace,program:lastRequest.source,interpreter_commit:'1e821d7279015ce0e77830faa7932575447c5164'});
$('share').onclick=async()=>{const url=new URL(location.href);url.hash='program='+encodeURIComponent(JSON.stringify({source:$('program').value,tokens:$('tokens').value}));try{await navigator.clipboard.writeText(url.href);status('Program link copied. Shared links do not execute automatically.');}catch{history.replaceState(null,'',url);status('Program saved in the address bar. Copy the URL to share it.');}};
function tokenElement(label, cls=''){const el=document.createElement('span');el.className=`token ${cls}`;el.textContent=label;return el;}
function attention(){const n=+$('prefix').value,tokens=['(',')','(','(',')',')'];$('prefix-label').textContent=n;const strip=$('attention-tokens');strip.replaceChildren(tokenElement('BOS','visible'));tokens.forEach((t,i)=>strip.append(tokenElement(t,i<n?'visible':'')));const count=tokens.slice(0,n).filter(t=>t==='(').length;$('attention-equation').textContent=`Opening count: ${count}/${n+1}     ·     Encoded 1: 1/${n+1}`;}
$('prefix').oninput=attention;attention();
function positions(){const i=+$('query').value,kind=$('relation').value;$('query-label').textContent=i;const strip=$('position-tokens');strip.replaceChildren();for(let j=0;j<12;j++){const match=j<=i&&(kind==='previous'?j===i-1:kind==='even'?(i-j)%2===0:j===0);strip.append(tokenElement(`${j}${j===i?' ↓':''}`,match?'match':''));}$('relation-description').textContent=kind==='previous'?'j = i − 1: local (distance 1) and translation-invariant. At query 0 there is no preceding token.':kind==='even'?'i − j is even: translation-invariant, but not local—matching keys can be arbitrarily far away. This is a binary relation, unlike the periodic unary predicate “position is even”.':'j = 0: selects the start of the sequence. Shifting both positions changes the relation; it is not translation-invariant. Only keys in the causal prefix are shown as selected.';}
$('query').oninput=positions;$('relation').onchange=positions;positions();
const figureLabels={main:'Figure 1: main comparison across tasks and formal languages.',languages:'Figure 2: named formal languages and their generalization results.'};
document.querySelectorAll('[data-figure]').forEach(b=>b.onclick=()=>{const k=b.dataset.figure;$('paper-figure').src=`assets/paper-${k}.svg`;$('figure-link').href=`assets/paper-${k}.svg`;$('paper-figure').alt=`Huang et al. (2025), ${figureLabels[k]} See the original paper for the full caption.`;$('paper-caption').textContent=`Huang et al. (2025), ${figureLabels[k]} Published experiment results; not new runs. Open the image for full detail.`;document.querySelectorAll('[data-figure]').forEach(x=>x.classList.toggle('secondary',x!==b));});
let evaluations={schema_version:1,runs:[]};
const NS='http://www.w3.org/2000/svg';
function svg(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function showRun(){const r=evaluations.runs[$('run-select').value];if(!r)return;const points=[...r.points].sort((a,b)=>a.length-b.length),max=Math.max(r.train_max_length,r.selection_max_length||0,...points.map(p=>p.length));const x=n=>60+n/max*670,y=n=>290-n*240;const chart=$('evaluation-plot');chart.replaceChildren(svg('title',{},`${r.task}: ${r.model}, seed ${r.seed}`));chart.append(svg('rect',{x:60,y:50,width:x(r.train_max_length)-60,height:240,fill:'#e3eee7'}));if(r.selection_max_length>r.train_max_length)chart.append(svg('rect',{x:x(r.train_max_length),y:50,width:x(r.selection_max_length)-x(r.train_max_length),height:240,fill:'#f5e6ca'}));
  for(const a of [0,.25,.5,.75,1]){chart.append(svg('line',{x1:60,x2:730,y1:y(a),y2:y(a),stroke:'#d9ddd8'}),svg('text',{x:48,y:y(a)+4,'text-anchor':'end','font-size':12},`${100*a}%`));}
  for(const n of [...new Set([0,r.train_max_length,r.selection_max_length,max].filter(n=>n!==undefined))])chart.append(svg('text',{x:x(n),y:310,'text-anchor':'middle','font-size':12},n));
  chart.append(svg('polyline',{points:points.map(p=>`${x(p.length)},${y(p.correct/p.total)}`).join(' '),fill:'none',stroke:'#246d66','stroke-width':2}));for(const p of points){const c=svg('circle',{cx:x(p.length),cy:y(p.correct/p.total),r:4,fill:'#246d66'});c.append(svg('title',{},`Length ${p.length}: ${p.correct}/${p.total}`));chart.append(c);}chart.append(svg('text',{x:60,y:25,'font-size':13},'Green: training range · Sand: selection range (when supplied)'),svg('text',{x:390,y:340,'text-anchor':'middle','font-size':13},'Input length'));
  const meta=$('run-meta');meta.replaceChildren();for(const k of ['task','model','positional_encoding','seed','checkpoint','evaluated_at','source']){const p=document.createElement('p');p.textContent=`${k.replaceAll('_',' ')}: ${r[k]}`;meta.append(p);}const table=$('evaluation-table');table.replaceChildren();table.createCaption().textContent='Recorded sequence accuracy; no interpolation of missing evaluations';const h=table.createTHead().insertRow();['Length','Correct','Total','Accuracy'].forEach(t=>{const th=document.createElement('th');th.textContent=t;h.append(th);});const body=table.createTBody();points.forEach(p=>{const row=body.insertRow();[p.length,p.correct,p.total,`${(100*p.correct/p.total).toFixed(1)}%`].forEach(v=>row.insertCell().textContent=v);});}
function loadEvaluations(data){evaluations=validateEvaluations(data);const sel=$('run-select');sel.replaceChildren();data.runs.forEach((r,i)=>{const o=new Option(`${r.task} · ${r.model} · seed ${r.seed} · ${r.id}`,i);sel.add(o);});const empty=!data.runs.length;if(empty)sel.add(new Option('No saved runs supplied',''));sel.disabled=empty;$('export-data').disabled=empty;$('evaluation-empty').hidden=!empty;$('evaluation-view').hidden=empty;showRun();}
$('run-select').onchange=showRun;$('export-data').onclick=()=>download('evaluations.json',evaluations);
$('evaluation-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>10_000_000)throw new Error('Use a JSON file smaller than 10 MB.');loadEvaluations(JSON.parse(await f.text()));$('evaluation-status').textContent=`Loaded ${evaluations.runs.length} runs locally. Nothing was uploaded.`;}catch(err){$('evaluation-status').textContent=err.message;}};
try{const response=await fetch('data/default-trace.json');if(!response.ok)throw new Error('Saved trace unavailable.');lastRequest={source:examples.dyck.source,tokens:tokenize(examples.dyck.tokens)};renderTrace(await response.json());}catch(e){status(e.message,true);$('download-trace').disabled=true;}
try{const response=await fetch('data/evaluations.json');loadEvaluations(await response.json());}catch(e){$('evaluation-status').textContent=`Could not load saved evaluations: ${e.message}`;}
if(location.hash.startsWith('#program=')){try{const shared=JSON.parse(decodeURIComponent(location.hash.slice(9)));if(typeof shared.source!=='string'||typeof shared.tokens!=='string'||shared.source.length>12000||shared.tokens.length>10000)throw new Error('Invalid shared program.');$('program').value=shared.source;$('tokens').value=shared.tokens;markStale();$('playground').scrollIntoView();}catch(e){status(`Could not load shared program: ${e.message}`,true);}}
