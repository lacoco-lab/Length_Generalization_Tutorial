"""Differential check: browser block semantics versus the pinned Python interpreter.
Usage: python scripts/check_notebook_interpreter.py /path/to/c-rasp /path/to/node
No network or training is performed by this script.
"""
import json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / 'site/runtime'), str(pathlib.Path(sys.argv[1]).resolve())]
from bridge import run_trace
js = '''
import {DYCK,CONTAINS,TYPES,compile} from './site/assets/notebook-model.js';
import {evaluateBlocks} from './site/assets/notebook-engine.js';
const variants=[[],CONTAINS,DYCK];
let seed=42;
function pick(xs){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return xs[seed%xs.length];}
// Typed random programs exercise every primitive and combinations of operations.
for(let k=0;k<60;k++){
 const nodes=structuredClone(CONTAINS);
 for(let j=0;j<9;j++){
  const bools=nodes.filter(n=>TYPES[n.kind]==='bool').map(n=>n.id);
  const nums=['0',...nodes.filter(n=>TYPES[n.kind]==='int').map(n=>n.id)];
  const kind=pick(['token','tokenCount','and','or','not','add','compare','count']);
  const choices=['add','compare'].includes(kind)?nums:bools;
  nodes.push({id:'Extra'+j,kind,left:pick(choices),right:pick(choices),input:pick(bools),op:pick(['<','<=','==','>=','>']),token:pick(['a','b','(',')'])});
 }
 variants.push(nodes);
}
const cases=[];
function add(nodes,tokens){const output=nodes.filter(n=>TYPES[n.kind]==='bool').at(-1)?.id;cases.push({source:compile(nodes,output),tokens,expected:evaluateBlocks(nodes,tokens,output)});}
for(const nodes of variants)for(const tokens of [['a'],['b','a','b'],[...'()(())']])add(nodes,tokens);
for(let n=1;n<=7;n++)for(let mask=0;mask<2**n;mask++)add(DYCK,Array.from({length:n},(_,i)=>(mask>>i)&1?'(':')'));
console.log(JSON.stringify(cases));
'''
cases=json.loads(subprocess.check_output([sys.argv[2],'--input-type=module','-e',js],cwd=root,text=True))
for case in cases:
    actual=run_trace(case['source'],case['tokens'])
    expected=case['expected']
    for key in ['tokens','rows','accepted','index_base']:
        assert actual[key]==expected[key],(key,case['source'],case['tokens'],actual[key],expected[key])
print(f'{len(cases)} complete traces match Python, including randomized typed programs and all 254 parenthesis inputs through length 7.')
