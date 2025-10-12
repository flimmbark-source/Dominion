# Dominion Codespace Setup

This repository now includes a ready-to-use [GitHub Codespaces](https://github.com/features/codespaces) environment for running the `grimm_dominion_vertical_slice_pygame.py` prototype.

## Getting Started

1. Open the repository in a Codespace. The devcontainer automatically:
   - installs system dependencies (including `xvfb`),
   - creates a project-local virtual environment at `.venv`, and
   - installs the Python requirements defined in `requirements.txt`.

2. Once the Codespace has finished provisioning, launch the vertical slice using:

   ```bash
   ./scripts/run_vertical_slice.sh
   ```

   By default the script uses SDL's `dummy` video and audio drivers so it can run headlessly inside Codespaces. If you connect a graphical display (for example via VS Code's `Codespaces: Forward Port` feature) you can set different drivers before executing the script:

   ```bash
   export SDL_VIDEODRIVER=x11
   export SDL_AUDIODRIVER=pulseaudio
   ./scripts/run_vertical_slice.sh
   ```

   When a real video driver is selected, the script automatically wraps the game with `xvfb-run` so that a virtual display is available.

## Updating Dependencies

Add new Python dependencies to `requirements.txt`. The next time the Codespace starts, the virtual environment will be recreated and the dependencies will be installed automatically.
