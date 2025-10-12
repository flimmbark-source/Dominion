#!/usr/bin/env bash
set -euo pipefail

if ! dpkg -s xvfb >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y xvfb
fi

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
