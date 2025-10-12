#!/usr/bin/env bash
set -euo pipefail

python_executable=${PYTHON:-python3}

if [ ! -d .venv ]; then
  echo "Creating project virtual environment"
  "${python_executable}" -m venv .venv
fi

source .venv/bin/activate

python -m pip install --upgrade pip

if [ -f requirements.txt ]; then
  python -m pip install -r requirements.txt
fi
