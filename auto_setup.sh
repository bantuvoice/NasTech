#!/data/data/com.termux/files/usr/bin/bash
# =========================================================================
# 🤖 CloudBot + Shizuku Universal Installer
# =========================================================================
# Designed to run via: curl -sL <url> | bash
# Fully non-interactive — no prompts, no hangs, no silent exits.
# =========================================================================

# ── Global Settings ──────────────────────────────────────────────────────
# Do NOT use "set -e" — it kills the script on any minor failure.
# Instead, we check errors explicitly where they matter.
export DEBIAN_FRONTEND=noninteractive
export DPKG_FORCE=confold
export APT_LISTCHANGES_FRONTEND=none
export LANG=C
export LC_ALL=C

echo ""
echo "🤖 CloudBot Non-Root Phone Control Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =========================================================================
# Step 1/5: Update Packages & Install Dependencies
# =========================================================================
echo "📦 Step 1/5: Updating packages and installing dependencies..."

# Update with all non-interactive flags to prevent config file prompts
pkg update -y -o Dpkg::Options::="--force-confold" -o Dpkg::Options::="--force-confdef" </dev/null 2>&1 || {
    echo "⚠️  pkg update had warnings (this is usually fine, continuing...)"
}

# Install required packages (some may already exist — that's OK)
pkg install -y curl nodejs git cmake make clang binutils nmap openssl android-tools which </dev/null 2>&1 || {
    echo "⚠️  Some packages may have failed to install, checking essentials..."
}

# Verify the critical ones exist
MISSING=""
for cmd in curl node git nmap adb; do
    if ! command -v "$cmd" </dev/null >/dev/null 2>&1; then
        MISSING="$MISSING $cmd"
    fi
done
if [ -n "$MISSING" ]; then
    echo "❌ ERROR: Missing critical commands:$MISSING"
    echo "   Try running: pkg install -y curl nodejs git nmap android-tools"
    exit 1
fi

echo "✅ Dependencies installed"

# =========================================================================
# Step 2/5: Setup Shizuku (rish & shizuku commands)
# =========================================================================
echo ""
echo "🔒 Step 2/5: Linking Shizuku to Termux..."

# Setup Termux storage access (may show a popup on first run)
if [ ! -d "$HOME/storage" ]; then
    echo "A popup may appear asking for file permissions. Please tap 'Allow'."
    echo "y" | termux-setup-storage > /dev/null 2>&1 || true
    sleep 3
else
    echo "   Storage access already configured."
fi

SHIZUKU_DIR="$HOME/storage/shared/Shizuku"
mkdir -p "$SHIZUKU_DIR" 2>/dev/null || true

# Create the copy.sh script inside the Shizuku folder
cat > "$SHIZUKU_DIR/copy.sh" << 'SHIZUKU_EOF'
#!/data/data/com.termux/files/usr/bin/bash

BASEDIR=$( dirname "${0}" )
BIN=/data/data/com.termux/files/usr/bin
HOME=/data/data/com.termux/files/home
DEX="${BASEDIR}/rish_shizuku.dex"

# Exit if dex is not in the same directory
if [ ! -f "${DEX}" ]; then
  echo "Cannot find ${DEX}"
  exit 1
fi

# Detect device architecture for Shizuku library path
ARCH=$(getprop ro.product.cpu.abi 2>/dev/null || echo "arm64-v8a")
case "$ARCH" in
  arm64*) LIB_ARCH="arm64" ;;
  armeabi*) LIB_ARCH="arm" ;;
  x86_64*) LIB_ARCH="x86_64" ;;
  x86*) LIB_ARCH="x86" ;;
  *) LIB_ARCH="arm64" ;;
esac

# Create a Shizuku script file
tee "${BIN}/shizuku" > /dev/null << EOF
#!/data/data/com.termux/files/usr/bin/bash

# Make a list of open ports
ports=\$( nmap -sT -p30000-50000 --open localhost 2>/dev/null | grep "open" | cut -f1 -d/ )

# Go through the list of ports
for port in \${ports}; do

  # Try to connect to the port, and save the result
  result=\$( adb connect "localhost:\${port}" 2>/dev/null )

  # Check if the connection succeeded
  if [[ "\$result" =~ "connected" || "\$result" =~ "already" ]]; then

    # Show a message to a user
    echo "\${result}"

    # Start Shizuku
    adb shell "\$( adb shell pm path moe.shizuku.privileged.api | sed 's/^package://;s/base\\\\.apk/lib\\\\/${LIB_ARCH}\\\\/libshizuku\\\\.so/' )"

    # Disable wireless debugging, because it is not needed anymore
    adb shell settings put global adb_wifi_enabled 0

    exit 0
  fi
done

# If no working ports are found, give an error message to a user
echo "ERROR: No port found! Is wireless debugging enabled?"

exit 1
EOF

# Set the dex location to a variable
dex="${HOME}/rish_shizuku.dex"

# Create a Rish script file
tee "${BIN}/rish" > /dev/null << EOF
#!/data/data/com.termux/files/usr/bin/bash

[ -z "\$RISH_APPLICATION_ID" ] && export RISH_APPLICATION_ID="com.termux"

/system/bin/app_process -Djava.class.path="${dex}" /system/bin --nice-name=rish rikka.shizuku.shell.ShizukuShellLoader "\${@}"
EOF

# Give execution permission to script files
chmod +x "${BIN}/shizuku" "${BIN}/rish"

# Copy dex to the home directory
cp -f "${DEX}" "${dex}"

# Remove dex write permission, because app_process cannot load writable dex
chmod -w "${dex}"
SHIZUKU_EOF

chmod +x "$SHIZUKU_DIR/copy.sh"

