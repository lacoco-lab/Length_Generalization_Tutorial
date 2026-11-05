#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

# Prefer explicit overrides, then tools on PATH, then workspace-local binaries.
# Searching parents also supports a checkout nested below the workspace's .tools/.
resolve_tool() {
  tool_name=$1
  tool_override=$2
  if [ -n "$tool_override" ]; then
    if command -v "$tool_override" >/dev/null 2>&1; then
      command -v "$tool_override"
      return
    fi
    echo "Cannot execute $tool_name override: $tool_override" >&2
    return 1
  fi
  if command -v "$tool_name" >/dev/null 2>&1; then
    command -v "$tool_name"
    return
  fi
  tool_dir=$ROOT
  while :; do
    for tool_candidate in "$tool_dir/.tools/$tool_name" "$tool_dir"/.tools/"$tool_name"-*/"$tool_name"; do
      if [ -x "$tool_candidate" ] && [ ! -d "$tool_candidate" ]; then
        echo "$tool_candidate"
        return
      fi
    done
    [ "$tool_dir" != / ] || break
    tool_dir=$(dirname -- "$tool_dir")
  done
  echo "Cannot find $tool_name. Install it on PATH or set its binary path with TYPST_BIN / TOLA_BIN." >&2
  return 1
}

build_pdf() {
  TUTORIAL_TYPST=$(resolve_tool typst "${TYPST_BIN:-}")
  "$TUTORIAL_TYPST" compile draft_2.typ draft_2.pdf
}
run_tola() {
  TUTORIAL_TOLA=$(resolve_tool tola "${TOLA_BIN:-}")
  "$TUTORIAL_TOLA" "$@" -C tutorial_dual/tola.toml --offline
}
case "${1:-both}" in
  pdf) build_pdf ;;
  html) run_tola build ;;
  both) build_pdf; run_tola build ;;
  preview) run_tola dev ;;
  check) run_tola check ;;
  *) echo 'Usage: ./build_tutorial.sh [pdf|html|both|preview|check]' >&2; exit 2 ;;
esac
