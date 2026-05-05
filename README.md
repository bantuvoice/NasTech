# 🤖 NasTech AI v2.0 — OpenClaw Termux No Root

**The most advanced Termux AI system: phone control + code assistant + Telegram bot.**  
Built on OpenClaw · GitHub Copilot CLI · copilot.vim · Awesome-Copilot · Ollama · Multi-API

> 40+ phone commands · Local AI (Ollama) · Cloud fallback (Groq/OpenRouter/Gemini) · No root required

---

### 📺 Watch the Full Setup Tutorial

<a href="https://youtu.be/QePlp8CJ-qA" target="_blank">
  <img src="https://markdown-videos-api.jorgenkh.no/youtube/QePlp8CJ-qA" alt="Watch the OpenClaw Setup Tutorial on YouTube" width="100%" />
</a>

---

## ✨ Features

- 💬 **Telegram Bot** — Send commands from anywhere
- 🧠 **Gemini AI** — Understands natural language
- 📱 **30+ Commands** — WiFi, Bluetooth, calls, SMS, screenshots, volume & more
- 🔒 **No Root** — Uses Shizuku for ADB-level access
- ⚡ **1-Click Install** — Single script sets up everything

---

## 📋 Prerequisites

| Requirement | Details |
|---|---|
| **Android Phone** | Android 11+ |
| **Shizuku** | [F-Droid](https://f-droid.org/packages/moe.shizuku.privileged.api/) or [Play Store](https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api) |
| **Termux** | [F-Droid](https://f-droid.org/en/packages/com.termux/) ⚠️ *Don't use the Play Store version* |
| **Telegram Bot Token** | Get from [@BotFather](https://t.me/BotFather) |
| **Gemini API Key** | Free from [Google AI Studio](https://aistudio.google.com/apikey) |

---

## 🏁 Setup

### Step 1 — Prepare Your Phone

1. Go to `Settings → About Phone` → tap **"Build Number"** 7 times to enable Developer Options.
2. Go to `Settings → Developer Options` → turn on **Wireless Debugging**.
3. Install **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/).
4. Install **Shizuku** from [F-Droid](https://f-droid.org/packages/moe.shizuku.privileged.api/) or Play Store.

### Step 2 — Start Shizuku & Export Files

1. Open **Shizuku** → tap **"Pairing"** under Wireless Debugging.
2. In Wireless Debugging settings, tap **"Pair device with pairing code"** and enter the code.
3. Tap **"Start"** until it says **"Shizuku is running"**.
4. Tap **"Use Shizuku in terminal apps"** → **"Export files"**.
5. Create a folder named **`Shizuku`** in your internal storage and save files there.

> **⚠️ Important:** The folder must be named exactly `Shizuku` (capital S) in your main storage.

### Step 3 — Run the Installer

Open **Termux** and paste:

```bash
curl -sL https://raw.githubusercontent.com/jarvesusaram99/Openclaw-Termux-NoRoot/main/auto_setup.sh | bash
```

This runs all **11 steps** automatically:
1. Update packages & install dependencies
2. Setup Shizuku (rish + shizuku commands)
3. Fix Node.js IPv4 DNS
4. Install OpenClaw
5. Inject AI phone controller brain
6. Install Ollama + pull AI models (tinyllama, llama3.2:1b, qwen2.5:1.5b)
7. Write NasTech config & credentials
8. Install NasTech bot + phone controller
9. Setup copilot.vim with NasTech AI extension
10. Install GitHub Copilot CLI
11. Create `nastech` CLI command with all shortcuts

### Step 4 — Start Everything

```bash
source ~/.bashrc          # activate shortcuts

nastech status            # verify everything is OK
nastech bot               # start Telegram bot
```

### Step 5 — Use It! 🎉

**Telegram bot** — find your bot and try:
- `/battery` → battery level
- `/wifi on` → turn on WiFi
- `/screenshot` → take screenshot
- `/uidump` → read all elements on screen
- `/chat write me a python script` → AI coding
- `/help` → all 40+ commands

**Terminal AI (Copilot CLI)**:
```bash
nastech cli
?? how do I compress files in termux
!! list all mp4 files on my phone
```

**Phone control**:
```bash
nastech phone battery
nastech phone wifi on
nastech phone screenshot
nastech phone find-tap "Settings"   # auto-find & tap
nastech phone help                  # all 40+ commands
```

**AI code editor**:
```bash
nastech vim mycode.py
# \ne = explain  \ng = generate  \nf = fix  \nr = review
```

---

## 📱 Full Command Reference (40+)

### Network
| Command | What it does |
|---|---|
| `nastech phone wifi on\|off` | Toggle WiFi |
| `nastech phone bluetooth on\|off` | Toggle Bluetooth |
| `nastech phone mobile on\|off` | Mobile data |
| `nastech phone airplane on\|off` | Airplane mode |
| `nastech phone hotspot on\|off` | WiFi hotspot |
| `nastech phone nfc on\|off` | NFC |
| `nastech phone ip` | Show IP address |

### Display & Sound
| Command | What it does |
|---|---|
| `nastech phone brightness 200` | Set brightness (0-255) |
| `nastech phone darkmode on\|off` | Dark/light mode |
| `nastech phone screenshot` | Take screenshot |
| `nastech phone record 15` | Screen record 15s |
| `nastech phone lock` | Lock screen |
| `nastech phone dnd on\|off` | Do Not Disturb |
| `nastech phone rotation on\|off` | Auto-rotation |
| `nastech phone volume-up 3` | Volume up (3 steps) |
| `nastech phone volume-down` | Volume down |
| `nastech phone mute` | Toggle mute |

### UI Automation (no root!)
| Command | What it does |
|---|---|
| `nastech phone ui-dump` | **Read all screen elements** |
| `nastech phone tap 540 1200` | Tap coordinates |
| `nastech phone swipe 100 800 100 200` | Swipe/scroll |
| `nastech phone find-tap "Dark mode"` | **Auto-find & tap element** |
| `nastech phone text "Hello"` | Type text |
| `nastech phone scroll down` | Scroll down |
| `nastech phone home\|back\|recent` | Navigation keys |
| `nastech phone key 66` | Send keyevent (66=Enter) |

### Apps
| Command | What it does |
|---|---|
| `nastech phone open-app com.pkg` | Launch app |
| `nastech phone kill-app com.pkg` | Force-stop app |
| `nastech phone clear-app com.pkg` | Clear app data |
| `nastech phone list-apps chrome` | Find apps by name |
| `nastech phone install /sdcard/app.apk` | Install APK |

### Communication
| Command | What it does |
|---|---|
| `nastech phone call +1234567890` | Make call |
| `nastech phone send-sms +1234 "msg"` | Send SMS |
| `nastech phone whatsapp-send +1234 "hi"` | WhatsApp |
| `nastech phone youtube-search lofi` | YouTube search |
| `nastech phone google best termux apps` | Google search |
| `nastech phone maps "Lagos Nigeria"` | Open Maps |
| `nastech phone open-url https://...` | Open URL |

### System
| Command | What it does |
|---|---|
| `nastech phone battery` | Battery level + temp |
| `nastech phone info` | Full device info |
| `nastech phone storage` | Storage usage |
| `nastech phone shell "cmd"` | Run any ADB command |
| `nastech phone getprop ro.product.model` | System property |

## 🧠 AI Models

| Priority | Provider | Model |
|---|---|---|
| 1st | Ollama (local) | tinyllama → llama3.2:1b → qwen2.5:1.5b |
| 2nd | Groq (cloud) | llama3-70b-8192 |
| 3rd | OpenRouter | llama-3.3-70b-instruct |
| 4th | Gemini | gemini-1.5-flash |

```bash
nastech models              # list local models
nastech pull phi3:mini      # pull bigger model
nastech pull gemma:2b       # pull gemma
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| `rish: command not found` | Re-run `bash ~/storage/shared/Shizuku/copy.sh` |
| Shizuku not responding | Open Shizuku app → ensure it says "Running" → run `shizuku` in Termux |
| Network errors | Run `export NODE_OPTIONS=--dns-result-order=ipv4first` |
| `rish_shizuku.dex` not found | In Shizuku → "Use in terminal apps" → "Export files" → save to `Shizuku` folder |

---

## ⚙️ Configuration

Edit `~/.nastech/config.env`:
```bash
export TELEGRAM_BOT_TOKEN="your_token_here"
export TELEGRAM_ADMIN_ID="your_telegram_id"
export OLLAMA_URL="http://127.0.0.1:11434"
export GROQ_API_KEY="gsk_..."
export OPENROUTER_API_KEY="sk-or-..."
export GEMINI_API_KEY="AIza..."
export DEFAULT_MODEL="llama3.2:1b"
```

## 💻 Vim AI (copilot.vim + NasTech)

```bash
nastech vim myfile.py    # open with AI
```

| Key | Action |
|---|---|
| `\ne` | Explain current file |
| `\ng` | Generate code |
| `\nf` | Fix code |
| `\nr` | Review for bugs |
| `\nc` | Chat with AI |
| `Tab` | Accept GitHub Copilot suggestion |

## 🙏 Credits

- **[OpenClaw Android](https://github.com/AidanPark/openclaw-android)** — The AI gateway base
- **[GitHub copilot.vim](https://github.com/github/copilot.vim)** — Vim AI plugin
- **[awesome-copilot](https://github.com/github/awesome-copilot)** — Agent skills & prompts
- **[Ollama](https://ollama.ai)** — Local AI models
- **[Shizuku](https://github.com/RikkaApps/Shizuku)** — ADB-level access without root
- **[Termux](https://github.com/termux/termux-app)** — Linux terminal for Android

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
