#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)
cd "$PROJECT_ROOT"
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi
DRIVER=${SDL_VIDEODRIVER:-dummy}
export SDL_VIDEODRIVER="$DRIVER"
if [ "$DRIVER" = "dummy" ]; then
  exec python grimm_dominion_vertical_slice_pygame.py
else
  exec xvfb-run -s "-screen 0 1280x720x24" python grimm_dominion_vertical_slice_pygame.py
fi