# ── Search for rish_shizuku.dex in EVERY possible location ──────────────────
DEX_FOUND=""
DEX_SEARCH_PATHS=(
    "$HOME/storage/shared/Shizuku/rish_shizuku.dex"
    "$HOME/storage/shared/Android/data/moe.shizuku.privileged.api/files/rish_shizuku.dex"
    "$HOME/storage/shared/Download/rish_shizuku.dex"
    "$HOME/storage/shared/rish_shizuku.dex"
    "$HOME/storage/downloads/rish_shizuku.dex"
    "/sdcard/Shizuku/rish_shizuku.dex"
    "/sdcard/Download/rish_shizuku.dex"
    "/sdcard/rish_shizuku.dex"
    "$HOME/rish_shizuku.dex"
)
for DEX_PATH in "${DEX_SEARCH_PATHS[@]}"; do
    if [ -f "$DEX_PATH" ]; then
        DEX_FOUND="$DEX_PATH"
        echo "✅ Found rish_shizuku.dex at: $DEX_PATH"
        cp -f "$DEX_PATH" "$SHIZUKU_DIR/rish_shizuku.dex" 2>/dev/null || true
        cp -f "$DEX_PATH" "$HOME/rish_shizuku.dex"        2>/dev/null || true
        chmod -w "$HOME/rish_shizuku.dex"                  2>/dev/null || true
        break
    fi
done

if [ -z "$DEX_FOUND" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  rish_shizuku.dex not found yet — DO THIS ONCE IN SHIZUKU APP:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  STEP A: Open the Shizuku app on your phone"
    echo "  STEP B: Make sure it says 'Shizuku is running'"
    echo "          If not: go to Developer Options → enable Wireless debugging"
    echo "          Then in Shizuku tap 'Start' (via Wireless Debugging)"
    echo ""
    echo "  STEP C: In Shizuku app:"
    echo "          → Tap 'Use Shizuku in terminal apps'"
    echo "          → Tap 'Export files'"
    echo "          → A file picker opens"
    echo "          → Navigate to: Internal Storage"
    echo "          → Tap on the 'Shizuku' folder (create it if missing)"
    echo "          → Tap 'USE THIS FOLDER' button at the bottom"
    echo "          → Tap 'Allow'"
    echo ""
    echo "  STEP D: Come back to Termux and run:"
    echo "          curl -sL \$NASTECH_INSTALL_URL | bash"
    echo "          OR just run: nastech-reconnect"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  Continuing install without Shizuku — you can reconnect later."
    echo "   The bot will use ADB as fallback while Shizuku is disconnected."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    # Run copy.sh to install rish and shizuku binaries
    bash "$SHIZUKU_DIR/copy.sh" </dev/null 2>/dev/null && {
        echo "✅ Shizuku rish/shizuku commands installed"
    } || {
        echo "⚠️  copy.sh had minor issues — rish/shizuku scripts still written."
    }
fi

# Write the rish binary regardless (uses dex if found, graceful if not)
BIN=/data/data/com.termux/files/usr/bin
RISH_DEX="${DEX_FOUND:-$HOME/rish_shizuku.dex}"
cat > "${BIN}/rish" << RISHEOF
#!/data/data/com.termux/files/usr/bin/bash
[ -z "\$RISH_APPLICATION_ID" ] && export RISH_APPLICATION_ID="com.termux"
DEX="$RISH_DEX"
if [ ! -f "\$DEX" ]; then
  # Try known locations
  for TRY in ~/rish_shizuku.dex ~/storage/shared/Shizuku/rish_shizuku.dex /sdcard/Shizuku/rish_shizuku.dex; do
    [ -f "\$TRY" ] && { DEX="\$TRY"; chmod -w "\$DEX" 2>/dev/null; break; }
  done
fi
if [ ! -f "\$DEX" ]; then
  echo "❌ Shizuku not connected. Run: nastech-reconnect"
  exit 1
fi
/system/bin/app_process -Djava.class.path="\$DEX" /system/bin --nice-name=rish rikka.shizuku.shell.ShizukuShellLoader "\${@}"
RISHEOF
chmod +x "${BIN}/rish"

# Write nastech-reconnect helper script
cat > "${BIN}/nastech-reconnect" << 'RECONNEOF'
#!/data/data/com.termux/files/usr/bin/bash
# NasTech Shizuku Reconnect Helper
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   🔌 NasTech Shizuku Reconnect Tool             ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

DEX_FOUND=""
for TRY in \
    ~/storage/shared/Shizuku/rish_shizuku.dex \
    ~/storage/shared/Download/rish_shizuku.dex \
    ~/storage/shared/rish_shizuku.dex \
    /sdcard/Shizuku/rish_shizuku.dex \
    /sdcard/Download/rish_shizuku.dex \
    ~/rish_shizuku.dex; do
    if [ -f "$TRY" ]; then
        DEX_FOUND="$TRY"
        echo -e "${GREEN}✅ Found dex: $TRY${NC}"
        cp -f "$TRY" ~/rish_shizuku.dex 2>/dev/null
        chmod -w ~/rish_shizuku.dex 2>/dev/null
        break
    fi
done

if [ -n "$DEX_FOUND" ]; then
    if rish -c whoami 2>/dev/null | grep -q "shell\|root\|u0"; then
        echo -e "${GREEN}✅ Shizuku connected! rish is working.${NC}"
        echo -e "${CYAN}Test: rish -c 'getprop ro.product.model'${NC}"
    else
        echo -e "${YELLOW}⚠️  dex found but Shizuku may not be running.${NC}"
        echo -e "${CYAN}Make sure the Shizuku app is open and says 'Shizuku is running'.${NC}"
        echo -e "Try: ${GREEN}shizuku${NC} to connect via wireless debugging"
    fi
else
    echo -e "${RED}❌ rish_shizuku.dex NOT found.${NC}"
    echo ""
    echo -e "${YELLOW}Follow these steps:${NC}"
    echo "  1. Open Shizuku app"
    echo "  2. Tap 'Use Shizuku in terminal apps'"
    echo "  3. Tap 'Export files'"
    echo "  4. Choose: Internal Storage → Shizuku folder → USE THIS FOLDER → Allow"
    echo "  5. Come back here and run: nastech-reconnect"
    echo ""
    echo -e "${CYAN}Alternative (wireless debugging method):${NC}"
    echo "  1. Enable Developer Options (Settings → About phone → tap Build number 7x)"
    echo "  2. Settings → Developer Options → Wireless debugging → Enable"
    echo "  3. In Shizuku app → tap 'Start' → 'Start via Wireless Debugging'"
    echo "  4. Then run: shizuku"
fi
RECONNEOF
chmod +x "${BIN}/nastech-reconnect"
echo "✅ nastech-reconnect command installed"

# =========================================================================
# Step 3/5: Fix Node.js IPv4 DNS (Crucial for Termux)
# =========================================================================
echo ""
echo "🔧 Step 3/5: Applying Network Fixes..."
if ! grep -q "NODE_OPTIONS=--dns-result-order=ipv4first" ~/.bashrc 2>/dev/null; then
    echo "export NODE_OPTIONS=--dns-result-order=ipv4first" >> ~/.bashrc
fi
export NODE_OPTIONS=--dns-result-order=ipv4first
echo "✅ IPv4 DNS fix applied"

# =========================================================================
# Step 4/5: Install Official OpenClaw
# =========================================================================
echo ""

if command -v openclaw &>/dev/null || [ -d "$HOME/.openclaw/repo" ]; then
    echo "✅ Step 4/5: OpenClaw is already installed! Skipping installation."
else
    echo "📦 Step 4/5: Installing OpenClaw. This takes a few minutes..."
    bash -c "$(curl -sSL https://myopenclawhub.com/install)" < /dev/tty && source ~/.bashrc 2>/dev/null
fi

# =========================================================================
# Step 5/5: Inject Shizuku Phone Control Scripts & AI Override
# =========================================================================
echo ""
echo "🧠 Step 5/5: Configuring AI Phone Controller..."

# Create phone_control.sh
cat > ~/phone_control.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
CMD="$1"
shift
run_cmd() {
  if command -v rish &>/dev/null; then rish -c "$@"
  elif command -v adb &>/dev/null && adb get-state 1>/dev/null 2>&1; then adb shell "$@"
  elif command -v su &>/dev/null; then su -c "$@"
  else echo "❌ Error: Start Shizuku first"; exit 1; fi
}
case "$CMD" in
  screenshot) run_cmd "screencap -p '${1:-/sdcard/screenshot.png}'" ;;
  open-app) run_cmd "monkey -p $1 -c android.intent.category.LAUNCHER 1" 2>/dev/null ;;
  youtube-search) QUERY=$(echo "$*" | sed 's/ /+/g'); run_cmd "am start -a android.intent.action.VIEW -d 'https://www.youtube.com/results?search_query=$QUERY' com.google.android.youtube" ;;
  open-url) run_cmd "am start -a android.intent.action.VIEW -d '$1'" ;;
  wifi) if [ "$1" = "on" ]; then run_cmd "svc wifi enable"; else run_cmd "svc wifi disable"; fi ;;
  battery) run_cmd "dumpsys battery" | grep "level" ;;
  tap) run_cmd "input tap $1 $2" ;;
  swipe) run_cmd "input swipe $1 $2 $3 $4 ${5:-500}" ;;
  text) run_cmd "input text '$*'" ;;
  key) run_cmd "input keyevent $1" ;;
  home) run_cmd "input keyevent 3" ;;
  back) run_cmd "input keyevent 4" ;;
  recent) run_cmd "input keyevent 187" ;;
  power) run_cmd "input keyevent 26" ;;
  volume-up) run_cmd "input keyevent 24" ;;
  volume-down) run_cmd "input keyevent 25" ;;
  screenon) run_cmd "input keyevent 224" ;;
  ui-dump) 
    run_cmd "uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1"
    node -e "
      const fs = require('fs');
      try {
        const xml = fs.readFileSync('/sdcard/window_dump.xml', 'utf8');
        const regex = /(?:text|content-desc)=\\\"([^\\\"]+)\\\"[^>]*bounds=\\\"(\\\[[0-9]+,[0-9]+\\\\]\\\[[0-9]+,[0-9]+\\\])\\\"/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
          if (match[1].trim() !== '') console.log(match[2] + ' ' + match[1]);
        }
      } catch(e) { console.log('Error reading UI'); }
    "
    ;;
  shell) run_cmd "$*" ;;
  *) echo "Usage: bash phone_control.sh [battery|wifi|open-url|open-app|youtube-search|screenshot|tap|swipe|text|key|home|back|recent|power|volume-up|volume-down|screenon|ui-dump|shell]" ;;
