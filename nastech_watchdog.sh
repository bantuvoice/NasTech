#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  🐕 NasTech Watchdog v1.0
#  Auto-restarts the bot on crash · Sends Telegram crash/recovery alerts
#  Usage: nastech watch        (runs in background)
#         nastech watch-stop   (stops watchdog)
#         nastech watch-status (check status)
# ═══════════════════════════════════════════════════════════════════════════

source ~/.nastech/config.env 2>/dev/null

LOG="$HOME/.nastech/watchdog.log"
BOT_LOG="$HOME/.nastech/bot.log"
PID_FILE="$HOME/.nastech/watchdog.pid"
CHECK_INTERVAL=10    # seconds between checks
MAX_CRASHES=10       # stop watchdog after this many consecutive crashes
BASE_BACKOFF=30      # base seconds to wait before restart (multiplied by crash count)
DAILY_INTERVAL=86400 # seconds between health pings

# ── Prevent duplicate watchdog ───────────────────────────────────────────────
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "⚠️  Watchdog already running (PID: $OLD_PID)"
        echo "   Stop it first: nastech watch-stop"
        exit 1
    fi
fi
echo $$ > "$PID_FILE"

# ── Helpers ───────────────────────────────────────────────────────────────────
wlog() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

notify() {
    local msg="$1"
    [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_ADMIN_ID" ] && return
    local json
    json=$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$msg" 2>/dev/null) || \
        json="\"$msg\""
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\":\"${TELEGRAM_ADMIN_ID}\",\"text\":${json}}" \
        >/dev/null 2>&1 &
}

is_bot_running() {
    pgrep -f "nastech_bot.js" >/dev/null 2>&1
}

start_bot() {
    source ~/.nastech/config.env 2>/dev/null
    nohup node ~/.nastech/bot/nastech_bot.js --mode=bot >>"$BOT_LOG" 2>&1 &
    local PID=$!
    echo "$PID" > "$HOME/.nastech/bot.pid"
    wlog "Bot started (PID: $PID)"
}

cleanup() {
    wlog "Watchdog exiting (PID: $$)"
    rm -f "$PID_FILE"
    exit 0
}
trap cleanup SIGTERM SIGINT

# ── Startup ───────────────────────────────────────────────────────────────────
mkdir -p "$HOME/.nastech"

wlog "═══════════════════════════════════════════════════"
wlog "🐕 NasTech Watchdog started (PID: $$)"
wlog "   Check interval: ${CHECK_INTERVAL}s | Max crashes: $MAX_CRASHES"
wlog "═══════════════════════════════════════════════════"
notify "🐕 NasTech Watchdog active — bot will auto-restart on crash"

CRASHES=0
LAST_START=$(date +%s)
PING_TIMER=0

# Start bot if not already running
if ! is_bot_running; then
    wlog "Bot not running on startup — starting now..."
    start_bot
    sleep 5
fi

# ── Main monitor loop ─────────────────────────────────────────────────────────
while true; do
    sleep $CHECK_INTERVAL
    PING_TIMER=$((PING_TIMER + CHECK_INTERVAL))

    # Daily health ping
    if [ $PING_TIMER -ge $DAILY_INTERVAL ]; then
        wlog "Daily health ping (crashes since last ping: $CRASHES)"
        notify "💚 NasTech daily health check — bot running OK | Crashes today: $CRASHES"
        PING_TIMER=0
        CRASHES=0
    fi

    # Bot is alive — all good
    if is_bot_running; then
        continue
    fi

    # ── Bot crashed ───────────────────────────────────────────────────────────
    CRASHES=$((CRASHES + 1))
    NOW=$(date +%s)
    UPTIME_SECS=$(( NOW - LAST_START ))
    UPTIME_MIN=$(( UPTIME_SECS / 60 ))
    wlog "❌ Bot crash detected (#$CRASHES | was up ${UPTIME_MIN}m ${UPTIME_SECS}s)"

    # Too many crashes in a row — give up
    if [ $CRASHES -ge $MAX_CRASHES ]; then
        wlog "🚨 $MAX_CRASHES consecutive crashes — watchdog stopping"
        notify "🚨 NasTech bot crashed $MAX_CRASHES times in a row — watchdog has stopped.
Fix the error and restart with: nastech watch
View logs: nastech log"
        rm -f "$PID_FILE"
        exit 1
    fi

    # Exponential-capped backoff
    WAIT=$(( BASE_BACKOFF * CRASHES ))
    [ $WAIT -gt 300 ] && WAIT=300
    wlog "Waiting ${WAIT}s before restart attempt #$CRASHES..."
    notify "⚠️ NasTech bot crashed (#$CRASHES, up ${UPTIME_MIN}m) — restarting in ${WAIT}s"
    sleep $WAIT

    # Restart
    LAST_START=$(date +%s)
    start_bot
    sleep 5

    if is_bot_running; then
        wlog "✅ Bot recovered (crash #$CRASHES)"
        notify "✅ NasTech bot restarted successfully (crash #$CRASHES)"
        CRASHES=0
        BASE_BACKOFF=30
    else
        wlog "❌ Restart failed (attempt $CRASHES)"
        notify "❌ NasTech restart FAILED (attempt $CRASHES) — check: nastech log"
    fi
done
