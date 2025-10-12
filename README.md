# Dominion Codespace Setup

This repository includes a ready-to-use [GitHub Codespaces](https://github.com/features/codespaces) environment for running the `grimm_dominion_vertical_slice_pygame.py` prototype. The devcontainer image now preinstalls the required system and Python packages so new Codespaces start significantly faster.

## Getting Started

1. Open the repository in a Codespace. The devcontainer automatically:
   - provisions a lightweight Python 3.11 base image,
   - installs the minimal system dependency (`xvfb`) during image build,
   - pre-creates a reusable virtual environment at `/opt/venv` and links it to `${workspaceFolder}/.venv`, and
   - installs the Python requirements defined in `requirements.txt`.

2. Once the Codespace has finished provisioning, launch the vertical slice using:

   ```bash
   ./scripts/run_vertical_slice.sh
   ```

   By default the script uses SDL's `dummy` video driver so it can run headlessly inside Codespaces. If you connect a graphical display (for example via VS Code's `Codespaces: Forward Port` feature) you can set a different driver before executing the script:

   ```bash
   export SDL_VIDEODRIVER=x11
   ./scripts/run_vertical_slice.sh
   ```

   When a real video driver is selected, the script automatically wraps the game with `xvfb-run` so that a virtual display is available.

## Updating Dependencies

Add new Python dependencies to `requirements.txt`. Rebuild the devcontainer (or restart the Codespace) to bake the updates into `/opt/venv`.
