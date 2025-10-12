#!/usr/bin/env bash
set -euo pipefail

python_executable=${PYTHON:-python3}
venv_path=".venv"
requirements_file="requirements.txt"
requirements_hash_file="${venv_path}/.requirements-hash"

if [ ! -d "${venv_path}" ]; then
  echo "Creating project virtual environment"
  "${python_executable}" -m venv "${venv_path}"
fi

# shellcheck disable=SC1091
source "${venv_path}/bin/activate"

if [ -f "${requirements_file}" ]; then
  current_hash=$(sha256sum "${requirements_file}" | awk '{print $1}')
  previous_hash=""
  if [ -f "${requirements_hash_file}" ]; then
    previous_hash=$(<"${requirements_hash_file}")
  fi

  if [ "${current_hash}" != "${previous_hash}" ]; then
    echo "Installing Python dependencies"
    python -m pip install \
      --disable-pip-version-check \
      --prefer-binary \
      -r "${requirements_file}"
    printf '%s' "${current_hash}" > "${requirements_hash_file}"
  else
    echo "Python dependencies already installed"
  fi
fi
