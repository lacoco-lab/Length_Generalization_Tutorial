"""Run against an explicitly supplied checkout; never downloads or trains anything."""
import itertools, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / 'site/runtime'), str(pathlib.Path(sys.argv[1]).resolve())]
from bridge import run_trace
source = 'C_open = # "("\nC_close = # ")"\nV = C_open < C_close\nCV = # V\nM = (CV == 0)\nB = (C_open == C_close)\nD = M && B'
def dyck(tokens):
    balance = 0
    for t in tokens:
        balance += 1 if t == '(' else -1
        if balance < 0: return False
    return balance == 0
for n in range(1, 8):
    for tokens in itertools.product('()', repeat=n):
        assert run_trace(source, list(tokens))['accepted'] == dyck(tokens)
expected = json.loads((root / 'site/data/default-trace.json').read_text())
assert run_trace(source, list('()(())')) == expected
for bad in ['', 'A = #', 'A = ???']:
    try: run_trace(bad, ['a'])
    except (ValueError, TypeError): pass
    else: raise AssertionError('Invalid program accepted')
print('254 parenthesis inputs match an independent Dyck recognizer; saved trace and malformed-input checks pass.')
