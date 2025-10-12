#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)
cd "$PROJECT_ROOT"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Error: python3 or python must be installed" >&2
  exit 1
fi

if [ ! -d ".venv" ]; then
  "$PYTHON_BIN" -m venv .venv
fi

if [ -d ".venv" ]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
  if ! python -c "import pygame" >/dev/null 2>&1; then
    python -m pip install --upgrade pip
    pip install -r requirements.txt
  fi
fi
DRIVER=${SDL_VIDEODRIVER:-dummy}
export SDL_VIDEODRIVER="$DRIVER"
if [ "$DRIVER" = "dummy" ]; then
  exec python grimm_dominion_vertical_slice_pygame.py
else
  exec xvfb-run -s "-screen 0 1280x720x24" python grimm_dominion_vertical_slice_pygame.py
fi