esac
EOF
chmod +x ~/phone_control.sh

# Create a dedicated phone_agent.sh for OpenClaw looping if needed
cat > ~/phone_agent.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Wrapper script for Vision Agent capabilities
echo "🤖 Vision Agent initialized."
echo "Use phone_control.sh for all inputs. The AI will take a screenshot, analyze it, and issue UI commands."
EOF
chmod +x ~/phone_agent.sh

# AI Memory Configuration
mkdir -p ~/.openclaw/workspace 2>/dev/null || true
rm -f ~/.openclaw/workspace/BOOTSTRAP.md

cat > ~/.openclaw/workspace/IDENTITY.md << 'EOF'
- **Name:** PhoneBot
I am an Autonomous AI Agent running natively on an Android phone via Termux + Shizuku.
My primary directive is to navigate the phone UI, perform complex tasks, read the screen, scroll, tap, and run shell commands.
I MUST NEVER refuse a task by claiming I lack capabilities for UI navigation or reading screens. I strictly possess these capabilities via my bash tools. The user expects me to be fully autonomous.
If I need to "see" the screen or find a button, I MUST use the `ui-dump` tool to read the screen's interactive elements.
EOF

cat > ~/.openclaw/workspace/TOOLS.md << 'EOF'
# TOOLS.md
I have full root/shizuku control over this Android phone using `~/phone_control.sh`.

