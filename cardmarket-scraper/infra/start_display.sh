#!/usr/bin/env bash
# start_display.sh — Virtuellen Display-Stack starten (idempotent).
# Startet Xvfb :1, x11vnc und noVNC/websockify.
# Wird per @reboot-Cron und bei Bedarf aus run_crawl.sh aufgerufen.
set -euo pipefail

DISPLAY_NUM=":1"
VNC_PASS_FILE="$HOME/.vnc/passwd"
VNC_PORT=5900
NOVNC_PORT=6080

echo "[display] Stoppe alte Prozesse..."
pkill -f "Xvfb $DISPLAY_NUM" 2>/dev/null || true
pkill -f "x11vnc.*rfbport $VNC_PORT" 2>/dev/null || true
pkill -f "websockify.*$NOVNC_PORT" 2>/dev/null || true
sleep 1

echo "[display] Starte Xvfb $DISPLAY_NUM (1280x1024x24)..."
Xvfb "$DISPLAY_NUM" -screen 0 1280x1024x24 &
sleep 1

echo "[display] Starte x11vnc auf Port $VNC_PORT..."
x11vnc \
    -display "$DISPLAY_NUM" \
    -rfbauth "$VNC_PASS_FILE" \
    -rfbport "$VNC_PORT" \
    -forever -shared \
    -bg -o /tmp/x11vnc.log
sleep 1

echo "[display] Starte noVNC/websockify auf Port $NOVNC_PORT..."
websockify --daemon \
    --web /usr/share/novnc \
    "$NOVNC_PORT" "localhost:$VNC_PORT"

echo "[display] ✅ Display-Stack läuft."
echo "  noVNC erreichbar unter: http://<VPS-IP>:$NOVNC_PORT/vnc.html"
