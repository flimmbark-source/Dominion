FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Python and minimal runtime dependencies for pygame
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-pip \
        python3-setuptools \
        python3-wheel \
        xvfb \
        libgl1 \
        libglu1-mesa \
        libsdl2-2.0-0 \
        libsdl2-image-2.0-0 \
        libsdl2-mixer-2.0-0 \
        libsdl2-ttf-2.0-0 \
        libportaudio2 \
    && rm -rf /var/lib/apt/lists/*

# Create a reusable virtual environment and pre-install dependencies
COPY requirements.txt /tmp/pip-tmp/
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r /tmp/pip-tmp/requirements.txt \
    && rm -rf /tmp/pip-tmp

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