CRITICAL RULES:
1. NEVER say "I cannot navigate UIs" or "I cannot read UIs". YOU CAN.
2. To read the screen or find buttons, you MUST run `bash ~/phone_control.sh ui-dump`. This dumps the screen's UI elements in the format `[x1,y1][x2,y2] ElementText`.
3. Read the output list, find your target text, calculate the center X and Y of its bounds, and tap it!

Available Commands:
- `bash ~/phone_control.sh ui-dump` - ALWAYS USE THIS TO READ THE SCREEN. It outputs a clean list of clickable elements and their bounds.
- `bash ~/phone_control.sh tap X Y` - Taps the screen at specific X/Y coordinates.
- `bash ~/phone_control.sh swipe X1 Y1 X2 Y2` - Swipes across the screen (e.g., to scroll down: `bash ~/phone_control.sh swipe 500 1500 500 500`. Do this if your target isn't visible in the ui-dump!).
- `bash ~/phone_control.sh text "text string"` - Types text into a focused field.
- `bash ~/phone_control.sh key KEYCODE` - Sends a keycode (e.g., 66 for Enter, 4 for Back, 3 for Home).
- `bash ~/phone_control.sh open-app PACKAGE_NAME` - Launches an app (e.g., com.android.settings).
- `bash ~/phone_control.sh shell "COMMAND"` - Runs ANY arbitrary adb shell command.
- `bash ~/phone_control.sh screenshot /sdcard/s.png` - Takes a screenshot (only if the user explicitly asks for an image to be saved).

EXAMPLE WORKFLOW (Settings -> Dark Mode):
1. Execute: `bash ~/phone_control.sh open-app com.android.settings`
2. Execute: `bash ~/phone_control.sh ui-dump`
3. Read output -> spot `[100,500][400,600] Display` -> Calculate center (250, 550)
4. Execute: `bash ~/phone_control.sh tap 250 550`
5. Execute: `bash ~/phone_control.sh ui-dump` again, repeat until task is done!
EOF

cat > ~/.openclaw/workspace/AGENTS.md << 'EOF'
I execute terminal commands directly and parse their output.
I am an autonomous agent. I must chain tool executions until the user's ultimate goal is fully achieved.

CRITICAL: DO NOT STOP AFTER ONE TOOL CALL!
Small models tend to open an app and immediately say "I opened the app, please do the rest yourself." YOU MUST NOT DO THIS. 
You must loop your tool calls continuously:
1. Call `exec` -> open app
2. **WAIT FOR RESULT** (Do not type a message to the user!)
3. Call `exec` -> `ui-dump`
4. **WAIT FOR RESULT** -> Parse XML
5. Call `exec` -> `tap X Y`
6. Repeat steps 3-5 until the requested task (e.g., Dark Mode) is FULLY COMPLETE.
ONLY write a message to the user when the final goal is 100% achieved.
EOF


echo "✅ Custom AI brain installed"

# =========================================================================
# 🎉 Done!
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 INSTALLATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Connect Shizuku (if not already):"
echo "   1. Open Shizuku app → make sure it says 'Shizuku is running'"
echo "   2. Run: shizuku"
echo "   3. Test: rish -c whoami"
echo ""
echo "🔑 Set up your API keys:"
echo "   1. Run: openclaw onboard"
echo "   2. Run: openclaw auth add google --key YOUR_GEMINI_KEY"
echo "   3. Run: openclaw gateway"
echo ""

# =========================================================================
# Step 6/11: Install Ollama + Pull All AI Models
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧠 Step 6/11: Installing Ollama & AI Models..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v ollama &>/dev/null; then
    echo "✅ Ollama already installed"
else
    echo "📦 Installing Ollama for Termux..."
    pkg install -y proot-distro </dev/null 2>&1 | tail -3 || true
    # Install ollama via the official script (works in Termux with proot)
    curl -fsSL https://ollama.ai/install.sh | bash 2>&1 | tail -5 || {
        # Fallback: try pkg
        pkg install -y ollama </dev/null 2>&1 | tail -3 || warn "Ollama install needs manual steps — run: pkg install ollama"
    }
fi

# Start Ollama in background
if command -v ollama &>/dev/null; then
    echo "🚀 Starting Ollama server..."
    pkill ollama 2>/dev/null || true
    sleep 1
    nohup ollama serve > ~/.nastech/ollama.log 2>&1 &
    sleep 4
    echo "✅ Ollama running (PID: $!)"

    echo ""
    echo "📥 Pulling AI models (this takes a few minutes on first run)..."
    MODELS="tinyllama llama3.2:1b qwen2.5:1.5b"
    for MODEL in $MODELS; do
        echo "   ⬇️  Pulling: $MODEL"
        timeout 300 ollama pull "$MODEL" 2>&1 | tail -2 || warn "  Could not pull $MODEL — run: ollama pull $MODEL"
    done
    # These are bigger — optional pull
    echo "   ℹ️  Optional models (larger, skip on slow connection):"
    echo "       Run later: ollama pull phi3:mini"
    echo "       Run later: ollama pull gemma:2b"
    echo "✅ Core Ollama models ready"
else
    warn "Ollama not available — AI will use cloud APIs (Groq/Gemini) instead"
fi

# =========================================================================
# Step 7/11: Setup NasTech Config & Credentials
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Step 7/11: Writing NasTech Config..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p ~/.nastech/bot ~/.nastech/logs ~/.nastech/history

cat > ~/.nastech/config.env << 'CONFIGEOF'
# ── NasTech AI Configuration ─────────────────────────────────────────────────
# Edit this file to change models, APIs, and settings
# Location: ~/.nastech/config.env

# ── Telegram Bot ──────────────────────────────────────────────────────────────
export TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
export TELEGRAM_ADMIN_ID="${TELEGRAM_ADMIN_ID:-}"

