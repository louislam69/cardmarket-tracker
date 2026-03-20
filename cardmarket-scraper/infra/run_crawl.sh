#!/usr/bin/env bash
# run_crawl.sh — Tägliches Cron-Script für den Cardmarket-Scraper.
# Läuft als User 'crawl', alle 2 Tage 07:00 via crontab.
#
# Ablauf:
#   1. .env laden + Account rotieren (A → B → C → A …)
#   2. Xvfb prüfen / starten
#   3. git pull
#   4. Telegram: Crawl gestartet
#   5. Warm-up: Browser öffnen, 4 zufällige Warm-up-URLs besuchen, Session speichern
#   6. tmux-Session: Scraper starten
#   7. Auf Scraper warten (max 2h)
#   8. CSVs in Railway PostgreSQL importieren
#   9. Telegram: Erfolg oder Fehler
set -uo pipefail

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
mkdir -p "$HOME/logs"
LOG_FILE="$HOME/logs/crawl_${TIMESTAMP}.log"

# Alles in Logdatei + stdout schreiben
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== Crawl gestartet: $TIMESTAMP ==="

# --- .env laden ---
ENV_FILE="$HOME/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
else
    echo "❌ .env nicht gefunden: $ENV_FILE"
    exit 1
fi

export DISPLAY=:1
REPO_DIR="${REPO_DIR:-/home/crawl/cardmarket-projekt}"
SCRAPER_DIR="$REPO_DIR/cardmarket-scraper"
BACKEND_DIR="$REPO_DIR/cardmarket-backend"
SCRAPER_VENV="$SCRAPER_DIR/.venv"
BACKEND_VENV="$BACKEND_DIR/.venv"
INFRA_DIR="$SCRAPER_DIR/infra"
DONE_FLAG="/tmp/scraper_done_flag_$$"
TMUX_SESSION="crawl_session"
MAX_WAIT_S=7200   # 2 Stunden Timeout

# --- Hilfsfunktion: Telegram ---
telegram_send() {
    local msg="$1"
    if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${msg}" \
            -d "parse_mode=HTML" \
            --max-time 10 >/dev/null || true
    fi
}

# --- [1/8] Account rotieren ---
echo "[1/8] Account rotieren..."
ACCOUNT_INDEX_FILE="$HOME/.account_index"
if [ -f "$ACCOUNT_INDEX_FILE" ]; then
    ACCOUNT_IDX=$(cat "$ACCOUNT_INDEX_FILE")
else
    ACCOUNT_IDX=0
fi

# Sicherstellen, dass der Wert 0/1/2 ist
case "$ACCOUNT_IDX" in
    0|1|2) ;;
    *) ACCOUNT_IDX=0 ;;
esac

case "$ACCOUNT_IDX" in
    0) STORAGE_STATE="$SCRAPER_DIR/storage_state_a.json" ; ACCOUNT_LABEL="Account A"
       CM_USER="${CM_ACCOUNT_A_USER:-}" ; CM_PASS="${CM_ACCOUNT_A_PASS:-}" ;;
    1) STORAGE_STATE="$SCRAPER_DIR/storage_state_b.json" ; ACCOUNT_LABEL="Account B"
       CM_USER="${CM_ACCOUNT_B_USER:-}" ; CM_PASS="${CM_ACCOUNT_B_PASS:-}" ;;
    2) STORAGE_STATE="$SCRAPER_DIR/storage_state_c.json" ; ACCOUNT_LABEL="Account C"
       CM_USER="${CM_ACCOUNT_C_USER:-}" ; CM_PASS="${CM_ACCOUNT_C_PASS:-}" ;;
esac

NEXT_IDX=$(( (ACCOUNT_IDX + 1) % 3 ))
echo "$NEXT_IDX" > "$ACCOUNT_INDEX_FILE"
echo "  Verwende: $ACCOUNT_LABEL ($STORAGE_STATE)"
echo "  Nächster Lauf: Account-Index $NEXT_IDX"

if [ -z "$CM_USER" ] || [ -z "$CM_PASS" ]; then
    echo "❌ Credentials fehlen für $ACCOUNT_LABEL"
    echo "   Bitte CM_ACCOUNT_A_USER/PASS (bzw. B/C) in ~/.env eintragen."
    telegram_send "❌ <b>Crawl abgebrochen</b>
Credentials fehlen für $ACCOUNT_LABEL.
Bitte ~/.env auf dem VPS ergänzen."
    exit 1
fi

# --- [2/8] Xvfb prüfen ---
echo "[2/8] Prüfe Xvfb..."
if ! pgrep -f "Xvfb :1" > /dev/null; then
    echo "  Xvfb nicht aktiv — starte Display-Stack..."
    bash "$INFRA_DIR/start_display.sh"
    sleep 3
else
    echo "  Xvfb läuft bereits."
fi

# --- [3/8] git pull ---
echo "[3/8] git pull..."
cd "$REPO_DIR"
git pull origin main || echo "  ⚠️  git pull fehlgeschlagen (weiter mit lokalem Stand)"

