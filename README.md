# Length Generalization in Transformers

This directory is the current Git working copy. Edit **`tutorial_dual/manuscript.typ`** for article content; it supplies both the PDF and HTML editions.

## Current files

| Path | Purpose |
| --- | --- |
| `tutorial_dual/manuscript.typ` | Single source for the article text |
| `tutorial_dual/components.typ` | Shared layout and interactive helpers |
| `draft_2.typ` | PDF layout; includes the manuscript |
| `draft_2.pdf` | Current generated PDF |
| `tutorial_dual/public/` | Current generated HTML site |
| `site/` | Standalone interactive companion and drag-and-drop editor |
| `.tools/` | Local Typst, Tola and Node binaries and downloads |
| `archive/` | Older drafts, snapshots and previous preview artifacts; not used by builds |

## Build and preview

Run from this directory:

```sh
./build_tutorial.sh both     # rebuild PDF and HTML
./build_tutorial.sh check    # validate the HTML build
./build_tutorial.sh preview  # serve the current article with live rebuilding
```

See [the article build guide](tutorial_dual/README.md) for details. The standalone editor has its own [companion documentation](docs/interactive-companion.md); its HTML is not the article source. `npm run preview` serves that companion, while `./build_tutorial.sh preview` serves the current article.

## Older material

The consolidation snapshot is in `archive/2026-11-04-before-consolidation/`:

- `previous-top-level/`: older top-level drafts, manuscript, exports, figures and temporary PDF previews.
- `original-interactive-snapshot/`: original imported interactive tutorial.
- `repository-export-metadata/`: previous export metadata.
- `migration-record.json`: original checkout location, Git HEAD, change list and file hashes.

The former `.tools/repository-export/checkout/` was moved here with its Git history and uncommitted changes. It is no longer a working location. Archives are kept locally and excluded from Git by default.