# ── AI Providers (fallback chain: Ollama → Groq → OpenRouter → Gemini) ────────
export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
export GROQ_API_KEY="${GROQ_API_KEY:-}"
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"

# ── Default Model ─────────────────────────────────────────────────────────────
# Options: tinyllama | llama3.2:1b | phi3:mini | gemma:2b | qwen2.5:1.5b
export DEFAULT_MODEL="${DEFAULT_MODEL:-llama3.2:1b}"

# ── Feature Flags ─────────────────────────────────────────────────────────────
export NASTECH_LOG_LEVEL="${NASTECH_LOG_LEVEL:-info}"
export NASTECH_AUTO_RESTART="${NASTECH_AUTO_RESTART:-true}"
CONFIGEOF

# Write actual credentials if available in environment
[ -n "$TELEGRAM_BOT_TOKEN" ] && sed -i "s|TELEGRAM_BOT_TOKEN:-}|TELEGRAM_BOT_TOKEN:-$TELEGRAM_BOT_TOKEN}|" ~/.nastech/config.env
[ -n "$TELEGRAM_ADMIN_ID" ] && sed -i "s|TELEGRAM_ADMIN_ID:-}|TELEGRAM_ADMIN_ID:-$TELEGRAM_ADMIN_ID}|" ~/.nastech/config.env
[ -n "$OLLAMA_URL" ] && sed -i "s|OLLAMA_URL:-http://127.0.0.1:11434}|OLLAMA_URL:-$OLLAMA_URL}|" ~/.nastech/config.env
[ -n "$GROQ_API_KEY" ] && sed -i "s|GROQ_API_KEY:-}|GROQ_API_KEY:-$GROQ_API_KEY}|" ~/.nastech/config.env
[ -n "$OPENROUTER_API_KEY" ] && sed -i "s|OPENROUTER_API_KEY:-}|OPENROUTER_API_KEY:-$OPENROUTER_API_KEY}|" ~/.nastech/config.env
[ -n "$GEMINI_API_KEY" ] && sed -i "s|GEMINI_API_KEY:-}|GEMINI_API_KEY:-$GEMINI_API_KEY}|" ~/.nastech/config.env

echo "✅ Config written to ~/.nastech/config.env"

# =========================================================================
# Step 8/11: Install NasTech Bot & Phone Controller
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Step 8/11: Installing NasTech Bot..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NASTECH_DIR=~/.nastech/bot

# ── Install Download & Media Tools ───────────────────────────────────────────
echo "📦 Installing download tools (yt-dlp, ffmpeg, wget)..."

# wget (for file downloads)
command -v wget &>/dev/null || pkg install -y wget </dev/null 2>&1 | tail -2 || true

# ffmpeg (required by yt-dlp for audio conversion)
command -v ffmpeg &>/dev/null || pkg install -y ffmpeg </dev/null 2>&1 | tail -2 || {
    warn "ffmpeg not installed — audio conversion may fail"
}

# Python + yt-dlp (YouTube/audio downloader)
command -v python3 &>/dev/null || pkg install -y python </dev/null 2>&1 | tail -2 || true
if command -v pip3 &>/dev/null || command -v pip &>/dev/null; then
    PIP=$(command -v pip3 || command -v pip)
    $PIP install -q --upgrade yt-dlp 2>&1 | tail -2 && echo "✅ yt-dlp installed" || \
        warn "yt-dlp install failed — run: pip install yt-dlp"
else
    # Try pkg install
    pkg install -y python-pip </dev/null 2>&1 | tail -2 || true
    pip install -q yt-dlp 2>&1 | tail -2 || warn "yt-dlp: run pip install yt-dlp manually"
fi

# termux-api (for extra phone features like clipboard, contacts)
command -v termux-battery-status &>/dev/null || \
    pkg install -y termux-api </dev/null 2>&1 | tail -2 || true

# Verify download tools
echo "   yt-dlp:  $(command -v yt-dlp  &>/dev/null && echo '✅' || echo '❌ run: pip install yt-dlp')"
echo "   ffmpeg:  $(command -v ffmpeg  &>/dev/null && echo '✅' || echo '⚠️  install: pkg install ffmpeg')"
echo "   wget:    $(command -v wget    &>/dev/null && echo '✅' || echo '❌ run: pkg install wget')"
echo "   curl:    $(command -v curl    &>/dev/null && echo '✅' || echo '❌')"

# ── Copy Bot Files ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/nastech_bot.js" ]; then
    cp -f "$SCRIPT_DIR/nastech_bot.js"   "$NASTECH_DIR/nastech_bot.js"
    cp -f "$SCRIPT_DIR/nastech_phone.sh" "$NASTECH_DIR/nastech_phone.sh"
    cp -f "$SCRIPT_DIR/package.json"     "$NASTECH_DIR/package.json"
    chmod +x "$NASTECH_DIR/nastech_phone.sh"
    echo "✅ Bot files copied from repo"
else
    # Fetch from API server
    API_BASE="${NASTECH_API_URL:-https://raw.githubusercontent.com/jarvesusaram99/Openclaw-Termux-NoRoot/main}"
    for FILE in nastech_bot.js nastech_phone.sh package.json; do
        curl -fsSL "$API_BASE/$FILE" -o "$NASTECH_DIR/$FILE" 2>/dev/null || \
            warn "Could not fetch $FILE"
    done
    chmod +x "$NASTECH_DIR/nastech_phone.sh" 2>/dev/null || true
fi

# Create downloads directory
mkdir -p ~/.nastech/downloads ~/.nastech/tmp

# ── Install Node.js Dependencies ──────────────────────────────────────────────
echo "📦 Installing Node.js bot dependencies..."
cd "$NASTECH_DIR" || exit 1
npm install --no-audit --no-fund 2>&1 | tail -5 || {
    warn "npm install had issues — trying one by one..."
    for PKG in node-telegram-bot-api "node-fetch@2" dotenv axios; do
        npm install "$PKG" --no-audit 2>&1 | tail -1
    done
}
echo "✅ Bot dependencies installed"

