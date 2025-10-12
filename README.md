# Dominion Codespace Setup

This repository includes a ready-to-use [GitHub Codespaces](https://github.com/features/codespaces) environment for running the
`grimm_dominion_vertical_slice_pygame.py` prototype. The devcontainer pulls the official Python 3.11 image and bootstraps a
workspace-local virtual environment after the container is created.

## Getting Started

1. Open the repository in a Codespace. The post-create setup script automatically:
   - ensures the `xvfb` system dependency is installed,
   - creates (or reuses) a `.venv` virtual environment inside the workspace, and
   - installs the Python requirements defined in `requirements.txt`.

2. Once the Codespace has finished provisioning, launch the vertical slice using:

   ```bash
   ./scripts/run_vertical_slice.sh
   ```

   By default the script uses SDL's `dummy` video driver so it can run headlessly inside Codespaces. If you connect a graphical
   display (for example via VS Code's `Codespaces: Forward Port` feature) you can set a different driver before executing the script:

   ```bash
   export SDL_VIDEODRIVER=x11
   ./scripts/run_vertical_slice.sh
   ```

   When a real video driver is selected, the script automatically wraps the game with `xvfb-run` so that a virtual display is available.

   Outside of Codespaces, the script bootstraps a local virtual environment on first launch and installs the dependencies defined
   in `requirements.txt`.

## Updating Dependencies

Add new Python dependencies to `requirements.txt`. Restart the Codespace (or re-run `.devcontainer/postCreate.sh`) to reinstall them
inside the workspace virtual environment.
