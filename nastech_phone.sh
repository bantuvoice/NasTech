#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# NasTech Phone Control — Advanced Shizuku/ADB Phone Controller
# From OpenClaw project — Extended x10 with all commands
# Usage: nastech-phone <command> [args...]
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✅ $*${NC}"; }
err() { echo -e "${RED}❌ $*${NC}"; exit 1; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }

# Detect best backend
if command -v rish &>/dev/null; then
  BACKEND="rish"
  run() { rish -c "$*" 2>/dev/null; }
elif adb get-state &>/dev/null 2>&1; then
  BACKEND="adb"
  run() { adb shell "$*" 2>/dev/null; }
elif command -v su &>/dev/null; then
  BACKEND="su"
  run() { su -c "$*" 2>/dev/null; }
else
  err "No phone access. Start Shizuku: open Shizuku app → tap 'Start' → run 'shizuku' in Termux"
fi

CMD="$1"; shift

case "$CMD" in

  # ── Info ──────────────────────────────────────────────────────────────────
  battery)
    INFO=$(run "dumpsys battery")
    LEVEL=$(echo "$INFO" | grep "level:" | awk '{print $2}')
    STATUS=$(echo "$INFO" | grep "status:" | awk '{print $2}')
    TEMP=$(echo "$INFO" | grep "temperature:" | awk '{print $2}')
    PLUG=$(echo "$INFO" | grep "plugged:" | awk '{print $2}')
    [ "$STATUS" = "2" ] && STAT_STR="⚡ Charging" || [ "$STATUS" = "5" ] && STAT_STR="🔋 Full" || STAT_STR="🔋 Discharging"
    TEMP_C=$(echo "scale=1; $TEMP/10" | bc 2>/dev/null || echo "$TEMP")
    echo "Battery: ${LEVEL}% | ${STAT_STR} | Temp: ${TEMP_C}°C | Plug: ${PLUG}"
    ;;

  info)
    echo "Brand:   $(run 'getprop ro.product.brand')"
    echo "Model:   $(run 'getprop ro.product.model')"
    echo "Android: $(run 'getprop ro.build.version.release')"
    echo "SDK:     $(run 'getprop ro.build.version.sdk')"
    echo "CPU:     $(run 'getprop ro.product.cpu.abi')"
    echo "Serial:  $(run 'getprop ro.serialno')"
    RAM=$(run "cat /proc/meminfo" | grep MemTotal | awk '{print $2}')
    echo "RAM:     $((RAM/1024)) MB"
    ;;

  ip)
    run "ip addr show wlan0 | grep 'inet '" | grep -oP '(\d+\.){3}\d+/\d+'
    ;;

  storage)
    run "df -h /sdcard"
    ;;

  # ── Network ───────────────────────────────────────────────────────────────
  wifi)
    case "$1" in
      on|enable)  run "svc wifi enable";  ok "WiFi enabled" ;;
      off|disable)run "svc wifi disable"; ok "WiFi disabled" ;;
      status)     run "dumpsys wifi | grep 'Wi-Fi is'" ;;
      *) warn "Usage: wifi on|off|status" ;;
    esac ;;

  bluetooth)
    case "$1" in
      on|enable)  run "input keyevent 138"; ok "Bluetooth on" ;;
      off|disable)run "input keyevent 139"; ok "Bluetooth off" ;;
      *) warn "Usage: bluetooth on|off" ;;
    esac ;;

  mobile)
    case "$1" in
      on)  run "svc data enable";  ok "Mobile data on" ;;
      off) run "svc data disable"; ok "Mobile data off" ;;
    esac ;;

  airplane)
    case "$1" in
      on)  run "settings put global airplane_mode_on 1"; run "am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true"; ok "Airplane on" ;;
      off) run "settings put global airplane_mode_on 0"; run "am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false"; ok "Airplane off" ;;
    esac ;;

  hotspot)
    case "$1" in
      on)  run "svc wifi hotspot enable";  ok "Hotspot on" ;;
      off) run "svc wifi hotspot disable"; ok "Hotspot off" ;;
    esac ;;

  nfc)
    case "$1" in
      on)  run "svc nfc enable";  ok "NFC on" ;;
      off) run "svc nfc disable"; ok "NFC off" ;;
    esac ;;

  # ── Display ───────────────────────────────────────────────────────────────
  brightness)
    VAL="${1:-128}"
    run "settings put system screen_brightness_mode 0"
    run "settings put system screen_brightness $VAL"
    ok "Brightness: $VAL/255"
    ;;

  screenshot)
    FILE="${1:-/sdcard/NasTech_$(date +%s).png}"
    run "screencap -p '$FILE'"
    ok "Saved: $FILE"
    ;;

  record)
    SECS="${1:-10}"; FILE="${2:-/sdcard/NasTech_rec_$(date +%s).mp4}"
    run "screenrecord --time-limit $SECS '$FILE' &"
    ok "Recording ${SECS}s → $FILE"
    ;;

  lock)
    run "input keyevent 26"
    ok "Screen locked"
    ;;

  unlock)
    run "input keyevent 224"
    [ -n "$1" ] && { run "input text $1"; run "input keyevent 66"; }
    ok "Woke screen"
    ;;

  darkmode)
    case "$1" in
      on)  run "cmd uimode night yes"; ok "Dark mode on" ;;
      off) run "cmd uimode night no";  ok "Light mode on" ;;
    esac ;;

  rotation)
    case "$1" in
      on)  run "settings put system accelerometer_rotation 1"; ok "Auto-rotation on" ;;
      off) run "settings put system accelerometer_rotation 0"; ok "Auto-rotation off" ;;
    esac ;;

  dnd)
    case "$1" in
      on)  run "cmd notification set_interruption_filter 1"; ok "DND on" ;;
      off) run "cmd notification set_interruption_filter 0"; ok "DND off" ;;
    esac ;;

  # ── Volume ────────────────────────────────────────────────────────────────
  volume-up)
    STEPS="${1:-1}"
    for i in $(seq 1 $STEPS); do run "input keyevent 24"; done
    ok "Volume up ${STEPS}x"
    ;;

  volume-down)
    STEPS="${1:-1}"
    for i in $(seq 1 $STEPS); do run "input keyevent 25"; done
    ok "Volume down ${STEPS}x"
    ;;

  mute)
    run "input keyevent 164"
    ok "Toggled mute"
    ;;

  # ── Input & Navigation ────────────────────────────────────────────────────
  tap)     run "input tap $1 $2";               ok "Tapped ($1,$2)" ;;
  swipe)   run "input swipe $1 $2 $3 $4 ${5:-400}"; ok "Swiped" ;;
  text)    SAFE=$(echo "$*" | tr ' ' '%s'); run "input text '$SAFE'"; ok "Typed: $*" ;;
  key)     run "input keyevent $1";             ok "Keyevent: $1" ;;
  home)    run "input keyevent 3";              ok "Home" ;;
  back)    run "input keyevent 4";              ok "Back" ;;
  recent)  run "input keyevent 187";            ok "Recents" ;;
  enter)   run "input keyevent 66";             ok "Enter" ;;
  power)   run "input keyevent 26";             ok "Power" ;;
  menu)    run "input keyevent 82";             ok "Menu" ;;

  scroll)
    case "$1" in
      down) run "input swipe 500 1500 500 800 300"; ok "Scrolled down" ;;
      up)   run "input swipe 500 800 500 1500 300"; ok "Scrolled up" ;;
    esac ;;

  # ── UI Automation ─────────────────────────────────────────────────────────
  ui-dump)
    run "uiautomator dump /sdcard/ui_dump.xml >/dev/null 2>&1"
    XML=$(run "cat /sdcard/ui_dump.xml")
    # Parse and print elements with coords
    echo "$XML" | grep -oP '(?:text|content-desc)="[^"]*"[^/]*bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | \
    while IFS= read -r line; do
      T=$(echo "$line" | grep -oP '(?:text|content-desc)="\K[^"]+')
      B=$(echo "$line" | grep -oP 'bounds="\K[^\\"]+')
      [ -n "$T" ] && echo "$B $T"
    done
    ;;

  find-tap)
    run "uiautomator dump /sdcard/ui_dump.xml >/dev/null 2>&1"
    XML=$(run "cat /sdcard/ui_dump.xml")
    BOUNDS=$(echo "$XML" | grep -oP "text=\"$1\"[^/]*bounds=\"\K[^\"]+")
    [ -z "$BOUNDS" ] && BOUNDS=$(echo "$XML" | grep -oP "content-desc=\"$1\"[^/]*bounds=\"\K[^\"]+")
    if [ -z "$BOUNDS" ]; then err "Element not found: $1"; fi
    X1=$(echo "$BOUNDS" | grep -oP '^\[(\d+),' | tr -d '[,')
    Y1=$(echo "$BOUNDS" | grep -oP ',(\d+)\]' | head -1 | tr -d ',]')
    X2=$(echo "$BOUNDS" | grep -oP '\]\[(\d+),' | tr -d '][,')
    Y2=$(echo "$BOUNDS" | grep -oP ',(\d+)\]$' | tr -d ',]')
    CX=$(( (X1 + X2) / 2 )); CY=$(( (Y1 + Y2) / 2 ))
    run "input tap $CX $CY"
    ok "Tapped '$1' at ($CX,$CY)"
    ;;

  # ── Apps ──────────────────────────────────────────────────────────────────
  open-app)
    run "monkey -p $1 -c android.intent.category.LAUNCHER 1 2>/dev/null"
    ok "Opened: $1"
    ;;

  kill-app)
    run "am force-stop $1"
    ok "Killed: $1"
    ;;

  clear-app)
    run "pm clear $1"
    ok "Cleared: $1"
    ;;

  list-apps)
    FILTER="${1:-}"
    if [ -n "$FILTER" ]; then
      run "pm list packages" | grep "$FILTER" | sed 's/package://'
    else
      run "pm list packages -3" | sed 's/package://' | sort
    fi
    ;;

  install)
    run "pm install -r '$1'"
    ok "Installed: $1"
    ;;

  uninstall)
    run "pm uninstall $1"
    ok "Uninstalled: $1"
    ;;

  grant)
    run "pm grant $1 android.permission.$2"
    ok "Granted $2 to $1"
    ;;

  # ── Communication ─────────────────────────────────────────────────────────
  call)
    run "am start -a android.intent.action.CALL -d tel:$1"
    ok "Calling: $1"
    ;;

  send-sms)
    run "am start -a android.intent.action.SENDTO -d sms:$1 --es sms_body '$2'"
    ok "SMS to $1: $2"
    ;;

  whatsapp-send)
    MSG=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$2'))" 2>/dev/null || echo "$2")
    run "am start -a android.intent.action.VIEW -d 'https://wa.me/$1?text=$MSG'"
    ok "WhatsApp → $1"
    ;;

  notification)
    run "cmd notification post -S bigtext -t '$1' 'NasTech' '$2'"
    ok "Notification: $1"
    ;;

  # ── Browser ───────────────────────────────────────────────────────────────
  open-url)
    run "am start -a android.intent.action.VIEW -d '$1'"
    ok "Opened: $1"
    ;;

  youtube-search)
    Q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$*'))" 2>/dev/null || echo "${*// /+}")
    run "am start -a android.intent.action.VIEW -d 'https://www.youtube.com/results?search_query=$Q' com.google.android.youtube"
    ok "YouTube: $*"
    ;;

  google)
    Q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$*'))" 2>/dev/null || echo "${*// /+}")
    run "am start -a android.intent.action.VIEW -d 'https://www.google.com/search?q=$Q'"
    ok "Google: $*"
    ;;

  maps)
    Q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$*'))" 2>/dev/null || echo "${*// /+}")
    run "am start -a android.intent.action.VIEW -d 'geo:0,0?q=$Q'"
    ok "Maps: $*"
    ;;

  # ── Files ─────────────────────────────────────────────────────────────────
  ls)   run "ls -la '${1:-/sdcard}'" | head -30 ;;
  cat)  run "cat '$1'" | head -100 ;;
  rm)   run "rm -rf '$1'"; ok "Deleted: $1" ;;
  mv)   run "mv '$1' '$2'"; ok "Moved" ;;
  cp)   run "cp -r '$1' '$2'"; ok "Copied" ;;
  find) run "find '${1:-/sdcard}' -name '${2:-*}' 2>/dev/null | head -20" ;;
  mkdir)run "mkdir -p '$1'"; ok "Created: $1" ;;

  # ── System ────────────────────────────────────────────────────────────────
  shell)  run "$*" ;;
  getprop)run "getprop $1" ;;
  setprop)run "setprop $1 $2"; ok "Set $1=$2" ;;
  settings)
    if [ -z "$3" ]; then
      run "settings get $1 $2"
    else
      run "settings put $1 $2 $3"; ok "settings $1 $2=$3"
    fi ;;

  reboot)
    run "reboot ${1:-}"
    ok "Rebooting${1:+ ($1)}..."
    ;;

  poweroff|shutdown|power-off|turnoff|turn-off)
    echo -e "${YELLOW}⚠️  Powering off device in 3 seconds...${NC}"
    sleep 3
    run "reboot -p" 2>/dev/null || \
    run "svc power shutdown" 2>/dev/null || \
    run "input keyevent 26 && settings put global device_provisioned 0" 2>/dev/null || \
    run "am start -a android.intent.action.ACTION_REQUEST_SHUTDOWN" 2>/dev/null
    ok "Power off sent"
    ;;

  restart-app)
    run "am force-stop '$1' && monkey -p '$1' -c android.intent.category.LAUNCHER 1"
    ok "Restarted: $1"
    ;;

  force-reboot)
    echo -e "${RED}⚠️  Force reboot — no warning to apps!${NC}"
    run "reboot" 2>/dev/null
    ;;

  logcat)
    run "logcat -d ${1:-} | tail -${2:-20}"
    ;;

  processes)
    run "ps -A 2>/dev/null | grep -i '${1:-}' | head -20"
    ;;

  # ── Chrome / Browser Control ──────────────────────────────────────────────
  chrome|chrome-open)
    URL="${1:-https://google.com}"
    [[ "$URL" != http* ]] && URL="https://$URL"
    run "am start -a android.intent.action.VIEW -d '$URL' -n com.android.chrome/com.google.android.apps.chrome.Main 2>/dev/null" || \
    run "am start -a android.intent.action.VIEW -d '$URL'"
    ok "Chrome opened: $URL"
    ;;

  chrome-incognito)
    URL="${1:-https://google.com}"
    [[ "$URL" != http* ]] && URL="https://$URL"
    run "am start -a android.intent.action.VIEW -d '$URL' --ez create_new_tab true -n com.android.chrome/com.google.android.apps.chrome.Main"
    ok "Incognito: $URL"
    ;;

  chrome-download)
    URL="$1"
    [ -z "$URL" ] && err "Usage: nastech-phone chrome-download [url]"
    run "am start -a android.intent.action.VIEW -d '$URL'"
    ok "Download triggered in Chrome: $URL"
    echo "   File will appear in /sdcard/Download/"
    ;;

  chrome-new-tab)
    run "am start -n com.android.chrome/com.google.android.apps.chrome.Main --ez create_new_tab true"
    ok "New Chrome tab"
    ;;

  chrome-state)
    run "dumpsys activity activities | grep -E 'mResumedActivity|topActivity' | head -5"
    ;;

  google)
    Q=$(echo "$*" | sed 's/ /%20/g')
    run "am start -a android.intent.action.VIEW -d 'https://www.google.com/search?q=$Q'"
    ok "Google: $*"
    ;;

  youtube)
    Q=$(echo "$*" | sed 's/ /+/g')
    run "am start -a android.intent.action.VIEW -d 'https://www.youtube.com/results?search_query=$Q' com.google.android.youtube 2>/dev/null" || \
    run "am start -a android.intent.action.VIEW -d 'https://www.youtube.com/results?search_query=$Q'"
    ok "YouTube: $*"
    ;;

  # ── File Grabber / Storage ─────────────────────────────────────────────────
  search-files|find-file)
    QUERY="${1:-}"
    TYPE="${2:-}"  # audio|video|image|doc|all
    BASE="${3:-/sdcard}"
    [ -z "$QUERY" ] && err "Usage: nastech-phone search-files [name] [type] [base-dir]"

    echo -e "${CYAN}🔍 Searching for: $QUERY (type: ${TYPE:-any})${NC}"

    case "$TYPE" in
      audio)   EXT_PAT="-iname '*.mp3' -o -iname '*.flac' -o -iname '*.aac' -o -iname '*.m4a' -o -iname '*.ogg' -o -iname '*.wav'" ;;
      video)   EXT_PAT="-iname '*.mp4' -o -iname '*.mkv' -o -iname '*.avi' -o -iname '*.mov' -o -iname '*.3gp'" ;;
      image)   EXT_PAT="-iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' -o -iname '*.webp' -o -iname '*.heic'" ;;
      doc)     EXT_PAT="-iname '*.pdf' -o -iname '*.doc' -o -iname '*.docx' -o -iname '*.txt' -o -iname '*.xlsx' -o -iname '*.apk'" ;;
      *)       EXT_PAT="" ;;
    esac

    if [ -n "$EXT_PAT" ] && [ -n "$QUERY" ]; then
      run "find '$BASE' -maxdepth 8 \( $EXT_PAT \) -iname '*${QUERY}*' 2>/dev/null | head -20"
    elif [ -n "$EXT_PAT" ]; then
      run "find '$BASE' -maxdepth 8 \( $EXT_PAT \) 2>/dev/null | head -20"
    else
      run "find '$BASE' -maxdepth 8 -iname '*${QUERY}*' 2>/dev/null | head -20"
    fi
    ;;

  find-songs)
    echo -e "${CYAN}🎵 Finding songs${1:+ matching: $1}...${NC}"
    run "find /sdcard -maxdepth 8 \( -iname '*.mp3' -o -iname '*.flac' -o -iname '*.m4a' -o -iname '*.ogg' -o -iname '*.aac' \) ${1:+-iname '*$1*'} 2>/dev/null | head -30"
    ;;

  find-videos)
    echo -e "${CYAN}🎬 Finding videos${1:+ matching: $1}...${NC}"
    run "find /sdcard -maxdepth 8 \( -iname '*.mp4' -o -iname '*.mkv' -o -iname '*.avi' -o -iname '*.mov' -o -iname '*.3gp' \) ${1:+-iname '*$1*'} 2>/dev/null | head -30"
    ;;

  find-photos)
    echo -e "${CYAN}🖼 Finding photos${1:+ matching: $1}...${NC}"
    run "find /sdcard \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' -o -iname '*.webp' \) ${1:+-iname '*$1*'} 2>/dev/null | head -30"
    ;;

  find-docs)
    echo -e "${CYAN}📄 Finding documents${1:+ matching: $1}...${NC}"
    run "find /sdcard -maxdepth 8 \( -iname '*.pdf' -o -iname '*.doc' -o -iname '*.docx' -o -iname '*.xlsx' -o -iname '*.pptx' -o -iname '*.txt' -o -iname '*.apk' -o -iname '*.zip' \) ${1:+-iname '*$1*'} 2>/dev/null | head -30"
    ;;

  find-apks)
    echo -e "${CYAN}📦 Finding APKs...${NC}"
    run "find /sdcard -iname '*.apk' 2>/dev/null | head -20"
    ;;

  ls-downloads)
    echo -e "${CYAN}📁 /sdcard/Download/:${NC}"
    run "ls -lhS /sdcard/Download/ 2>/dev/null | head -30"
    ;;

  ls-music)
    echo -e "${CYAN}🎵 /sdcard/Music/:${NC}"
    run "ls -lhS /sdcard/Music/ 2>/dev/null | head -30"
    run "ls -lhS /sdcard/Download/ 2>/dev/null | grep -E '\.(mp3|flac|m4a|aac|ogg)' | head -20"
    ;;

  ls-dcim)
    echo -e "${CYAN}📸 /sdcard/DCIM/:${NC}"
    run "ls -lhS /sdcard/DCIM/ 2>/dev/null | head -5"
    run "find /sdcard/DCIM -iname '*.jpg' -o -iname '*.mp4' 2>/dev/null | wc -l"
    ;;

  # ── Download Manager ──────────────────────────────────────────────────────
  download)
    URL="$1"
    DEST="${2:-/sdcard/Download}"
    [ -z "$URL" ] && err "Usage: nastech-phone download [url] [dest-dir]"
    FNAME=$(basename "$URL" | cut -d'?' -f1)
    echo -e "${CYAN}⬇️  Downloading: $FNAME${NC}"
    # Try via Termux curl (runs in Termux, not ADB)
    curl -L --max-time 120 -o "$DEST/$FNAME" "$URL" 2>&1 | tail -3 && ok "Saved: $DEST/$FNAME" || \
    wget -q -O "$DEST/$FNAME" "$URL" && ok "Saved: $DEST/$FNAME" || \
    err "Download failed — check URL and storage access"
    ;;

  ytdl|yt-dlp)
    URL="$1"
    AUDIO_ONLY="${2:-yes}"
    [ -z "$URL" ] && err "Usage: nastech-phone ytdl [url] [yes|no for audio-only]"
    DEST=~/.nastech/downloads
    mkdir -p "$DEST"
    command -v yt-dlp &>/dev/null || { err "yt-dlp not installed. Run: pip install yt-dlp"; }
    if [ "$AUDIO_ONLY" = "yes" ] || [ "$AUDIO_ONLY" = "audio" ]; then
      echo -e "${CYAN}🎵 Downloading audio...${NC}"
      yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist --max-filesize 48m \
        -o "$DEST/%(title)s.%(ext)s" "$URL" 2>&1 | tail -5
    else
      echo -e "${CYAN}🎬 Downloading video...${NC}"
      yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" \
        --no-playlist --max-filesize 48m \
        -o "$DEST/%(title)s.%(ext)s" "$URL" 2>&1 | tail -5
    fi
    echo -e "${GREEN}Files saved in: $DEST${NC}"
    ls -lh "$DEST" 2>/dev/null | tail -5
    ;;

  # Pull file from Android to Termux local dir for Telegram sending
  pull)
    ANDROID_PATH="$1"
    DEST="${2:-~/.nastech/downloads}"
    [ -z "$ANDROID_PATH" ] && err "Usage: nastech-phone pull [android-path] [dest-dir]"
    mkdir -p "$DEST"
    FNAME=$(basename "$ANDROID_PATH")
    # Try Termux storage mount first
    TERMUX_PATH="${ANDROID_PATH/\/sdcard\//${HOME}/storage/shared/}"
    if [ -f "$TERMUX_PATH" ]; then
      cp "$TERMUX_PATH" "$DEST/$FNAME" && ok "Copied: $DEST/$FNAME"
    else
      adb pull "$ANDROID_PATH" "$DEST/$FNAME" 2>/dev/null && ok "Pulled: $DEST/$FNAME" || \
      err "Could not pull: $ANDROID_PATH"
    fi
    ;;

  # Storage overview
  storage-info)
    echo -e "${CYAN}💾 Storage Overview:${NC}"
    run "df -h /sdcard 2>/dev/null || df -h /storage/emulated/0 2>/dev/null"
    echo ""
    echo "Download folder:"
    run "du -sh /sdcard/Download 2>/dev/null"
    echo "Music folder:"
    run "du -sh /sdcard/Music 2>/dev/null"
    echo "DCIM folder:"
    run "du -sh /sdcard/DCIM 2>/dev/null"
    echo "WhatsApp:"
    run "du -sh /sdcard/WhatsApp 2>/dev/null"
    ;;

  # ── Help ──────────────────────────────────────────────────────────────────
  help|"")
    echo -e "${CYAN}"
    echo "NasTech Phone Control v3 — Backend: $BACKEND"
    echo "─────────────────────────────────────────────"
    echo "NETWORK:   wifi|bluetooth|mobile|airplane|hotspot|nfc [on|off]"
    echo "DISPLAY:   brightness|screenshot|record|lock|unlock|darkmode|dnd|rotation"
    echo "VOLUME:    volume-up|volume-down|mute"
    echo "INPUT:     tap|swipe|text|key|home|back|recent|enter|scroll"
    echo "UI:        ui-dump|find-tap"
    echo "APPS:      open-app|kill-app|clear-app|list-apps|install|uninstall|grant"
    echo "COMMS:     call|send-sms|whatsapp-send|notification"
    echo "BROWSER:   chrome|chrome-open|chrome-incognito|chrome-download|chrome-new-tab"
    echo "           google|youtube|open-url|maps"
    echo "FILES:     ls|cat|rm|mv|cp|find|mkdir|search-files|find-songs|find-videos"
    echo "           find-photos|find-docs|find-apks|ls-downloads|ls-music|ls-dcim"
    echo "DOWNLOADS: download|ytdl|pull|storage-info"
    echo "SYSTEM:    shell|getprop|setprop|settings|reboot|logcat|processes|info|battery|ip|storage"
    echo -e "${NC}"
    ;;

  *) err "Unknown command: $CMD. Run 'nastech-phone help'" ;;
esac