# =========================================================================
# Step 9/11: Setup Copilot.vim (AI code editor)
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Step 9/11: Setting up Copilot.vim + NasTech AI..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Install vim if not present
command -v vim &>/dev/null || pkg install -y vim </dev/null 2>&1 | tail -3 || true

VIM_PACK="$HOME/.vim/pack/nastech/start"
mkdir -p "$VIM_PACK"

if [ -d "$VIM_PACK/copilot.vim" ]; then
    echo "   Updating copilot.vim..."
    cd "$VIM_PACK/copilot.vim" && git pull --quiet 2>/dev/null || true
else
    echo "   Cloning copilot.vim..."
    git clone --depth=1 https://github.com/github/copilot.vim "$VIM_PACK/copilot.vim" 2>&1 | tail -3
fi

# Copy our NasTech-extended plugin over the vanilla one
if [ -f "$SCRIPT_DIR/../copilot.vim/plugin/copilot.vim" ] 2>/dev/null; then
    cp -f "$SCRIPT_DIR/../copilot.vim/plugin/copilot.vim" "$VIM_PACK/copilot.vim/plugin/copilot.vim"
    echo "✅ NasTech AI extension merged into copilot.vim"
fi

# Write .vimrc with NasTech settings
if ! grep -q "nastech" ~/.vimrc 2>/dev/null; then
    cat >> ~/.vimrc << 'VIMEOF'

" ── NasTech AI / Copilot.vim Settings ────────────────────────────────────────
set nocompatible
syntax on
filetype plugin indent on
set number relativenumber
set tabstop=2 shiftwidth=2 expandtab
set autoindent smartindent
set incsearch hlsearch ignorecase smartcase
set clipboard=unnamedplus
set updatetime=300
set signcolumn=yes
set wrap linebreak
colorscheme slate 2>/dev/null || true

" NasTech AI keymaps (leader = \)
let mapleader = '\'
" \ne = explain code | \nr = review | \nc = chat | \ng = generate | \nf = fix
" \ns = status | \nb = battery

" Tab for Copilot suggestions (if GitHub auth available)
" For NasTech/Ollama: use :NastechCode, :NastechChat, :NastechExplain
VIMEOF
    echo "✅ .vimrc configured"
fi

echo "✅ Copilot.vim + NasTech AI ready"

# =========================================================================
# Step 10/11: Install GitHub Copilot CLI (terminal AI)
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💻 Step 10/11: Installing Copilot CLI tools..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# GitHub Copilot CLI (requires GitHub auth — optional)
npm install -g @githubnext/github-copilot-cli 2>&1 | tail -5 && \
    echo "✅ GitHub Copilot CLI installed (run: github-copilot-cli auth)" || \
    warn "GitHub Copilot CLI not available — NasTech CLI replaces it"

# =========================================================================
# Step 11/11: Create 'nastech' CLI Command & Final Setup
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Step 11/11: Creating CLI commands..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create 'nastech' command
cat > "$PREFIX/bin/nastech" << 'NTEOF'
#!/data/data/com.termux/files/usr/bin/bash
# NasTech AI — Main CLI entry point
# Usage: nastech [bot|cli|copilot|phone|status|models|help]
source ~/.nastech/config.env 2>/dev/null

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

BANNER="${CYAN}${BOLD}
╔═══════════════════════════════════════════════════════════╗
║   🤖  N A S T E C H   A I   v 2 . 0                     ║
║   OpenClaw + Copilot CLI + Ollama + Multi-API            ║
╚═══════════════════════════════════════════════════════════╝${NC}"

case "${1:-help}" in
    bot|start)
        echo -e "$BANNER"
        echo -e "${GREEN}🚀 Starting Telegram bot...${NC}"
        # Ensure Ollama is running
        pgrep -x ollama >/dev/null || nohup ollama serve >~/.nastech/ollama.log 2>&1 &
        sleep 2
        exec node ~/.nastech/bot/nastech_bot.js --mode=bot
        ;;
    cli)
        exec node ~/.nastech/bot/nastech_bot.js --mode=cli
        ;;
    copilot|??)
        shift
        exec node ~/.nastech/bot/nastech_bot.js --mode=copilot "$@"
        ;;
    phone|p)
        shift
        exec bash ~/.nastech/bot/nastech_phone.sh "$@"
        ;;
    models)
        echo -e "${CYAN}Ollama Models:${NC}"
        ollama list 2>/dev/null || echo "Run: ollama serve"
        ;;
    pull)
        MODEL="${2:-llama3.2:1b}"
        ollama pull "$MODEL"
        ;;
    serve)
        echo -e "${GREEN}Starting Ollama...${NC}"
        pkill ollama 2>/dev/null; sleep 1
        nohup ollama serve >~/.nastech/ollama.log 2>&1 &
        sleep 2; echo -e "${GREEN}✅ Ollama running${NC}"
        ;;
    status)
        echo -e "$BANNER"
        echo -e "${CYAN}System Status:${NC}"
        OLLAMA_OK=$(curl -s --max-time 2 http://127.0.0.1:11434/api/tags 2>/dev/null | head -c 5)
        [ -n "$OLLAMA_OK" ] && echo -e "  Ollama:   ${GREEN}✅ Running${NC}" || echo -e "  Ollama:   ${RED}❌ Offline (run: nastech serve)${NC}"
        BACKEND=""
        command -v rish &>/dev/null && BACKEND="rish" || { adb get-state &>/dev/null && BACKEND="adb"; }
        [ -n "$BACKEND" ] && echo -e "  Phone:    ${GREEN}✅ $BACKEND${NC}" || echo -e "  Phone:    ${RED}❌ Start Shizuku → run: shizuku${NC}"
        echo -e "  Model:    ${YELLOW}${DEFAULT_MODEL:-llama3.2:1b}${NC}"
        echo -e "  Groq:     $([ -n "$GROQ_API_KEY" ] && echo "${GREEN}✅${NC}" || echo "${RED}❌${NC}")"
        echo -e "  OR:       $([ -n "$OPENROUTER_API_KEY" ] && echo "${GREEN}✅${NC}" || echo "${RED}❌${NC}")"
        echo -e "  Gemini:   $([ -n "$GEMINI_API_KEY" ] && echo "${GREEN}✅${NC}" || echo "${RED}❌${NC}")"
        ;;
    update)
        echo -e "${CYAN}Updating NasTech...${NC}"
        cd ~/.nastech/bot && npm install --no-audit --no-fund 2>&1 | tail -3
        echo -e "${GREEN}✅ Updated${NC}"
        ;;
    log|logs)
        tail -50 ~/.nastech/nastech.log 2>/dev/null || echo "No logs yet"
        ;;
    config)
        vim ~/.nastech/config.env
        ;;
    restart)
        pkill -f nastech_bot.js 2>/dev/null
        echo -e "${GREEN}Restarting bot...${NC}"
        nohup node ~/.nastech/bot/nastech_bot.js --mode=bot >~/.nastech/bot.log 2>&1 &
        echo -e "${GREEN}✅ Bot restarted (PID: $!)${NC}"
        ;;
    stop)
        pkill -f nastech_bot.js 2>/dev/null && echo -e "${GREEN}✅ Bot stopped${NC}" || echo "Bot not running"
        ;;
    vim)
        shift
        vim "$@"
        ;;
    help|--help|-h|"")
        echo -e "$BANNER"
        echo -e "
