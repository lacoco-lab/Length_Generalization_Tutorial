/* Runs the original Python interpreter in a disposable worker. */
let ready;
async function initialize() {
  postMessage({status: 'Loading Python (first run downloads the runtime)…'});
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
  const py = await loadPyodide();
  await py.loadPackage('micropip');
  await py.runPythonAsync("import micropip\nawait micropip.install('antlr4-python3-runtime==4.13.1')");
  const manifest = await (await fetch('../data/interpreter.json')).json();
  py.FS.mkdirTree('/crasp/antlr');
  for (const path of manifest.files) {
    const response = await fetch(`${manifest.raw_base}/${manifest.commit}/${path}`);
    if (!response.ok) throw new Error(`Could not load interpreter file ${path}: ${response.status}`);
    py.FS.writeFile(`/crasp/${path}`, await response.text());
  }
  const response = await fetch('bridge.py');
  if (!response.ok) throw new Error('Could not load interpreter adapter');
  py.FS.writeFile('/crasp/bridge.py', await response.text());
  await py.runPythonAsync("import sys\nsys.path.insert(0, '/crasp')\nfrom bridge import run_trace, check_program\nimport json");
  return py;
}
onmessage = async ({data}) => {
  try {
    ready ??= initialize();
    const py = await ready;
    py.globals.set('request_json', JSON.stringify(data));
    if (data.mode === 'check') {
      postMessage({status: 'Checking whether the program is well-formed…'});
      const result = await py.runPythonAsync(
        "request = json.loads(request_json)\njson.dumps(check_program(request['source'], request.get('tokens')))"
      );
      postMessage({check: JSON.parse(result)});
      return;
    }
    postMessage({status: 'Running the Python interpreter…'});
    const result = await py.runPythonAsync("request = json.loads(request_json)\njson.dumps(run_trace(request['source'], request['tokens']))");
    postMessage({result: JSON.parse(result)});
  } catch (error) {
    postMessage({error: String(error.message || error)});
  }
};
