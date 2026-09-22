#!/bin/bash
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
exec "${AUTONOMY_PYTHON:-/Library/Frameworks/Python.framework/Versions/3.14/bin/python3}" "$REPO/scripts/autonomy_supervisor.py" health --repo "$REPO" "$@"