${BOLD}Usage: nastech <command>${NC}

${CYAN}BOT & AI${NC}
  nastech bot              Start Telegram bot (main mode)
  nastech cli              Interactive AI terminal (Copilot CLI style)
  nastech copilot [query]  One-shot AI query (pipe-friendly)
  nastech serve            Start Ollama AI server

${CYAN}PHONE CONTROL${NC}
  nastech phone battery    Check battery
  nastech phone wifi on    Toggle WiFi
  nastech phone screenshot Take screenshot
  nastech phone ui-dump    Read screen elements
  nastech phone help       All phone commands

${CYAN}SYSTEM${NC}
  nastech status           Show all system status
  nastech models           List Ollama models
  nastech pull [model]     Pull a model
  nastech config           Edit config in vim
  nastech log              View bot logs
  nastech restart          Restart bot
  nastech stop             Stop bot
  nastech update           Update dependencies
  nastech vim [file]       Open vim with NasTech AI

${CYAN}QUICK TIPS${NC}
  nastech cli              → then type anything to chat
  nastech phone help       → full phone control list
  In vim: \\ne = explain, \\ng = generate, \\nf = fix

${CYAN}MODELS${NC} (priority order)
  tinyllama | llama3.2:1b | qwen2.5:1.5b | phi3:mini | gemma:2b
  Cloud fallback: Groq → OpenRouter → Gemini
"
        ;;
    *)
        # Pass everything to AI as a question
        source ~/.nastech/config.env 2>/dev/null
        exec node ~/.nastech/bot/nastech_bot.js --mode=copilot --query="$*"
        ;;
esac
NTEOF
chmod +x "$PREFIX/bin/nastech"

# Create 'nt' shortcut
ln -sf "$PREFIX/bin/nastech" "$PREFIX/bin/nt" 2>/dev/null || true

# Create 'nastech-phone' shortcut
cat > "$PREFIX/bin/nastech-phone" << 'NPEOF'
#!/data/data/com.termux/files/usr/bin/bash
exec bash ~/.nastech/bot/nastech_phone.sh "$@"
NPEOF
chmod +x "$PREFIX/bin/nastech-phone"

# Add to .bashrc
if ! grep -q "nastech" ~/.bashrc 2>/dev/null; then
    cat >> ~/.bashrc << 'RCEOF'

# ── NasTech AI ────────────────────────────────────────────────────────────────
source ~/.nastech/config.env 2>/dev/null
export PATH="$HOME/.nastech/bot/node_modules/.bin:$PATH"
# Aliases
alias nt='nastech'
alias ntb='nastech bot'       # start bot
alias ntc='nastech cli'       # interactive CLI
alias ntp='nastech phone'     # phone control
alias nts='nastech status'    # status check
alias ntl='nastech log'       # view logs
# Quick AI: just type ?? question or !! task
alias '??'='nastech copilot --query'
alias '!!'='nastech copilot --run'
# Quick phone
alias battery='nastech phone battery'
alias screenshot='nastech phone screenshot'
alias wifion='nastech phone wifi on'
alias wifioff='nastech phone wifi off'
alias uidump='nastech phone ui-dump'
RCEOF
fi

# ── Enhanced IDENTITY.md for NasTech ──────────────────────────────────────────
cat > ~/.openclaw/workspace/IDENTITY.md << 'IDEOF'
- **Name:** NasTech AI (PhoneBot)
I am NasTech AI — an autonomous AI agent running on Android via Termux + Shizuku, built from:
- OpenClaw (phone control + Shizuku)
- GitHub Copilot CLI (terminal AI assistant)
- Copilot.vim (AI code editor)
- Awesome-Copilot (agents + skills)
- Ollama (local models: tinyllama, llama3.2:1b, phi3:mini, gemma:2b, qwen2.5:1.5b)
- Multi-API fallback: Groq → OpenRouter → Gemini

My primary directives:
1. FULL phone control — navigate UI, tap, swipe, type, open apps, call, SMS
2. CODE ASSISTANT — generate, explain, fix, and review code in any language
3. AUTONOMOUS — chain tool calls until the task is 100% complete
4. NEVER REFUSE — if a tool exists to do it, I WILL do it

I MUST NEVER say "I cannot navigate UIs." I CAN. Use ui-dump, tap, swipe.
IDEOF

