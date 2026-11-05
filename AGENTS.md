# Working on this tutorial

- Work in this repository root, not the former `.tools/repository-export/checkout/` location.
- Edit article prose only in `tutorial_dual/manuscript.typ`. Both PDF and HTML include this file.
- `draft_2.typ` controls PDF layout; `tutorial_dual/components.typ` contains shared helpers.
- Rebuild using `./build_tutorial.sh both`; validate using `./build_tutorial.sh check`.
- `site/` is the standalone interactive companion, not the current article prose.
- `archive/` contains historical copies. Do not edit or build them unless explicitly requested.
- Preserve existing uncommitted work.