# --- [4/8] Telegram: Start ---
echo "[4/8] Telegram: Crawl gestartet"
telegram_send "🕷️ <b>Cardmarket Crawl gestartet</b>
Zeitpunkt: $TIMESTAMP
Account: $ACCOUNT_LABEL
noVNC: http://${VPS_IP:-VPS-IP}:6080/vnc.html

Falls Captcha erscheint:
1. noVNC öffnen
2. <code>tmux attach -t $TMUX_SESSION</code>
3. ENTER drücken sobald gelöst"

# --- [5/8] Login + Warm-up: einloggen, Cookies festigen ---
echo "[5/8] Login + Warm-up für $ACCOUNT_LABEL..."
LOGIN_LOG="$HOME/logs/login_${TIMESTAMP}.log"

CM_USER="$CM_USER" CM_PASS="$CM_PASS" \
"$SCRAPER_VENV/bin/python" "$SCRAPER_DIR/scrape_cardmarket.py" \
    --login \
    --storage "$STORAGE_STATE" \
    --warmup-urls "$SCRAPER_DIR/warmup_urls.txt" \
    --warmup-count 4 \
    > "$LOGIN_LOG" 2>&1

LOGIN_EXIT=$?
if [ "$LOGIN_EXIT" -ne 0 ]; then
    echo "  ⚠️  Login fehlgeschlagen (exit $LOGIN_EXIT) — crawle trotzdem weiter"
    telegram_send "⚠️ <b>Login fehlgeschlagen</b> ($ACCOUNT_LABEL, exit $LOGIN_EXIT) — Crawl läuft trotzdem weiter."
else
    echo "  ✅ Login + Warm-up abgeschlossen."
fi

# --- [6/8] Scraper in tmux starten ---
echo "[6/8] Starte tmux-Session '$TMUX_SESSION'..."
rm -f "$DONE_FLAG"

# Alte Session beenden falls vorhanden
tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true

# Scraper in neuer tmux-Session starten; Exit-Code in DONE_FLAG schreiben
SCRAPER_LOG="$HOME/logs/scraper_${TIMESTAMP}.log"
tmux new-session -d -s "$TMUX_SESSION" \
    "DISPLAY=:1 '$SCRAPER_VENV/bin/python' '$SCRAPER_DIR/scrape_cardmarket.py' --storage '$STORAGE_STATE' --urls '$SCRAPER_DIR/urls.txt' > '$SCRAPER_LOG' 2>&1; echo \$? > '$DONE_FLAG'"

echo "  tmux-Session '$TMUX_SESSION' läuft."
echo "  Ankoppeln: tmux attach -t $TMUX_SESSION"

# --- [7/8] Auf Scraper warten ---
echo "[7/8] Warte auf Scraper (max ${MAX_WAIT_S}s)..."
WAITED=0
while [ ! -f "$DONE_FLAG" ]; do
    sleep 30
    WAITED=$((WAITED + 30))
    echo "  ... ${WAITED}s gewartet"
    if [ "$WAITED" -ge "$MAX_WAIT_S" ]; then
        echo "❌ Timeout nach ${MAX_WAIT_S}s!"
        telegram_send "❌ <b>Crawl Timeout</b> nach $((MAX_WAIT_S / 60)) Minuten ($ACCOUNT_LABEL) — bitte Server prüfen.
Log: $LOG_FILE"
        exit 1
    fi
done

SCRAPER_EXIT=$(cat "$DONE_FLAG")
rm -f "$DONE_FLAG"
echo "  Scraper beendet mit Exit-Code: $SCRAPER_EXIT"

if [ "$SCRAPER_EXIT" != "0" ]; then
    echo "❌ Scraper fehlgeschlagen (exit $SCRAPER_EXIT)"
    telegram_send "❌ <b>Scraper fehlgeschlagen</b> ($ACCOUNT_LABEL, exit $SCRAPER_EXIT)
Log: $LOG_FILE"
    exit 1
fi

# --- [8/8] CSVs importieren ---
echo "[8/8] Importiere CSVs in Railway PostgreSQL..."
cd "$BACKEND_DIR"
DATABASE_URL="$DATABASE_URL" "$BACKEND_VENV/bin/python" import_csv_runs.py
IMPORT_EXIT=$?

if [ "$IMPORT_EXIT" -ne 0 ]; then
    echo "❌ CSV-Import fehlgeschlagen (exit $IMPORT_EXIT)"
    telegram_send "❌ <b>CSV-Import fehlgeschlagen</b> ($ACCOUNT_LABEL, exit $IMPORT_EXIT)
Log: $LOG_FILE"
    exit 1
fi

# --- Erfolg ---
telegram_send "✅ <b>Crawl erfolgreich abgeschlossen</b>
Zeitpunkt: $TIMESTAMP
Account: $ACCOUNT_LABEL
CSVs importiert → Railway PostgreSQL
Dashboard: https://cardmarket-frontend.up.railway.app"

echo "=== ✅ FERTIG: $(date +%Y-%m-%d_%H%M%S) ==="