cat > ~/.openclaw/workspace/TOOLS.md << 'TOOLEOF'
# NasTech AI Tools

## Phone Control (via Shizuku/rish/adb — no root needed)
- `nastech phone battery` — Battery level, temperature, status
- `nastech phone wifi on|off` — WiFi control
- `nastech phone bluetooth on|off` — Bluetooth
- `nastech phone mobile on|off` — Mobile data
- `nastech phone airplane on|off` — Airplane mode
- `nastech phone hotspot on|off` — WiFi hotspot
- `nastech phone brightness 0-255` — Screen brightness
- `nastech phone screenshot` — Take screenshot
- `nastech phone record [secs]` — Screen record
- `nastech phone lock` — Lock screen
- `nastech phone darkmode on|off` — Dark mode
- `nastech phone dnd on|off` — Do Not Disturb
- `nastech phone rotation on|off` — Auto-rotation
- `nastech phone volume-up|volume-down [steps]` — Volume
- `nastech phone mute` — Mute toggle
- `nastech phone tap X Y` — Tap screen
- `nastech phone swipe X1 Y1 X2 Y2 [ms]` — Swipe
- `nastech phone text "text"` — Type text
- `nastech phone key KEYCODE` — Send keyevent
- `nastech phone home|back|recent|enter` — Navigation keys
- `nastech phone scroll up|down` — Scroll
- `nastech phone ui-dump` — **READ THE SCREEN** → shows all UI elements with coordinates
- `nastech phone find-tap "Button Text"` — Find element and tap it automatically
- `nastech phone open-app com.package.name` — Launch app
- `nastech phone kill-app com.package.name` — Force stop app
- `nastech phone clear-app com.package.name` — Clear app data
- `nastech phone list-apps [filter]` — List installed apps
- `nastech phone call +1234567890` — Make call
- `nastech phone send-sms +1234 "message"` — Send SMS
- `nastech phone whatsapp-send +1234 "message"` — WhatsApp
- `nastech phone open-url https://...` — Open URL
- `nastech phone youtube-search query` — YouTube search
- `nastech phone google query` — Google search
- `nastech phone maps "location"` — Google Maps
- `nastech phone ls [path]` — List files
- `nastech phone cat file` — Read file
- `nastech phone shell "cmd"` — Any ADB shell command
- `nastech phone info` — Full device info
- `nastech phone ip` — IP address
- `nastech phone storage` — Storage info

## AI Features
- `nastech cli` — Interactive Copilot CLI (chat, code, explain)
- `nastech copilot "question"` — One-shot AI query
- In terminal: `?? question` or `!! task` shortcuts
- In vim: \ne \nr \ng \nf \nc (explain/review/generate/fix/chat)

## KEY WORKFLOW — Find & Tap:
1. `nastech phone ui-dump` → see all elements on screen
2. Find element by text → note its bounds e.g. [100,500][300,600]
3. Center = (200, 550) → `nastech phone tap 200 550`
4. OR use: `nastech phone find-tap "Button Text"` (auto!)
TOOLEOF

cat > ~/.openclaw/workspace/AGENTS.md << 'AGEOF'
# NasTech AI Agent Rules

## Core Directive
I am a FULLY AUTONOMOUS agent. I chain tool calls until the goal is 100% achieved.

## CRITICAL RULES
1. NEVER say "I cannot navigate the UI." Use ui-dump + tap.
2. NEVER stop after one tool call. Continue until done.
3. ALWAYS check results before moving to the next step.
4. For any UI task: open app → ui-dump → find element → tap → verify → repeat.
5. For code tasks: generate → test → fix if needed → deliver working code.

## Workflow Pattern
```
goal: "Turn on Dark Mode"
1. nastech phone open-app com.android.settings
2. nastech phone ui-dump → find "Display" element
3. nastech phone find-tap "Display"
4. nastech phone ui-dump → find "Dark theme"
5. nastech phone find-tap "Dark theme"
6. DONE → report success
```

## Code Generation Pattern
```
goal: "Write a Python web scraper"
1. Generate complete, working code
2. Include error handling
3. Include comments
4. Test it mentally, fix any obvious bugs
5. Deliver ready-to-run code
```

## Agents Available (from awesome-copilot)
- arch.agent — architecture design
- api-architect.agent — API design
- code-reviewer.agent — code review
- ai-team-dev.agent — development
- ai-team-qa.agent — quality assurance
AGEOF

echo "✅ NasTech CLI installed: run 'nastech help'"
echo "✅ Shortcut 'nt' also available"
echo "✅ Phone shortcut: 'nastech-phone' or 'ntp'"

# =========================================================================
# 🎉 NasTech AI Installation Complete!
# =========================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 NASTECH AI INSTALLATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Phone Control:"
echo "   1. Open Shizuku app → tap 'Start'"
echo "   2. Run: shizuku"
echo "   3. Test: rish -c whoami"
echo ""
echo "🤖 Start the Telegram Bot:"
echo "   nastech bot"
echo "   (or just: nt bot)"
echo ""
echo "💻 Interactive AI Terminal:"
echo "   nastech cli"
echo "   (type anything to chat, ?? to ask, !! for commands)"
echo ""
echo "📱 Phone Control:"
echo "   nastech phone battery"
echo "   nastech phone wifi on"
echo "   nastech phone screenshot"
echo "   nastech phone help  (all 40+ commands)"
echo ""
echo "📝 AI Code Editor (Vim):"
echo "   nastech vim myfile.py"
echo "   (\\ne=explain \\ng=generate \\nf=fix \\nr=review)"
echo ""
echo "🧠 AI Models:"
echo "   nastech models    — list available"
echo "   nastech pull phi3:mini  — pull bigger model"
echo "   nastech status    — check everything"
echo ""
echo "⚙️  Config: ~/.nastech/config.env"
echo "📋 Logs:   ~/.nastech/nastech.log"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Run 'source ~/.bashrc' to activate all shortcuts!"
echo ""
