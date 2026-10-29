#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
TUTORIAL_TYPST=${TYPST_BIN:-"$ROOT/.tools/typst-aarch64-apple-darwin/typst"}
TUTORIAL_TOLA=${TOLA_BIN:-"$ROOT/.tools/tola"}
if [ ! -x "$TUTORIAL_TYPST" ]; then TUTORIAL_TYPST=typst; fi
if [ ! -x "$TUTORIAL_TOLA" ]; then TUTORIAL_TOLA=tola; fi
case "${1:-both}" in
  pdf) "$TUTORIAL_TYPST" compile draft_2.typ draft_2.pdf ;;
  html) "$TUTORIAL_TOLA" build -C tutorial_dual/tola.toml --offline ;;
  both) "$TUTORIAL_TYPST" compile draft_2.typ draft_2.pdf
        "$TUTORIAL_TOLA" build -C tutorial_dual/tola.toml --offline ;;
  preview) exec "$TUTORIAL_TOLA" dev -C tutorial_dual/tola.toml --offline ;;
  check) "$TUTORIAL_TOLA" check -C tutorial_dual/tola.toml --offline ;;
  *) echo 'Usage: ./build_tutorial.sh [pdf|html|both|preview|check]' >&2; exit 2 ;;
esac
