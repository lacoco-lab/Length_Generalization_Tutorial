# One tutorial, two export modes

**`manuscript.typ` is the only article source. Edit that file for both exports.**
There are no separate PDF and HTML copies of the prose. The small entry-point
files supply layout or metadata and include the same manuscript:

```text
manuscript.typ
  ├── ../draft_2.typ       → PDF layout → draft_2.pdf
  └── content/index.typ   → Tola HTML layout → public/index.html
```

- `../draft_2.typ`: PDF entry point, numbered headings, contents, page numbers,
  and every detailed explanation fully visible.
- `content/index.typ` and `site/page.typ`: Tola HTML entry point and blog layout.
  Detailed explanations are initially collapsed. Each can be toggled individually;
  the top buttons expand or collapse all of them. These use native HTML `details`
  elements, so individual toggles also work without JavaScript.
- `components.typ`: the `details[Title][Content]` helper and the interaction slot.
  To add another optional explanation, wrap an existing passage with that helper.

From the repository root:

```sh
./build_tutorial.sh pdf       # writes draft_2.pdf
./build_tutorial.sh html      # writes tutorial_dual/public/index.html + assets
./build_tutorial.sh both      # default: build both
./build_tutorial.sh check     # Tola's full compilation and reference checks
./build_tutorial.sh preview   # prints a local URL and rebuilds on edits; Ctrl-C stops
```

The build script uses the workspace-local tools downloaded for this prototype,
then falls back to tools on PATH. Override them with `TYPST_BIN` and `TOLA_BIN`.
Verified with **Typst 0.15.1** and **Tola 0.8.1**. Tola embeds its own compiler;
Typst CLI is only needed for the PDF. There are no external Typst package imports
in this new version. Keep `tola.toml` and the `@tola` imports with Tola 0.8.x;
the older 0.7-era README examples use a different configuration API.

To view a built site without the development watcher:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory tutorial_dual/public
```

Open http://127.0.0.1:8000/. Use HTTP for the blog: opening an HTML file directly
from the filesystem prevents JavaScript modules from loading in many browsers.
The complete `public/` directory is the static blog export; keep its assets with it.
No hosting or deployment is configured.

## Where the interaction belongs

The original notebook is embedded immediately after the worked Dyck-1 recognizer
and the `())(` counterexample, before the complete operation reference. It contains
the walkthrough, block builder, repair exercise, token sandbox, and value prediction.
The parent page hides the notebook's duplicate introduction and resizes its frame.
The standalone notebook and source attribution remain linked below it.

The PDF replaces this slot with a written exercise; it does not show an empty frame
or HTML controls. The derivation and all detailed explanations remain in the PDF.

The prose uses positions 1 through n; the existing notebook uses zero-based labels.
This difference is stated beside the embed. In the token sandbox, remove the last
two tokens of `()(())` and flip position 2 to obtain `())(`. The first invalid prefix
is position 2 in the notebook, corresponding to position 3 in the prose.

The notebook assets are vendored locally under `static/web-assets/interactive/`;
see `UPSTREAM.md` for provenance. Its core notebook works without network access.
The optional upstream Python text editor downloads its runtime separately.

## Checks

The PDF was compiled and its rendered layout inspected. The Tola build and full
site check pass. Browser checks cover opening and closing the detail sections,
notebook execution on a balanced input, and rejection of the equal-count counterexample.
Existing upstream tests cover typing/dependencies and inclusive prefix evaluation.

```sh
# Use Node >= 20 (or the workspace-local Node binary).
node --test tutorial_dual/tests/*.test.mjs
```

The examples have been organized: the examples progress from block order
to equal blocks and balanced prefixes; compilation details are split into four folds;
and the length-generalization section separates the setup, learner, theorem, and
consequences.
