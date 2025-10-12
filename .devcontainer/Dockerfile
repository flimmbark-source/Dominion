# File: .devcontainer/Dockerfile
# Fast, minimal base with Python already installed.
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# System deps for pygame(-ce) and fonts (SDL + basic X libs). Keep it lean.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    libgl1 libgles2 \
    libsdl2-2.0-0 libsdl2-image-2.0-0 libsdl2-mixer-2.0-0 libsdl2-ttf-2.0-0 \
    ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*

# App deps at build-time so the image opens ready-to-run.
WORKDIR /workspaces/app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source last to maximize layer cache (requirements rarely change).
COPY . .

# Environment defaults useful in containers
ENV PYTHONUNBUFFERED=1 \
    SDL_AUDIODRIVER=dummy

# (Optional) boot command (Codespaces can still override via tasks/commands)
CMD ["bash", "-lc", "echo Devcontainer ready. Run: make web  # or make run"]
