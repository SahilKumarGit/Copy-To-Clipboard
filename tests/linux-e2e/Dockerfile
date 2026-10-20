# Ubuntu desktop mock-up for testing Ctrl+Shift+V auto-paste end to end on Linux (X11).
# Build from the repo root:  docker build -f tests/linux-e2e/Dockerfile -t clipboard-e2e .
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive

# X server + window manager + a Tk text box as the paste target + Electron runtime libraries.
# xdotool is installed under /opt/driver only, so the test controls whether the app can see it.
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb openbox xclip x11-utils imagemagick python3 python3-tk dbus-x11 \
      nodejs npm ca-certificates fonts-dejavu-core \
      libgtk-3-0t64 libnss3 libasound2t64 libgbm1 libxss1 libxtst6 libxshmfence1 libdrm2 \
      xdotool \
    && mkdir -p /opt/driver && mv /usr/bin/xdotool /opt/driver/xdotool \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error
COPY src ./src
COPY ui ./ui
COPY tests/linux-e2e/paste_target.py tests/linux-e2e/run.sh /opt/e2e/
RUN chmod +x /opt/e2e/run.sh
CMD ["/opt/e2e/run.sh"]
