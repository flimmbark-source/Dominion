#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${REPO_ROOT}/.venv"
PYTHON="${VENV_PATH}/bin/python"

if [[ ! -x "${PYTHON}" ]]; then
  echo "Creating local virtual environment at ${VENV_PATH}" >&2
  python3 -m venv "${VENV_PATH}"
  "${VENV_PATH}/bin/pip" install --upgrade pip
  "${VENV_PATH}/bin/pip" install -r "${REPO_ROOT}/requirements.txt"
fi

: "${SDL_VIDEODRIVER:=dummy}"
: "${SDL_AUDIODRIVER:=dummy}"
export SDL_VIDEODRIVER SDL_AUDIODRIVER

if [[ "${SDL_VIDEODRIVER}" == "dummy" ]]; then
  exec "${PYTHON}" "${REPO_ROOT}/grimm_dominion_vertical_slice_pygame.py"
else
  exec xvfb-run -a "${PYTHON}" "${REPO_ROOT}/grimm_dominion_vertical_slice_pygame.py"
fi
