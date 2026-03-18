#!/usr/bin/env bash
# setup_vps.sh — Einmalig als root auf Ubuntu 24.04 ausführen.
# Setzt VPS für automatischen Cardmarket-Scraper auf.
#
# Verwendung:
#   git clone <REPO> /home/crawl/cardmarket-projekt
#   bash /home/crawl/cardmarket-projekt/cardmarket-scraper/infra/setup_vps.sh
set -euo pipefail

REPO_DIR="/home/crawl/cardmarket-projekt"
CRAWL_USER="crawl"

echo "=== [1/8] System-Pakete installieren ==="
apt-get update -qq
# Ubuntu 24.04: python3.12, libasound2t64 (statt libasound2)
apt-get install -y \
    xvfb x11vnc novnc websockify tmux \
    python3.12 python3.12-venv python3.12-dev \
    git curl wget \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2t64

echo "=== [2/8] User '$CRAWL_USER' anlegen ==="
if ! id "$CRAWL_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$CRAWL_USER"
    echo "  User '$CRAWL_USER' erstellt."
else
    echo "  User '$CRAWL_USER' existiert bereits."
fi

echo "=== [3/8] Repo klonen ==="
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "FEHLER: $REPO_DIR ist kein Git-Repo. Bitte zuerst klonen:"
    echo "  git clone <REPO_URL> $REPO_DIR"
    exit 1
fi
chown -R "$CRAWL_USER:$CRAWL_USER" "$REPO_DIR"
echo "  Repo-Eigentümer gesetzt: $CRAWL_USER"

echo "=== [4/8] Python venvs erstellen ==="
# Scraper venv
sudo -u "$CRAWL_USER" python3.12 -m venv "$REPO_DIR/cardmarket-scraper/.venv"
sudo -u "$CRAWL_USER" "$REPO_DIR/cardmarket-scraper/.venv/bin/pip" install -q --upgrade pip
sudo -u "$CRAWL_USER" "$REPO_DIR/cardmarket-scraper/.venv/bin/pip" install -q playwright

# Backend venv
sudo -u "$CRAWL_USER" python3.12 -m venv "$REPO_DIR/cardmarket-backend/.venv"
sudo -u "$CRAWL_USER" "$REPO_DIR/cardmarket-backend/.venv/bin/pip" install -q --upgrade pip
sudo -u "$CRAWL_USER" "$REPO_DIR/cardmarket-backend/.venv/bin/pip" install -q \
    -r "$REPO_DIR/cardmarket-backend/requirements.txt"

echo "=== [5/8] Playwright Chromium installieren (als root für System-Deps) ==="
"$REPO_DIR/cardmarket-scraper/.venv/bin/playwright" install chromium
"$REPO_DIR/cardmarket-scraper/.venv/bin/playwright" install-deps chromium

echo "=== [6/8] VNC-Passwort setzen ==="
mkdir -p /home/"$CRAWL_USER"/.vnc
chown "$CRAWL_USER:$CRAWL_USER" /home/"$CRAWL_USER"/.vnc
echo "Bitte VNC-Passwort eingeben (wird in /home/$CRAWL_USER/.vnc/passwd gespeichert):"
x11vnc -storepasswd /home/"$CRAWL_USER"/.vnc/passwd
chown "$CRAWL_USER:$CRAWL_USER" /home/"$CRAWL_USER"/.vnc/passwd
chmod 600 /home/"$CRAWL_USER"/.vnc/passwd

echo "=== [7/8] .env Template anlegen ==="
ENV_FILE="/home/$CRAWL_USER/.env"
if [ ! -f "$ENV_FILE" ]; then
    sudo -u "$CRAWL_USER" tee "$ENV_FILE" > /dev/null <<'ENVEOF'
# Cardmarket Scraper VPS Environment
# Alle Werte anpassen! Danach: chmod 600 ~/.env

# Railway PostgreSQL Public URL
# WICHTIG: Nicht die interne .railway.internal URL, sondern die externe!
# Railway Dashboard → PostgreSQL Plugin → Connect → Public URL
DATABASE_URL=postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway

# Telegram Bot (optional — Benachrichtigungen bei Crawl-Start/Ende/Fehler)
# Bot erstellen: @BotFather auf Telegram
TELEGRAM_TOKEN=123456789:ABC-DEIN-TOKEN-HIER
TELEGRAM_CHAT_ID=123456789

# VPS öffentliche IP (für noVNC-Link in Telegram-Nachricht)
VPS_IP=1.2.3.4

# Repo-Pfad (normalerweise nicht ändern)
REPO_DIR=/home/crawl/cardmarket-projekt
ENVEOF
    chmod 600 "$ENV_FILE"
    chown "$CRAWL_USER:$CRAWL_USER" "$ENV_FILE"
    echo "  .env Template angelegt: $ENV_FILE"
else
    echo "  .env existiert bereits — nicht überschrieben."
fi

echo "=== [8/8] Logs-Ordner + Crontab installieren ==="
sudo -u "$CRAWL_USER" mkdir -p /home/"$CRAWL_USER"/logs
CRONTAB_SRC="$REPO_DIR/cardmarket-scraper/infra/crontab.txt"
sed "s|REPO_DIR|$REPO_DIR|g" "$CRONTAB_SRC" | sudo -u "$CRAWL_USER" crontab -
echo "  Crontab für '$CRAWL_USER' installiert."

echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "  1. $ENV_FILE mit echten Werten befüllen (DATABASE_URL, TELEGRAM_TOKEN, VPS_IP)"
echo ""
echo "  2. Display starten:"
echo "     su - $CRAWL_USER"
echo "     bash $REPO_DIR/cardmarket-scraper/infra/start_display.sh"
echo ""
echo "  3. noVNC öffnen: http://<VPS-IP>:6080/vnc.html"
echo ""
echo "  4. Alle 3 Accounts einloggen (je in eigenem tmux-Fenster):"
echo "     tmux new -s setup_a"
echo "     DISPLAY=:1 $REPO_DIR/cardmarket-scraper/.venv/bin/python \\"
echo "       $REPO_DIR/cardmarket-scraper/scrape_cardmarket.py --setup --storage storage_state_a.json"
echo "     # Browser öffnet sich → einloggen → ENTER"
echo ""
echo "     tmux new -s setup_b"
echo "     DISPLAY=:1 $REPO_DIR/cardmarket-scraper/.venv/bin/python \\"
echo "       $REPO_DIR/cardmarket-scraper/scrape_cardmarket.py --setup --storage storage_state_b.json"
echo ""
echo "     tmux new -s setup_c"
echo "     DISPLAY=:1 $REPO_DIR/cardmarket-scraper/.venv/bin/python \\"
echo "       $REPO_DIR/cardmarket-scraper/scrape_cardmarket.py --setup --storage storage_state_c.json"
echo ""
echo "  5. warmup_urls.txt prüfen/ergänzen (liegt in $REPO_DIR/cardmarket-scraper/warmup_urls.txt)"
echo ""
echo "  6. Testlauf (manuell):"
echo "     bash $REPO_DIR/cardmarket-scraper/infra/run_crawl.sh"
echo ""
echo "  7. Cron läuft bereits (alle 2 Tage 07:00). Prüfen mit:"
echo "     crontab -l"
