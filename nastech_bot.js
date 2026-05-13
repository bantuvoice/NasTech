#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ███╗   ██╗ █████╗ ███████╗████████╗███████╗ ██████╗██╗  ██╗
//  ████╗  ██║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔════╝██║  ██║
//  ██╔██╗ ██║███████║███████╗   ██║   █████╗  ██║     ███████║
//  ██║╚██╗██║██╔══██║╚════██║   ██║   ██╔══╝  ██║     ██╔══██║
//  ██║ ╚████║██║  ██║███████║   ██║   ███████╗╚██████╗██║  ██║
//  ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝
//
//  NasTech AI v4.1 — 99 Features · Voice · Full Android Control
//  Telegram bot with keyboard buttons — no slash commands needed
//  Built by NasTech © 2025 — https://github.com/bantuvoice/NasTech
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('os').homedir() + '/.nastech/config.env' });

const TelegramBot          = require('node-telegram-bot-api');
const { execSync, exec }   = require('child_process');
const fetch                = require('node-fetch');
const FormData             = require('form-data');
const fs                   = require('fs');
const path                 = require('path');
const readline             = require('readline');
const os                   = require('os');

// ── Config ───────────────────────────────────────────────────────────────────
const TOKEN       = process.env.TELEGRAM_BOT_TOKEN  || '';
const ADMIN_ID    = parseInt(process.env.TELEGRAM_ADMIN_ID  || '0');
const OLLAMA_URL  = process.env.OLLAMA_URL           || 'http://127.0.0.1:11434';
const GROQ_KEY    = process.env.GROQ_API_KEY         || '';
const OR_KEY      = process.env.OPENROUTER_API_KEY   || '';
const GEM_KEY     = process.env.GEMINI_API_KEY       || '';
const HOME        = os.homedir();
const DL_DIR      = `${HOME}/.nastech/downloads`;
const TMP_DIR     = `${HOME}/.nastech/tmp`;
const LOG_FILE    = `${HOME}/.nastech/nastech.log`;
const ENV_FILE    = `${HOME}/.nastech/config.env`;

[DL_DIR, TMP_DIR, `${HOME}/.nastech`].forEach(d => {
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch {}
});

// ── State machine ────────────────────────────────────────────────────────────
const userState    = {};
const chatHistories = {};
let   currentModel  = process.env.DEFAULT_MODEL || 'llama3.2:1b';
let   autoReplyMode = false;

// ── Logging ───────────────────────────────────────────────────────────────────
const blog = m => { try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${m}\n`); } catch {} };

// ── File extension groups ─────────────────────────────────────────────────────
const AUDIO = ['.mp3','.flac','.wav','.aac','.ogg','.m4a','.opus','.wma'];
const VIDEO = ['.mp4','.mkv','.avi','.mov','.3gp','.webm','.m4v','.wmv'];
const IMAGE = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.heic','.heif'];

// =============================================================================
// ── KEYBOARD LAYOUTS ─────────────────────────────────────────────────────────
// =============================================================================

const MAIN_KB = {
  keyboard: [
    ['🔋 Battery',        '📱 Device Info',      '💾 Storage'],
    ['📸 Screenshot',     '🎬 Record Screen',    '🔒 Lock Screen'],
    ['🎵 Send Song',      '🎬 Send Video',       '📁 Browse Files'],
    ['📷 Latest Photo',   '🎞 Latest Video',     '📂 Last Download'],
    ['⬇️ Download URL',   '▶️ YouTube DL',       '🌐 Open Chrome'],
    ['📶 WiFi',           '🔊 Volume',           '💡 Display'],
    ['🖥 Screen Control', '🎮 Media Keys',       '🔦 Flashlight'],
    ['📞 Calls & SMS',    '📱 Apps',             '🧠 Ask AI'],
    ['🗺 Maps',           '💚 WhatsApp',         '🌤 Weather'],
    ['📋 Clipboard',      '⏰ Alarm & Timer',    '📍 My Location'],
    ['🎤 Voice Mode',     '🔊 TTS Speak',        '📸 AI Vision'],
    ['⚙️ More Controls',  '🔴 Power Off',        '🔄 Reboot'],
    ['📊 Status',         '🔧 Config Setup',     '❌ Cancel'],
    ['📝 Run Command',    '🔌 Reconnect',        '⚙️ Settings'],
  ],
  resize_keyboard: true,
  persistent: true,
};

// ─── Inline keyboards ─────────────────────────────────────────────────────────
const KB = {
  wifi: () => ({ inline_keyboard: [
    [{ text:'📶 WiFi ON',    callback_data:'wifi_on'   }, { text:'📶 WiFi OFF',    callback_data:'wifi_off'  }],
    [{ text:'📡 Mobile ON',  callback_data:'mob_on'    }, { text:'📡 Mobile OFF',  callback_data:'mob_off'   }],
    [{ text:'🔵 BT ON',      callback_data:'bt_on'     }, { text:'🔵 BT OFF',      callback_data:'bt_off'    }],
    [{ text:'✈️ Airplane ON', callback_data:'air_on'   }, { text:'✈️ Airplane OFF', callback_data:'air_off'  }],
    [{ text:'🌐 Hotspot ON',  callback_data:'hot_on'   }, { text:'🌐 Hotspot OFF',  callback_data:'hot_off'  }],
    [{ text:'📲 NFC ON',      callback_data:'nfc_on'   }, { text:'📲 NFC OFF',      callback_data:'nfc_off'  }],
    [{ text:'📍 GPS ON',      callback_data:'gps_on'   }, { text:'📍 GPS OFF',      callback_data:'gps_off'  }],
    [{ text:'ℹ️ WiFi Status', callback_data:'wifi_stat'}],
  ]}),
  volume: () => ({ inline_keyboard: [
    [{ text:'🔊 Media +1', callback_data:'vol_up1'  }, { text:'🔊 Media +3', callback_data:'vol_up3'  }, { text:'🔊 Media +5', callback_data:'vol_up5'  }],
    [{ text:'🔉 Media -1', callback_data:'vol_dn1'  }, { text:'🔉 Media -3', callback_data:'vol_dn3'  }, { text:'🔉 Media -5', callback_data:'vol_dn5'  }],
    [{ text:'🔔 Ringtone+', callback_data:'ring_up' }, { text:'🔕 Ringtone-', callback_data:'ring_dn' }],
    [{ text:'🔔 Notif+',    callback_data:'notif_up'}, { text:'🔕 Notif-',   callback_data:'notif_dn' }],
    [{ text:'⏰ Alarm+',    callback_data:'alrm_up' }, { text:'⏰ Alarm-',   callback_data:'alrm_dn'  }],
    [{ text:'🔇 Mute All',  callback_data:'mute_all'}, { text:'🔔 Unmute',   callback_data:'unmute'   }],
  ]}),
  display: () => ({ inline_keyboard: [
    [{ text:'🌙 Dark ON',    callback_data:'dark_on'  }, { text:'☀️ Dark OFF',   callback_data:'dark_off'  }],
    [{ text:'🔕 DND ON',     callback_data:'dnd_on'   }, { text:'🔔 DND OFF',    callback_data:'dnd_off'   }],
    [{ text:'🔄 Rotate ON',  callback_data:'rot_on'   }, { text:'🔄 Rotate OFF', callback_data:'rot_off'   }],
    [{ text:'🌙 Night ON',   callback_data:'night_on' }, { text:'☀️ Night OFF',  callback_data:'night_off' }],
    [{ text:'🔃 Invert ON',  callback_data:'inv_on'   }, { text:'🔃 Invert OFF', callback_data:'inv_off'   }],
    [{ text:'☀️ Bright MAX', callback_data:'br_max'   }, { text:'☀️ Bright 50%', callback_data:'br_mid'    }, { text:'🌑 Bright MIN', callback_data:'br_min' }],
    [{ text:'🔤 Font Large', callback_data:'font_lg'  }, { text:'🔤 Font Normal', callback_data:'font_nm'  }, { text:'🔤 Font Small', callback_data:'font_sm' }],
    [{ text:'🕒 Timeout 30s',callback_data:'to_30'    }, { text:'🕒 Timeout 1m', callback_data:'to_60'    }, { text:'🕒 Timeout 5m', callback_data:'to_300'  }],
  ]}),
  screen: () => ({ inline_keyboard: [
    [{ text:'🏠 Home',       callback_data:'sc_home'   }, { text:'⬅️ Back',     callback_data:'sc_back'   }, { text:'📋 Recents',   callback_data:'sc_rec'   }],
    [{ text:'📜 Scroll ⬆️',  callback_data:'sc_sup'    }, { text:'📜 Scroll ⬇️', callback_data:'sc_sdn'   }],
    [{ text:'👆 Tap Screen', callback_data:'sc_tap'    }, { text:'⌨️ Type Text', callback_data:'sc_type'  }],
    [{ text:'📲 UI Dump',    callback_data:'sc_dump'   }, { text:'🎯 Find & Tap', callback_data:'sc_find'  }],
    [{ text:'🔆 Wake Screen',callback_data:'sc_wake'   }, { text:'📴 Screen OFF', callback_data:'sc_off'   }],
    [{ text:'↩️ Enter',      callback_data:'sc_enter'  }, { text:'⌫ Delete',    callback_data:'sc_del'   }, { text:'␣ Space',    callback_data:'sc_space'  }],
    [{ text:'🔍 Zoom In',    callback_data:'sc_zin'    }, { text:'🔍 Zoom Out', callback_data:'sc_zout'  }],
  ]}),
  media: () => ({ inline_keyboard: [
    [{ text:'⏮ Prev',    callback_data:'md_prev'  }, { text:'⏯ Play/Pause', callback_data:'md_play' }, { text:'⏭ Next',   callback_data:'md_next'  }],
    [{ text:'⏹ Stop',   callback_data:'md_stop'  }, { text:'🔀 Shuffle',   callback_data:'md_shuf' }],
    [{ text:'🔊 Vol+',   callback_data:'vol_up1'  }, { text:'🔇 Mute',      callback_data:'mute_all'}, { text:'🔉 Vol-',  callback_data:'vol_dn1'  }],
    [{ text:'🎵 Open Music',callback_data:'md_music'}],
  ]}),
  apps: () => ({ inline_keyboard: [
    [{ text:'📋 List All Apps',  callback_data:'ap_list'    }],
    [{ text:'▶️ Open App',       callback_data:'ap_open'    }, { text:'💀 Kill App',    callback_data:'ap_kill'   }],
    [{ text:'🧹 Clear App Data', callback_data:'ap_clear'   }, { text:'🗑 Uninstall',   callback_data:'ap_unins'  }],
    [{ text:'📦 Install APK',    callback_data:'ap_install' }, { text:'📋 List APKs',   callback_data:'ap_apks'   }],
    [{ text:'🏃 Running Apps',   callback_data:'ap_running' }],
  ]}),
  comms: () => ({ inline_keyboard: [
    [{ text:'📞 Make Call',       callback_data:'cm_call'  }],
    [{ text:'💬 Send SMS',        callback_data:'cm_sms'   }],
    [{ text:'💚 WhatsApp Message',callback_data:'cm_wa'    }],
    [{ text:'🔔 Push Notification',callback_data:'cm_notif'}],
    [{ text:'📇 List Contacts',   callback_data:'cm_contacts'}],
    [{ text:'📍 Share Location→WA',callback_data:'cm_wloc' }],
  ]}),
  files: () => ({ inline_keyboard: [
    [{ text:'📥 Downloads',  callback_data:'fl_/sdcard/Download'      }, { text:'🎵 Music',   callback_data:'fl_/sdcard/Music'      }],
    [{ text:'🖼 Pictures',   callback_data:'fl_/sdcard/Pictures'      }, { text:'🎬 Movies',  callback_data:'fl_/sdcard/Movies'     }],
    [{ text:'📸 DCIM',       callback_data:'fl_/sdcard/DCIM'          }, { text:'📄 Docs',    callback_data:'fl_/sdcard/Documents'  }],
    [{ text:'💚 WA Media',   callback_data:'fl_/sdcard/WhatsApp/Media'}, { text:'📦 APKs',    callback_data:'ap_apks'               }],
    [{ text:'🔍 Search All', callback_data:'fl_search'                }],
  ]}),
  more: () => ({ inline_keyboard: [
    [{ text:'📷 Camera Photo',   callback_data:'mc_camera'   }, { text:'📳 Vibrate',       callback_data:'mc_vibe'    }],
    [{ text:'🔋 Battery Saver ON',callback_data:'mc_bson'    }, { text:'🔋 Battery Saver OFF',callback_data:'mc_bsoff'}],
    [{ text:'🧹 Clear All Cache', callback_data:'mc_cache'   }, { text:'📊 App Sizes',      callback_data:'mc_sizes'  }],
    [{ text:'📲 Open Settings',   callback_data:'mc_sett'    }, { text:'🔐 Dev Options',    callback_data:'mc_devopt' }],
    [{ text:'📞 Contacts→File',   callback_data:'mc_expcnt'  }, { text:'📡 Network Speed',  callback_data:'mc_speed'  }],
    [{ text:'💤 Sleep Mode',      callback_data:'mc_sleep'   }, { text:'🖥 System Uptime',   callback_data:'mc_uptime' }],
  ]}),
  alarms: () => ({ inline_keyboard: [
    [{ text:'⏰ Set Alarm',     callback_data:'al_set'  }],
    [{ text:'⏱ Set Timer',     callback_data:'al_timer'}],
    [{ text:'📋 List Alarms',  callback_data:'al_list' }],
    [{ text:'❌ Cancel Alarms', callback_data:'al_cancel'}],
  ]}),
  settings: () => ({ inline_keyboard: [
    [{ text:'🧠 Ollama Models',  callback_data:'st_models'   }],
    [{ text:'🔄 Change Model',   callback_data:'st_model'    }],
    [{ text:'🧹 Clear AI Chat',  callback_data:'st_clear'    }],
    [{ text:'🔑 Check APIs',     callback_data:'st_apis'     }],
    [{ text:'🔌 Check Shizuku',  callback_data:'st_shizuku'  }],
    [{ text:'🤖 Auto-Reply Mode',callback_data:'st_auto'     }],
    [{ text:'📋 All 99 Features',callback_data:'st_features' }],
  ]}),
  config: () => ({ inline_keyboard: [
    [{ text:'🤖 Set Bot Token',      callback_data:'cf_token'   }],
    [{ text:'👤 Set Admin ID',        callback_data:'cf_admin'   }],
    [{ text:'🔑 Set Groq Key',        callback_data:'cf_groq'    }],
    [{ text:'🔑 Set Gemini Key',      callback_data:'cf_gemini'  }],
    [{ text:'🔑 Set OpenRouter Key',  callback_data:'cf_or'      }],
    [{ text:'🌐 Set Ollama URL',      callback_data:'cf_ollama'  }],
    [{ text:'🧠 Default Model',       callback_data:'cf_model'   }],
    [{ text:'👁 View Config',         callback_data:'cf_view'    }],
  ]}),
  confirm: a => ({ inline_keyboard: [
    [{ text:`✅ YES — ${a}`, callback_data:`ok_${a}` }, { text:'❌ Cancel', callback_data:'cancel' }],
  ]}),
  ytdl: () => ({ inline_keyboard: [
    [{ text:'🎵 Audio MP3', callback_data:'yt_audio'}, { text:'🎬 Video MP4', callback_data:'yt_video'}],
  ]}),
};

// =============================================================================
// ── SHELL HELPERS ─────────────────────────────────────────────────────────────
// =============================================================================

function sh(cmd, opts = {}) {
  try {
    const o = execSync(cmd, { timeout: opts.timeout || 30000, encoding:'utf8', stdio:['pipe','pipe','pipe'] });
    return { ok:true, out: o.trim() };
  } catch(e) { return { ok:false, out:(e.stderr||'').trim()||e.message }; }
}
function shAsync(cmd, ms = 120000) {
  return new Promise(r => exec(cmd, { timeout:ms, encoding:'utf8' }, (e,o,er) => r({ ok:!e, out:(o||er||'').trim() })));
}
function getBackend() {
  if (sh('command -v rish',{timeout:2000}).ok && sh('rish -c whoami 2>/dev/null',{timeout:3000}).ok) return 'rish';
  if (sh('adb get-state 2>/dev/null',{timeout:3000}).ok) return 'adb';
  if (sh('command -v su',{timeout:2000}).ok) return 'su';
  return null;
}
function runPhone(cmd) {
  const b = getBackend();
  if (!b) return { ok:false, out:'❌ Shizuku not connected.\nRun: nastech-reconnect' };
  const safe = cmd.replace(/"/g,'\\"');
  return sh( b==='rish'?`rish -c "${safe}"`: b==='adb'?`adb shell "${safe}"`: `su -c "${safe}"`, { timeout:20000 });
}
function rp(cmd) { return runPhone(cmd).out || '(done)'; }

// =============================================================================
// ── FILE MANAGER ─────────────────────────────────────────────────────────────
// =============================================================================

function fmtSize(b) { if (!b||b<0) return '?'; const u=['B','KB','MB','GB'],i=Math.floor(Math.log(b)/Math.log(1024)); return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`; }
function fileEmoji(ext) {
  if (AUDIO.includes(ext)) return '🎵';
  if (VIDEO.includes(ext)) return '🎬';
  if (IMAGE.includes(ext)) return '🖼';
  return { '.pdf':'📕','.apk':'📦','.zip':'🗜','.rar':'🗜','.txt':'📝','.doc':'📄','.docx':'📄','.xlsx':'📊' }[ext] || '📁';
}
function searchStorage(q, exts = null, max = 15) {
  const lq = (q||'').toLowerCase();
  const results = [];
  const dirs = [
    `${HOME}/storage/shared`, `${HOME}/storage/music`, `${HOME}/storage/downloads`,
    `${HOME}/storage/pictures`, `${HOME}/storage/movies`,
  ].filter(d => { try { return fs.existsSync(d); } catch { return false; } });
  function scan(dir, depth = 0) {
    if (depth > 5 || results.length >= max) return;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes:true })) {
        if (results.length >= max) break;
        const fp = path.join(dir, e.name);
        const nm = e.name.toLowerCase();
        if (e.isDirectory()) { if (!nm.startsWith('.') && !['android','data','obb'].includes(nm)) scan(fp, depth+1); }
        else {
          const ext = path.extname(e.name).toLowerCase();
          if ((!exts||exts.includes(ext)) && (!q||nm.includes(lq)) && !results.find(x=>x.name===e.name)) {
            try { results.push({ path:fp, name:e.name, ext, size:fs.statSync(fp).size }); } catch {}
          }
        }
      }
    } catch {}
  }
  dirs.forEach(d => scan(d));
  if (results.length < 3) {
    const cmd = exts
      ? `find /sdcard -maxdepth 8 \\( ${exts.map(e=>`-iname "*${e}"`).join(' -o ')} \\) ${q?`-iname "*${lq}*"`:''} 2>/dev/null | head -${max}`
      : `find /sdcard -maxdepth 8 -iname "*${lq}*" 2>/dev/null | head -${max}`;
    const r = sh(cmd, { timeout:15000 });
    if (r.ok && r.out) {
      for (const line of r.out.split('\n')) {
        const t = line.trim(); if (!t) continue;
        const ext = path.extname(t).toLowerCase();
        if ((!exts||exts.includes(ext)) && !results.find(x=>x.path===t)) {
          results.push({ path:t, name:path.basename(t), ext, size:0 });
        }
      }
    }
  }
  return results.slice(0, max);
}
function latestFile(dirs, exts) {
  for (const raw of dirs) {
    const dir = raw.replace('/sdcard/',`${HOME}/storage/shared/`);
    try {
      const files = fs.readdirSync(fs.existsSync(dir)?dir:raw)
        .filter(f => !exts||exts.includes(path.extname(f).toLowerCase()))
        .map(f => { try { const fp=path.join(fs.existsSync(dir)?dir:raw,f); return { path:fp, name:f, mtime:fs.statSync(fp).mtime.getTime() }; } catch { return null; } })
        .filter(Boolean).sort((a,b)=>b.mtime-a.mtime);
      if (files.length) return files[0];
    } catch {}
  }
  return null;
}
async function pullFile(p) {
  const name = path.basename(p);
  const dest = path.join(TMP_DIR, name);
  const tries = [p, p.replace('/sdcard/',`${HOME}/storage/shared/`), p.replace('/storage/emulated/0/',`${HOME}/storage/shared/`)];
  for (const tp of tries) {
    try { if (fs.existsSync(tp)&&fs.statSync(tp).size>0){ fs.copyFileSync(tp,dest); return {ok:true,localPath:dest,name}; } } catch {}
  }
  const r = await shAsync(`adb pull "${p}" "${dest}" 2>/dev/null`,30000);
  if (fs.existsSync(dest)&&fs.statSync(dest).size>0) return {ok:true,localPath:dest,name};
  return {ok:false,name,error:'Cannot access file'};
}
async function sendFile(bot, chatId, filePath, caption='') {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (!stat.size) return false;
  if (stat.size>50*1024*1024) { await bot.sendMessage(chatId,`⚠️ File too large (${fmtSize(stat.size)}). Telegram limit is 50MB.`,{reply_markup:MAIN_KB}).catch(()=>{}); return false; }
  const ext = path.extname(filePath).toLowerCase();
  const opts = { caption: caption||path.basename(filePath) };
  try {
    if (AUDIO.includes(ext))      await bot.sendAudio(chatId,   fs.createReadStream(filePath), opts);
    else if (VIDEO.includes(ext)) await bot.sendVideo(chatId,   fs.createReadStream(filePath), opts);
    else if (IMAGE.includes(ext)) await bot.sendPhoto(chatId,   fs.createReadStream(filePath), { caption:opts.caption });
    else                          await bot.sendDocument(chatId,fs.createReadStream(filePath), opts);
    return true;
  } catch { try { await bot.sendDocument(chatId,fs.createReadStream(filePath),opts); return true; } catch { return false; } }
}
async function downloadURL(url, dir = DL_DIR, fname = '') {
  const name = fname || decodeURIComponent(path.basename(url.split('?')[0])) || `file_${Date.now()}`;
  const dest = path.join(dir, name);
  const r = await shAsync(`curl -L --max-time 120 --retry 2 -o "${dest}" "${url}" 2>&1`,130000);
  if (fs.existsSync(dest)&&fs.statSync(dest).size>0) return {ok:true,path:dest,name,size:fs.statSync(dest).size};
  return {ok:false,error:r.out.slice(-300)};
}
async function ytDlp(url, audioOnly = true, dir = DL_DIR) {
  if (!sh('command -v yt-dlp').ok) await shAsync('pip install -q yt-dlp 2>/dev/null||pip3 install -q yt-dlp 2>/dev/null',60000);
  const tpl = path.join(dir,'%(title)s.%(ext)s');
  const flags = audioOnly?'-x --audio-format mp3 --audio-quality 0':'-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
  const r = await shAsync(`yt-dlp ${flags} --no-playlist --max-filesize 48m --output "${tpl}" "${url}" 2>&1`,180000);
  const line = r.out.split('\n').find(l=>l.includes('[download] Destination:')||l.includes('[Merger]'));
  if (line) { const fp=line.replace(/\[download\] Destination: |\[Merger\] Merging formats into "|"$/g,'').trim(); if(fs.existsSync(fp)) return {ok:true,path:fp,name:path.basename(fp)}; }
  try {
    const files=fs.readdirSync(dir).map(f=>({f,t:fs.statSync(path.join(dir,f)).mtime.getTime()})).sort((a,b)=>b.t-a.t);
    if (files.length&&Date.now()-files[0].t<300000) return {ok:true,path:path.join(dir,files[0].f),name:files[0].f};
  } catch {}
  return {ok:false,error:r.out.slice(-400)};
}

// =============================================================================
// ── VOICE & TTS ───────────────────────────────────────────────────────────────
// =============================================================================

async function downloadTelegramFile(bot, fileId) {
  const fileInfo = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;
  const ext  = path.extname(fileInfo.file_path) || '.ogg';
  const dest = path.join(TMP_DIR, `voice_${Date.now()}${ext}`);
  const res  = await fetch(url, { timeout:30000 });
  if (!res.ok) throw new Error('Download failed');
  const buf = await res.buffer();
  fs.writeFileSync(dest, buf);
  return dest;
}

async function transcribeVoice(audioPath) {
  // Try Groq Whisper API (free, fast)
  if (GROQ_KEY) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(audioPath), { filename:'audio.ogg', contentType:'audio/ogg' });
      form.append('model','whisper-large-v3');
      form.append('response_format','text');
      const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{
        method:'POST', timeout:30000,
        headers:{ 'Authorization':`Bearer ${GROQ_KEY}`, ...form.getHeaders() },
        body: form,
      });
      if (r.ok) { const t=(await r.text()).trim(); if(t) return t; }
    } catch(e) { blog(`[VOICE] Groq Whisper: ${e.message}`); }
  }
  // Try local whisper
  if (sh('command -v whisper').ok) {
    const r = await shAsync(`whisper "${audioPath}" --model tiny --output_format txt --output_dir "${TMP_DIR}" 2>/dev/null`,60000);
    const txtFile = audioPath.replace(/\.\w+$/,'.txt');
    if (fs.existsSync(txtFile)) { const t=fs.readFileSync(txtFile,'utf8').trim(); try{fs.unlinkSync(txtFile);}catch{} if(t) return t; }
  }
  return null;
}

function ttsSpeak(text) {
  const clean = text.replace(/[`*_~[\]]/g,'').replace(/"/g,"'").slice(0,500);
  const r = sh(`termux-tts-speak "${clean}" 2>/dev/null`,{timeout:15000});
  if (!r.ok) sh(`espeak "${clean}" 2>/dev/null`,{timeout:10000});
  return '🔊 Speaking on phone speaker';
}

async function ttsSendVoice(bot, chatId, text) {
  const clean = text.replace(/[`*_~[\]]/g,'').replace(/"/g,"'").slice(0,300);
  const tmpWav = path.join(TMP_DIR,`tts_${Date.now()}.wav`);
  const tmpOgg = tmpWav.replace('.wav','.ogg');
  sh(`espeak -w "${tmpWav}" "${clean}" 2>/dev/null`,{timeout:10000});
  if (fs.existsSync(tmpWav)) {
    sh(`ffmpeg -i "${tmpWav}" -c:a libopus "${tmpOgg}" -y 2>/dev/null`,{timeout:15000});
    const f = fs.existsSync(tmpOgg)?tmpOgg:tmpWav;
    try { await bot.sendVoice(chatId,fs.createReadStream(f)); return true; } catch {}
  }
  return false;
}

// =============================================================================
// ── PHONE CONTROL ─────────────────────────────────────────────────────────────
// =============================================================================

const PHONE = {
  // F01: Battery
  battery() {
    const r=runPhone('dumpsys battery');
    if(!r.ok) return r.out;
    const lvl=r.out.match(/level: (\d+)/)?.[1]??'?', stat=r.out.match(/status: (\d+)/)?.[1];
    const plug=stat==='2'?'⚡ Charging':stat==='5'?'✅ Full':'🔋 Discharging';
    const tmp=r.out.match(/temperature: (\d+)/)?.[1], volt=r.out.match(/voltage: (\d+)/)?.[1];
    const hlth=r.out.match(/health: (\d+)/)?.[1];
    const healthStr={'1':'Unknown','2':'Good','3':'Overheat','4':'Dead','5':'Over voltage','7':'Cold'}[hlth]||'Unknown';
    return `🔋 *NasTech Battery*\nLevel: *${lvl}%* (${plug})\n🌡 Temp: ${tmp?(parseInt(tmp)/10).toFixed(1)+'°C':'N/A'}\n⚡ Voltage: ${volt?(parseInt(volt)/1000).toFixed(2)+'V':'N/A'}\n❤️ Health: ${healthStr}`;
  },
  // F02: Device info
  info() {
    const g=p=>runPhone(`getprop ${p}`).out||'N/A';
    const ram=runPhone('cat /proc/meminfo|grep MemTotal').out;
    const ramMB=ram?Math.round(parseInt(ram.match(/\d+/)?.[0]||0)/1024)+' MB':'N/A';
    const avail=runPhone('cat /proc/meminfo|grep MemAvailable').out;
    const availMB=avail?Math.round(parseInt(avail.match(/\d+/)?.[0]||0)/1024)+' MB':'N/A';
    return `📱 *NasTech Device Info*\nBrand:   ${g('ro.product.brand')}\nModel:   ${g('ro.product.model')}\nAndroid: ${g('ro.build.version.release')} (SDK ${g('ro.build.version.sdk')})\nCPU:     ${g('ro.product.cpu.abi')}\nTotal RAM: ${ramMB}\nFree RAM:  ${availMB}\nSerial:  ${g('ro.serialno')}\nFingerprint: ${g('ro.build.fingerprint').slice(0,60)}`;
  },
  // F03: Storage
  storage() {
    const r=runPhone('df -h /sdcard 2>/dev/null');
    const dl=runPhone('du -sh /sdcard/Download 2>/dev/null').out||'?';
    const mu=runPhone('du -sh /sdcard/Music 2>/dev/null').out||'?';
    const dc=runPhone('du -sh /sdcard/DCIM 2>/dev/null').out||'?';
    return `💾 *NasTech Storage*\n\`\`\`\n${r.out||'N/A'}\n\`\`\`\n📥 Downloads: ${dl}\n🎵 Music: ${mu}\n📸 DCIM: ${dc}`;
  },
  // F04: CPU & RAM usage
  cpuRam() {
    const cpu=runPhone('top -bn1 2>/dev/null|head -5').out||runPhone('cat /proc/loadavg').out||'N/A';
    const mem=runPhone('cat /proc/meminfo|grep -E "MemTotal|MemFree|MemAvailable"').out||'N/A';
    return `⚡ *CPU & RAM*\n\`\`\`\n${cpu.slice(0,300)}\n---\n${mem}\n\`\`\``;
  },
  // F05: Running processes
  processes() { return runPhone('ps -A 2>/dev/null|head -30||top -bn1|head -20').out.slice(0,3000)||'N/A'; },
  // F06: Network info
  netInfo() {
    const ip=runPhone('ip route get 1.1.1.1 2>/dev/null|awk \'{print $7}\'').out||runPhone('ifconfig wlan0 2>/dev/null|grep inet').out||'N/A';
    const wifi=runPhone('dumpsys wifi|grep -E "mWifiState|SSID|linkSpeed" 2>/dev/null|head -5').out||'N/A';
    const externalIp=sh('curl -s --max-time 5 ifconfig.me 2>/dev/null',{timeout:8000}).out||'N/A';
    return `🌐 *Network Info*\nLocal IP: ${ip}\nExternal: ${externalIp}\n\n${wifi.slice(0,300)}`;
  },
  // F07: System uptime
  uptime() {
    const r=runPhone('cat /proc/uptime');
    const secs=parseFloat(r.out)||0;
    const d=Math.floor(secs/86400),h=Math.floor((secs%86400)/3600),m=Math.floor((secs%3600)/60);
    return `🕒 *Uptime:* ${d}d ${h}h ${m}m\n${runPhone('uptime 2>/dev/null').out||''}`;
  },
  // F08: Installed apps count
  appStats() {
    const total=runPhone('pm list packages 2>/dev/null|wc -l').out||'?';
    const system=runPhone('pm list packages -s 2>/dev/null|wc -l').out||'?';
    const user=runPhone('pm list packages -3 2>/dev/null|wc -l').out||'?';
    return `📦 *App Stats*\nTotal: ${total}\nSystem: ${system}\nUser-installed: ${user}`;
  },
  // F09: Screenshot
  screenshot(f) { const fp=f||`/sdcard/NasTech_${Date.now()}.png`; runPhone(`screencap -p "${fp}"`); return fp; },
  // F10: Screen record
  record(s,f)   { const fp=f||`/sdcard/NasTech_rec_${Date.now()}.mp4`; runPhone(`screenrecord --time-limit ${s||10} "${fp}"`); return fp; },
  // F11: Lock screen
  lock()        { rp('input keyevent 26'); return '🔒 Screen locked'; },
  // F12: Wake screen
  wake()        { rp('input keyevent 224'); return '🔆 Screen woken'; },
  // F13: Screen off
  screenOff()   { rp('input keyevent 223'); return '📴 Screen off'; },
  // F14: Brightness
  brightness(v) { rp('settings put system screen_brightness_mode 0'); rp(`settings put system screen_brightness ${v}`); return `☀️ Brightness: ${v}/255`; },
  // F15: Screen timeout
  timeout(ms)   { rp(`settings put system screen_off_timeout ${ms}`); return `🕒 Timeout: ${ms/1000}s`; },
  // F16: Browse files (file manager)
  // F17: Search files
  // F18: Latest photo
  // F19: Latest video
  // F20: Latest download
  // F21: WhatsApp media
  // F22: DCIM folder
  // F23: Music folder
  // F24: Downloads folder
  // F25: Bulk file send
  // F26: Download URL (direct link)
  // F27: YouTube MP3
  // F28: YouTube MP4
  // F29: YouTube playlist
  // F30: Instagram download
  // F31: TikTok download
  // F32: WiFi
  wifi(s)       { rp(s==='on'?'svc wifi enable':'svc wifi disable'); return `📶 WiFi ${s.toUpperCase()}`; },
  // F33: Mobile data
  mobile(s)     { rp(s==='on'?'svc data enable':'svc data disable'); return `📡 Mobile Data ${s.toUpperCase()}`; },
  // F34: Bluetooth
  bluetooth(s)  { rp(`input keyevent ${s==='on'?138:139}`); return `🔵 Bluetooth ${s.toUpperCase()}`; },
  // F35: Airplane
  airplane(s)   { rp(`settings put global airplane_mode_on ${s==='on'?1:0}`); return `✈️ Airplane ${s.toUpperCase()}`; },
  // F36: Hotspot
  hotspot(s)    { rp(s==='on'?'svc wifi start-tethering 2>/dev/null':'svc wifi stop-tethering 2>/dev/null'); return `🌐 Hotspot ${s.toUpperCase()}`; },
  // F37: WiFi status
  wifiStatus()  { return runPhone('dumpsys wifi|grep -E "mWifiState|SSID" 2>/dev/null|head -5').out||'N/A'; },
  // F38: NFC
  nfc(s)        { rp(`settings put global nfc_on ${s==='on'?1:0} 2>/dev/null||am start -a android.settings.NFC_SETTINGS`); return `📲 NFC ${s.toUpperCase()}`; },
  // F39: GPS
  gps(s)        { rp(`settings put secure location_providers_allowed ${s==='on'?'+gps,+network,-passive':'-gps,-network,-passive'} 2>/dev/null||settings put global location_mode ${s==='on'?3:0}`); return `📍 GPS ${s.toUpperCase()}`; },
  // F40: Media volume
  volUp(n=1)    { for(let i=0;i<n;i++) rp('input keyevent 24'); return `🔊 Vol +${n}`; },
  volDn(n=1)    { for(let i=0;i<n;i++) rp('input keyevent 25'); return `🔉 Vol -${n}`; },
  // F41: Ringtone volume
  ringVol(d)    { const s=d==='up'?'RAISE_VOLUME':'LOWER_VOLUME'; rp(`media volume --stream RING --${s==='RAISE_VOLUME'?'raise':'lower'} 2>/dev/null||input keyevent ${d==='up'?24:25}`); return `🔔 Ringtone ${d}`; },
  // F42: Notification volume
  notifVol(d)   { rp(`media volume --stream NOTIFICATION --${d==='up'?'raise':'lower'} 2>/dev/null`); return `🔔 Notification vol ${d}`; },
  // F43: Alarm volume
  alarmVol(d)   { rp(`media volume --stream ALARM --${d==='up'?'raise':'lower'} 2>/dev/null`); return `⏰ Alarm vol ${d}`; },
  // F44: Mute
  mute()        { rp('input keyevent 164'); return '🔇 Muted'; },
  unmute()      { rp('input keyevent 164'); return '🔔 Unmuted'; },
  // F46: Dark mode
  dark(s)       { rp(`cmd uimode night ${s==='on'?'yes':'no'}`); return `🌙 Dark mode ${s.toUpperCase()}`; },
  // F47: DND
  dnd(s)        { rp(`cmd notification set_interruption_filter ${s==='on'?1:0}`); return `🔕 DND ${s.toUpperCase()}`; },
  // F48: Rotation
  rotate(s)     { rp(`settings put system accelerometer_rotation ${s==='on'?1:0}`); return `🔄 Rotation ${s.toUpperCase()}`; },
  // F49: Night light
  nightLight(s) { rp(`settings put secure night_display_activated ${s==='on'?1:0} 2>/dev/null`); return `🌙 Night Light ${s.toUpperCase()}`; },
  // F50: Color inversion
  invert(s)     { rp(`settings put secure accessibility_display_inversion_enabled ${s==='on'?1:0} 2>/dev/null`); return `🔃 Color Inversion ${s.toUpperCase()}`; },
  // F51: Font size
  fontsize(s)   { const v={'large':1.3,'normal':1.0,'small':0.85}[s]||1.0; rp(`settings put system font_scale ${v}`); return `🔤 Font: ${s}`; },
  // F52: Extra dim
  extraDim(s)   { rp(`settings put secure reduce_bright_colors_activated ${s==='on'?1:0} 2>/dev/null`); return `💤 Extra Dim ${s.toUpperCase()}`; },
  // F53: Home button
  home()        { rp('input keyevent 3');   return '🏠 Home'; },
  // F54: Back button
  back()        { rp('input keyevent 4');   return '⬅️ Back'; },
  // F55: Recents
  recent()      { rp('input keyevent 187'); return '📋 Recents'; },
  // F56: Scroll up
  scrollUp()    { rp('input swipe 500 800 500 1500 300');  return '📜 Scrolled up'; },
  // F57: Scroll down
  scrollDown()  { rp('input swipe 500 1500 500 800 300');  return '📜 Scrolled down'; },
  // F58: Tap screen at coordinates
  tap(x,y)      { rp(`input tap ${x} ${y}`); return `👆 Tapped (${x},${y})`; },
  // F59: Type text
  typeText(t)   { rp(`input text "${t.replace(/ /g,'%s').replace(/['"]/g,'')}"`); return `⌨️ Typed`; },
  enter()       { rp('input keyevent 66'); return '↩️ Enter'; },
  del()         { rp('input keyevent 67'); return '⌫ Delete'; },
  space()       { rp('input keyevent 62'); return '␣ Space'; },
  // F60: UI dump & find-and-tap
  uiDump() {
    rp('uiautomator dump /sdcard/ui_dump.xml 2>/dev/null');
    const r=runPhone('cat /sdcard/ui_dump.xml');
    if(!r.ok) return 'UI dump failed';
    const re=/(?:text|content-desc)="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
    let m,items=[];
    while((m=re.exec(r.out))!==null){ if(m[1].trim()){const cx=Math.floor((+m[2]+ +m[4])/2),cy=Math.floor((+m[3]+ +m[5])/2); items.push(`(${cx},${cy}) "${m[1]}"`);} }
    return items.length?`📲 UI (${items.length}):\n${items.slice(0,25).join('\n')}`:'No UI elements found';
  },
  findTap(text) {
    rp('uiautomator dump /sdcard/ui_dump.xml 2>/dev/null');
    const r=runPhone('cat /sdcard/ui_dump.xml');
    const pt=new RegExp(`(?:text|content-desc)="${text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
    const m=r.out.match(pt);
    if(!m) return `❌ Not found: "${text}"`;
    const cx=Math.floor((+m[1]+ +m[3])/2),cy=Math.floor((+m[2]+ +m[4])/2);
    rp(`input tap ${cx} ${cy}`);
    return `✅ Tapped "${text}" at (${cx},${cy})`;
  },
  // F61: Play/Pause media
  play()        { rp('input keyevent 85');  return '⏯ Play/Pause'; },
  // F62: Next track
  next()        { rp('input keyevent 87');  return '⏭ Next'; },
  // F63: Previous track
  prev()        { rp('input keyevent 88');  return '⏮ Previous'; },
  // F64: Stop media
  stop()        { rp('input keyevent 86');  return '⏹ Stopped'; },
  // F65: Open music app
  musicApp()    { rp('am start -a android.intent.action.MUSIC_PLAYER 2>/dev/null||am start com.spotify.music/.MainActivity 2>/dev/null'); return '🎵 Music app opened'; },
  // F66: Phone call
  call(n)       { rp(`am start -a android.intent.action.CALL -d tel:${n}`); return `📞 Calling ${n}`; },
  // F67: Send SMS
  sms(n,m)      { rp(`am start -a android.intent.action.SENDTO -d sms:${n} --es sms_body "${m}"`); return `💬 SMS to ${n}`; },
  // F68: WhatsApp message
  wa(n,m)       { rp(`am start -a android.intent.action.VIEW -d "https://wa.me/${n}?text=${encodeURIComponent(m)}"`); return `💚 WhatsApp → ${n}`; },
  // F69: Push notification
  notify(t,b)   { rp(`cmd notification post -S bigtext -t "${t}" "NasTech" "${b}"`); return `🔔 Notification: ${t}`; },
  // F70: Export contacts to file
  contacts()    { return runPhone('content query --uri content://contacts/phones/ --projection display_name:number 2>/dev/null|head -30').out||'Cannot access contacts — need Shizuku'; },
  // F71: Share location via WhatsApp
  waLocation()  { rp('am start -a android.intent.action.VIEW -d "https://wa.me/?text=My+location"'); return '📍 Location share opened in WA'; },
  // F72: List installed apps
  listApps(f='')  { return runPhone(`pm list packages ${f} 2>/dev/null|sed 's/package://'|sort`).out||'N/A'; },
  // F73: Open app by package name
  openApp(p)      { rp(`monkey -p ${p} -c android.intent.category.LAUNCHER 1 2>/dev/null||am start ${p} 2>/dev/null`); return `▶️ Opened: ${p}`; },
  // F74: Force-stop app
  killApp(p)      { rp(`am force-stop ${p}`); return `💀 Killed: ${p}`; },
  // F75: Clear app data/cache
  clearApp(p)     { rp(`pm clear ${p}`); return `🧹 Cleared: ${p}`; },
  // F76: Uninstall app
  uninstall(p)    { rp(`pm uninstall --user 0 ${p} 2>/dev/null`); return `🗑 Uninstalled: ${p}`; },
  // F77: Install APK from URL
  async installApk(url) {
    const dest=path.join(DL_DIR,`app_${Date.now()}.apk`);
    const r=await shAsync(`curl -L -o "${dest}" "${url}" 2>&1`,120000);
    if(!fs.existsSync(dest)) return '❌ Download failed';
    const ir=runPhone(`pm install "${dest.replace(HOME,'/data/data/com.termux/files/home')}" 2>/dev/null`);
    if(!ir.ok) { rp(`am start -a android.intent.action.VIEW -d "file://${dest}" -t application/vnd.android.package-archive`); return `📦 APK ready — install dialog opened`; }
    return `✅ Installed APK`;
  },
  // F78: List running apps
  runningApps()   { return runPhone("dumpsys activity activities|grep mResumedActivity||dumpsys activity recents|grep 'Recent #'|head -10").out||'N/A'; },
  // F79: Flashlight
  flash(s)      { rp(`cmd media_session volume --stream BEEP --set 5 2>/dev/null;camera -q 2>/dev/null`); const r=runPhone(`am start -a android.media.action.VIDEO_CAPTURE 2>/dev/null`); return s==='on'?rp('input keyevent 0x100000f 2>/dev/null')||'🔦 Flashlight ON (try Termux:API: termux-torch on)':'🔦 Flashlight OFF'; },
  flashlight(s) { const r=sh(`termux-torch ${s==='on'?'on':'off'} 2>/dev/null`,{timeout:5000}); return r.ok?`🔦 Flashlight ${s.toUpperCase()}`:`🔦 Flashlight ${s} (install Termux:API app)`; },
  // F80: Vibrate
  vibrate(ms=500){ const r=sh(`termux-vibrate -d ${ms} 2>/dev/null`,{timeout:5000}); if(!r.ok) rp(`input keyevent 0 2>/dev/null`); return `📳 Vibrate ${ms}ms`; },
  // F81: Camera photo
  cameraPhoto() {
    const dest=`/sdcard/NasTech_cam_${Date.now()}.jpg`;
    const r=sh(`termux-camera-photo "${dest.replace('/sdcard/',`${HOME}/storage/shared/`)}" 2>/dev/null`,{timeout:10000});
    if(!r.ok) { rp(`am start -a android.media.action.IMAGE_CAPTURE`); return {ok:false,msg:'📷 Camera opened — use shutter button'}; }
    return {ok:true,path:dest};
  },
  // F82: Set alarm
  alarm(time)   { rp(`am start -a android.intent.action.SET_ALARM --ei android.intent.extra.alarm.HOUR ${time.split(':')[0]||8} --ei android.intent.extra.alarm.MINUTES ${time.split(':')[1]||0} --ez android.intent.extra.alarm.SKIP_UI true 2>/dev/null`); return `⏰ Alarm set for ${time}`; },
  // F83: Set timer
  timer(secs)   { rp(`am start -a android.intent.action.SET_TIMER --ei android.intent.extra.alarm.LENGTH ${secs} --ez android.intent.extra.alarm.SKIP_UI true 2>/dev/null`); return `⏱ Timer set for ${secs}s`; },
  // F84: Clipboard
  clipboard(txt) {
    if (txt) { const r=sh(`termux-clipboard-set "${txt.replace(/"/g,"'")}" 2>/dev/null`,{timeout:5000}); return r.ok?`📋 Clipboard set: "${txt.slice(0,50)}"`:'📋 Set clipboard (needs Termux:API)'; }
    const r=sh('termux-clipboard-get 2>/dev/null',{timeout:5000});
    return r.ok&&r.out?`📋 Clipboard: "${r.out.slice(0,500)}"`: '📋 Get clipboard (needs Termux:API app)';
  },
  // F85: Battery saver
  batterySaver(s){ rp(`settings put global low_power ${s==='on'?1:0} 2>/dev/null`); return `🔋 Battery Saver ${s.toUpperCase()}`; },
  // F45: TTS speak (handled in voice section above)
  // F86: Voice message transcription (Groq Whisper)
  // F87: TTS phone speaker (espeak-ng)
  // F88: Auto-reply with TTS voice
  // F89: AI chat (handled in aiChat())
  // F90: AI describe screenshot
  async aiVision(bot, chatId, imgPath) {
    if (!GEM_KEY) return '❌ Gemini API key needed for AI Vision. Set it in Config Setup.';
    try {
      const img=fs.readFileSync(imgPath).toString('base64');
      const ext=path.extname(imgPath).slice(1)||'jpeg';
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEM_KEY}`,{
        method:'POST',timeout:30000,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:`image/${ext}`,data:img}},{text:'Describe this screenshot in detail. What app is open? What does it show? Be concise.'}]}]})
      });
      if(r.ok) return (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text||'No description';
    } catch(e) { return `❌ Vision error: ${e.message}`; }
    return '❌ AI Vision failed';
  },
  // F91: Code gen (handled in aiChat with prompt prefix)
  // F92: Translate (handled in aiChat with prompt prefix)
  // F93: Explain (handled in aiChat with prompt prefix)
  // F94: Weather
  async weather(loc='') {
    try {
      const query=loc||'auto';
      const r=await fetch(`https://wttr.in/${encodeURIComponent(query)}?format=4`,{timeout:10000});
      if(r.ok) { const t=await r.text(); return `🌤 *Weather*\n${t.trim()}`; }
    } catch {}
    try {
      const r2=await fetch(`https://wttr.in/${loc||''}?format=%l:+%c+%t+%h+💧+%p+🌬️+%w`,{timeout:10000});
      if(r2.ok) return `🌤 ${await r2.text()}`;
    } catch {}
    return '❌ Weather unavailable';
  },
  // F95: Auto-reply mode (toggle in state)
  // F96: Maps
  maps(q)       { rp(`am start -a android.intent.action.VIEW -d "geo:0,0?q=${encodeURIComponent(q)}"`); return `🗺 Maps: ${q}`; },
  directions(to){ rp(`am start -a android.intent.action.VIEW -d "https://maps.google.com/maps?daddr=${encodeURIComponent(to)}"`); return `🚗 Directions to: ${to}`; },
  // F97: Power off
  poweroff()    { rp('reboot -p 2>/dev/null')||rp('svc power shutdown 2>/dev/null')||rp('am start -a android.intent.action.ACTION_REQUEST_SHUTDOWN'); return '🔴 Power off sent...'; },
  // F98: Reboot
  reboot()      { rp('reboot'); return '🔄 Reboot sent...'; },
  // F99: All 99 Features list (handled in st_features callback)
  // Misc helpers
  chrome(u)     { const url=u.startsWith('http')?u:`https://${u}`; rp(`am start -a android.intent.action.VIEW -d "${url}" -n com.android.chrome/com.google.android.apps.chrome.Main 2>/dev/null`)||rp(`am start -a android.intent.action.VIEW -d "${url}"`); return `🌐 Chrome: ${url}`; },
  openUrl(u)    { rp(`am start -a android.intent.action.VIEW -d "${u}"`); return `🌐 Opened: ${u}`; },
  youtube(q)    { const u=`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`; rp(`am start -a android.intent.action.VIEW -d "${u}" com.google.android.youtube 2>/dev/null`)||rp(`am start -a android.intent.action.VIEW -d "${u}"`); return `▶️ YouTube: ${q}`; },
  shell(c)      { return runPhone(c).out||'(no output)'; },
  lsDir(p='/sdcard') {
    const mp=p.replace('/sdcard/',`${HOME}/storage/shared/`);
    try {
      const d=fs.existsSync(mp)?mp:p;
      const entries=fs.readdirSync(d);
      return entries.slice(0,40).map(e=>{try{const s=fs.statSync(path.join(d,e));return `${s.isDirectory()?'📁':'📄'} ${e}${s.isDirectory()?'/':` (${fmtSize(s.size)})`}`;}catch{return `  ${e}`;}}).join('\n')||'Empty';
    } catch {}
    return runPhone(`ls -la "${p}" 2>/dev/null|head -40`).out||'No access';
  },
  clearAllCache() {
    const apps=runPhone('pm list packages -3 2>/dev/null|sed "s/package://"').out.split('\n').filter(Boolean).slice(0,20);
    let cleared=0;
    apps.forEach(p=>{if(runPhone(`pm clear ${p.trim()} 2>/dev/null`).ok)cleared++;});
    return `🧹 Cleared cache for ${cleared} apps`;
  },
  networkSpeed() {
    const r=sh('curl -w "%{speed_download}" -o /dev/null -s --max-time 10 https://speed.cloudflare.com/__down?bytes=1000000 2>/dev/null',{timeout:15000});
    const bps=parseFloat(r.out)||0;
    const mbps=(bps/1024/1024).toFixed(2);
    return `📡 Download Speed: *${mbps} MB/s* (${(parseFloat(mbps)*8).toFixed(1)} Mbps)`;
  },
  devOptions()  { rp('am start -n com.android.settings/.DevelopmentSettingsActivity 2>/dev/null||am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS'); return '🔐 Developer Options opened'; },
  settings()    { rp('am start -a android.settings.SETTINGS'); return '⚙️ Settings opened'; },
};

// =============================================================================
// ── AI ENGINE ─────────────────────────────────────────────────────────────────
// =============================================================================

const SYS_PROMPT = `You are NasTech AI v4 — the world's most capable Android AI assistant, running directly on the device via Termux. You can fully control the phone, search and send files, download YouTube/Instagram/TikTok content, control Chrome browser, write code, make calls, send messages, and chain complex commands. You are built by NasTech. Be direct, helpful, and concise.`;

async function aiChat(msg, uid, systemOverride = null) {
  if (!chatHistories[uid]) chatHistories[uid] = [];
  const hist = chatHistories[uid];
  const msgs = [
    { role:'system', content: systemOverride || SYS_PROMPT },
    ...hist.slice(-12),
    { role:'user', content: msg },
  ];
  for (const prov of ['ollama','groq','openrouter','gemini']) {
    try {
      let content = '';
      if (prov==='ollama') {
        const r=await fetch(`${OLLAMA_URL}/api/chat`,{method:'POST',timeout:60000,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:currentModel,messages:msgs,stream:false})});
        if(r.ok) content=(await r.json()).message?.content||'';
      } else if (prov==='groq' && GROQ_KEY) {
        const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',timeout:30000,headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:'llama3-70b-8192',messages:msgs,max_tokens:4096})});
        if(r.ok) content=(await r.json()).choices?.[0]?.message?.content||'';
      } else if (prov==='openrouter' && OR_KEY) {
        const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',timeout:30000,headers:{'Content-Type':'application/json','Authorization':`Bearer ${OR_KEY}`,'HTTP-Referer':'nastech','X-Title':'NasTech'},body:JSON.stringify({model:'meta-llama/llama-3.3-70b-instruct:free',messages:msgs,max_tokens:4096})});
        if(r.ok) content=(await r.json()).choices?.[0]?.message?.content||'';
      } else if (prov==='gemini' && GEM_KEY) {
        const cs=msgs.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
        const sys=msgs.find(m=>m.role==='system')?.content;
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEM_KEY}`,{method:'POST',timeout:30000,headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:cs,...(sys&&{systemInstruction:{parts:[{text:sys}]}})})});
        if(r.ok) content=(await r.json()).candidates?.[0]?.content?.parts?.[0]?.text||'';
      } else continue;
      if (content) {
        hist.push({role:'user',content:msg},{role:'assistant',content});
        if(hist.length>24) chatHistories[uid]=hist.slice(-24);
        return {content,provider:prov};
      }
    } catch(e) { blog(`[AI] ${prov}: ${e.message}`); }
  }
  return {content:'⚠️ All AI providers offline.\n• Run `nastech serve` to start Ollama\n• Or add a GROQ_API_KEY in Config Setup',provider:'none'};
}

// ── Config saver ──────────────────────────────────────────────────────────────
function saveConfig(key, value) {
  try {
    let content='';
    try{content=fs.readFileSync(ENV_FILE,'utf8');}catch{}
    const line=`export ${key}="${value}"`;
    const rx=new RegExp(`^export ${key}=.*$`,'m');
    content=rx.test(content)?content.replace(rx,line):content+'\n'+line;
    fs.writeFileSync(ENV_FILE,content.trim()+'\n');
    return true;
  } catch { return false; }
}

// ── State helpers ─────────────────────────────────────────────────────────────
const setState = (id,s) => { userState[id]=s; };
const getState = id => userState[id];
const clearState = id => { delete userState[id]; };

// =============================================================================
// ── BOT START ─────────────────────────────────────────────────────────────────
// =============================================================================

function startBot() {
  if (!TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN missing in ~/.nastech/config.env'); process.exit(1); }

  const bot = new TelegramBot(TOKEN, { polling:{ interval:800, autoStart:true } });
  const isAdmin = id => ADMIN_ID && id === ADMIN_ID;

  // Helpers
  const send = (id,txt,extra={}) => bot.sendMessage(id,txt,{parse_mode:'Markdown',reply_markup:MAIN_KB,...extra}).catch(()=>{});
  const sendInline = (id,txt,kb,extra={}) => bot.sendMessage(id,txt,{parse_mode:'Markdown',reply_markup:kb,...extra}).catch(()=>{});
  const typing = id => bot.sendChatAction(id,'typing').catch(()=>{});
  const uploading = id => bot.sendChatAction(id,'upload_document').catch(()=>{});
  const answCQ = (id,t='✅') => bot.answerCallbackQuery(id,{text:t}).catch(()=>{});

  // ── /start ──────────────────────────────────────────────────────────────
  bot.onText(/\/start/, msg => {
    const id=msg.chat.id;
    clearState(id);
    send(id,
      `*🤖 NasTech AI v4.1*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*99 Features · Voice · Full Phone Control*\n\n` +
      `Admin: ${isAdmin(id)?'✅ Yes':'❌ No'} | Model: \`${currentModel}\`\n` +
      `Auto-Reply: ${autoReplyMode?'✅ ON':'❌ OFF'}\n\n` +
      `_Tap buttons below — or type anything to chat with AI_\n` +
      `_Send a 🎤 voice note to use voice control!_\n\n` +
      `*Built by NasTech © 2025*`
    );
  });

  // ── Voice message handler (F86, F87, F88) ─────────────────────────────
  bot.on('voice', async msg => {
    const id = msg.chat.id;
    try {
      send(id,'🎤 Transcribing your voice note...');
      const audioPath = await downloadTelegramFile(bot, msg.voice.file_id);
      const text = await transcribeVoice(audioPath);
      if (!text) return send(id,'❌ Could not transcribe. Set GROQ_API_KEY in Config Setup for voice support.');
      send(id,`🎤 *You said:* "${text}"`);
      typing(id);
      const r = await aiChat(text, id);
      send(id, r.content.slice(0,4096)+`\n_[${r.provider} • voice]_`);
      // Optionally speak back on phone speaker
      ttsSpeak(r.content.replace(/[*_`]/g,'').slice(0,200));
      try{fs.unlinkSync(audioPath);}catch{}
    } catch(e) { send(id,`❌ Voice error: ${e.message}`); }
  });

  // ── Photo handler (for AI Vision) ──────────────────────────────────────
  bot.on('photo', async msg => {
    const id = msg.chat.id;
    if (!GEM_KEY) return send(id,'❌ Set GEMINI_API_KEY in Config Setup for AI image analysis.');
    try {
      const ph = msg.photo[msg.photo.length-1];
      send(id,'📸 Analyzing image with AI...');
      typing(id);
      const fp = await downloadTelegramFile(bot, ph.file_id);
      const desc = await PHONE.aiVision(bot, id, fp);
      send(id, `📸 *AI Vision Result:*\n${desc}`);
      try{fs.unlinkSync(fp);}catch{}
    } catch(e) { send(id,`❌ Vision error: ${e.message}`); }
  });

  // ── CALLBACK QUERY ──────────────────────────────────────────────────────
  bot.on('callback_query', async cq => {
    const id   = cq.message.chat.id;
    const data = cq.data;
    answCQ(cq.id);

    // WiFi/Network
    if (data==='wifi_on')    return send(id, PHONE.wifi('on'));
    if (data==='wifi_off')   return send(id, PHONE.wifi('off'));
    if (data==='mob_on')     return send(id, PHONE.mobile('on'));
    if (data==='mob_off')    return send(id, PHONE.mobile('off'));
    if (data==='bt_on')      return send(id, PHONE.bluetooth('on'));
    if (data==='bt_off')     return send(id, PHONE.bluetooth('off'));
    if (data==='air_on')     return send(id, PHONE.airplane('on'));
    if (data==='air_off')    return send(id, PHONE.airplane('off'));
    if (data==='hot_on')     return send(id, PHONE.hotspot('on'));
    if (data==='hot_off')    return send(id, PHONE.hotspot('off'));
    if (data==='nfc_on')     return send(id, PHONE.nfc('on'));
    if (data==='nfc_off')    return send(id, PHONE.nfc('off'));
    if (data==='gps_on')     return send(id, PHONE.gps('on'));
    if (data==='gps_off')    return send(id, PHONE.gps('off'));
    if (data==='wifi_stat')  return send(id, PHONE.wifiStatus());

    // Volume
    if (data==='vol_up1')  return send(id, PHONE.volUp(1));
    if (data==='vol_up3')  return send(id, PHONE.volUp(3));
    if (data==='vol_up5')  return send(id, PHONE.volUp(5));
    if (data==='vol_dn1')  return send(id, PHONE.volDn(1));
    if (data==='vol_dn3')  return send(id, PHONE.volDn(3));
    if (data==='vol_dn5')  return send(id, PHONE.volDn(5));
    if (data==='ring_up')  return send(id, PHONE.ringVol('up'));
    if (data==='ring_dn')  return send(id, PHONE.ringVol('down'));
    if (data==='notif_up') return send(id, PHONE.notifVol('up'));
    if (data==='notif_dn') return send(id, PHONE.notifVol('down'));
    if (data==='alrm_up')  return send(id, PHONE.alarmVol('up'));
    if (data==='alrm_dn')  return send(id, PHONE.alarmVol('down'));
    if (data==='mute_all') return send(id, PHONE.mute());
    if (data==='unmute')   return send(id, PHONE.unmute());

    // Display
    if (data==='dark_on')  return send(id, PHONE.dark('on'));
    if (data==='dark_off') return send(id, PHONE.dark('off'));
    if (data==='dnd_on')   return send(id, PHONE.dnd('on'));
    if (data==='dnd_off')  return send(id, PHONE.dnd('off'));
    if (data==='rot_on')   return send(id, PHONE.rotate('on'));
    if (data==='rot_off')  return send(id, PHONE.rotate('off'));
    if (data==='night_on') return send(id, PHONE.nightLight('on'));
    if (data==='night_off')return send(id, PHONE.nightLight('off'));
    if (data==='inv_on')   return send(id, PHONE.invert('on'));
    if (data==='inv_off')  return send(id, PHONE.invert('off'));
    if (data==='br_max')   return send(id, PHONE.brightness(255));
    if (data==='br_mid')   return send(id, PHONE.brightness(128));
    if (data==='br_min')   return send(id, PHONE.brightness(20));
    if (data==='font_lg')  return send(id, PHONE.fontsize('large'));
    if (data==='font_nm')  return send(id, PHONE.fontsize('normal'));
    if (data==='font_sm')  return send(id, PHONE.fontsize('small'));
    if (data==='to_30')    return send(id, PHONE.timeout(30000));
    if (data==='to_60')    return send(id, PHONE.timeout(60000));
    if (data==='to_300')   return send(id, PHONE.timeout(300000));

    // Screen control
    if (data==='sc_home')  return send(id, PHONE.home());
    if (data==='sc_back')  return send(id, PHONE.back());
    if (data==='sc_rec')   return send(id, PHONE.recent());
    if (data==='sc_sup')   return send(id, PHONE.scrollUp());
    if (data==='sc_sdn')   return send(id, PHONE.scrollDown());
    if (data==='sc_wake')  return send(id, PHONE.wake());
    if (data==='sc_off')   return send(id, PHONE.screenOff());
    if (data==='sc_enter') return send(id, PHONE.enter());
    if (data==='sc_del')   return send(id, PHONE.del());
    if (data==='sc_space') return send(id, PHONE.space());
    if (data==='sc_zin')   { rp('input keyevent 168'); return send(id,'🔍 Zoom in'); }
    if (data==='sc_zout')  { rp('input keyevent 169'); return send(id,'🔍 Zoom out'); }
    if (data==='sc_tap')   { setState(id,{waiting:'tap_coords'}); return send(id,'👆 Type X Y coordinates:\n_e.g. 540 960_'); }
    if (data==='sc_type')  { setState(id,{waiting:'type_text'});  return send(id,'⌨️ What text to type?'); }
    if (data==='sc_dump')  { send(id,'📲 Dumping UI...'); return send(id, PHONE.uiDump().slice(0,3800)); }
    if (data==='sc_find')  { setState(id,{waiting:'findtap'}); return send(id,'🎯 Type label/text to find and tap:'); }

    // Media
    if (data==='md_play')  return send(id, PHONE.play());
    if (data==='md_next')  return send(id, PHONE.next());
    if (data==='md_prev')  return send(id, PHONE.prev());
    if (data==='md_stop')  return send(id, PHONE.stop());
    if (data==='md_shuf')  { rp('input keyevent 0x000A0001 2>/dev/null'); return send(id,'🔀 Shuffle toggled'); }
    if (data==='md_music') return send(id, PHONE.musicApp());

    // Apps
    if (data==='ap_list')    { send(id,'📋 Loading...'); const apps=PHONE.listApps(); return send(id,`📋 *Installed Apps:*\n\`\`\`\n${apps.slice(0,3000)}\n\`\`\``); }
    if (data==='ap_running') return send(id, `🏃 *Running:*\n${PHONE.runningApps()}`);
    if (data==='ap_apks')    { send(id,'📦 Scanning...'); return send(id, sh('find /sdcard -iname "*.apk" 2>/dev/null|head -15',{timeout:10000}).out||'No APKs found'); }
    if (data==='ap_open')    { setState(id,{waiting:'app_open'}); return send(id,'▶️ Package name to open:\n_e.g. com.whatsapp_'); }
    if (data==='ap_kill')    { setState(id,{waiting:'app_kill'}); return send(id,'💀 Package name to kill:'); }
    if (data==='ap_clear')   { setState(id,{waiting:'app_clear'}); return send(id,'🧹 Package name to clear data:'); }
    if (data==='ap_unins')   { setState(id,{waiting:'app_unins'}); return send(id,'🗑 Package name to uninstall:'); }
    if (data==='ap_install') { setState(id,{waiting:'apk_url'});   return send(id,'📦 Paste APK download URL:'); }

    // Comms
    if (data==='cm_call')     { setState(id,{waiting:'call_num'});  return send(id,'📞 Type phone number to call:'); }
    if (data==='cm_sms')      { setState(id,{waiting:'sms_num'});   return send(id,'💬 Type: *number message*\n_e.g. +1234567890 Hello!_'); }
    if (data==='cm_wa')       { setState(id,{waiting:'wa_num'});    return send(id,'💚 Type: *number message*\n_e.g. +1234567890 Hey!_'); }
    if (data==='cm_notif')    { setState(id,{waiting:'notif_msg'}); return send(id,'🔔 Type: *title|body*\n_e.g. Test|Hello there_'); }
    if (data==='cm_contacts') { send(id,'📇 Loading contacts...'); return send(id, `📇 *Contacts:*\n\`\`\`\n${PHONE.contacts().slice(0,3000)}\n\`\`\``); }
    if (data==='cm_wloc')     return send(id, PHONE.waLocation());

    // Files
    if (data.startsWith('fl_')) {
      const dir=data.slice(3);
      if (dir==='search') { setState(id,{waiting:'search_files'}); return send(id,'🔍 Type filename or keyword:'); }
      const listing=PHONE.lsDir(dir);
      return sendInline(id, `📁 *${dir}*\n\`\`\`\n${listing.slice(0,3000)}\n\`\`\``, KB.files());
    }
    if (data==='ap_apks') { const r=sh('find /sdcard -iname "*.apk" 2>/dev/null|head -20',{timeout:12000}); return send(id,r.out?`📦 APKs:\n\`${r.out}\``:'No APKs'); }

    // More controls
    if (data==='mc_camera') {
      send(id,'📷 Taking photo...');
      const r=PHONE.cameraPhoto();
      if(r.ok){uploading(id);const p=await pullFile(r.path);if(p.ok)await sendFile(bot,id,p.localPath,'📷 NasTech Camera');else send(id,r.msg||'Photo taken');}
      else send(id,r.msg||'📷 Camera opened');
      return;
    }
    if (data==='mc_vibe')    return send(id, PHONE.vibrate(500));
    if (data==='mc_bson')    return send(id, PHONE.batterySaver('on'));
    if (data==='mc_bsoff')   return send(id, PHONE.batterySaver('off'));
    if (data==='mc_cache')   { send(id,'🧹 Clearing caches...'); return send(id, PHONE.clearAllCache()); }
    if (data==='mc_sett')    return send(id, PHONE.settings());
    if (data==='mc_devopt')  return send(id, PHONE.devOptions());
    if (data==='mc_speed')   { send(id,'📡 Testing speed...'); return send(id, PHONE.networkSpeed()); }
    if (data==='mc_sleep')   { PHONE.screenOff(); return send(id,'💤 Sleep mode — screen off'); }
    if (data==='mc_uptime')  return send(id, PHONE.uptime());
    if (data==='mc_sizes') {
      const r=runPhone('du -sh /sdcard/* 2>/dev/null|sort -rh|head -15');
      return send(id,`📊 *Folder Sizes:*\n\`\`\`\n${r.out.slice(0,2000)}\n\`\`\``);
    }
    if (data==='mc_expcnt')  return send(id, `📇 *Contacts:*\n\`${PHONE.contacts().slice(0,1500)}\``);

    // Alarms
    if (data==='al_set')     { setState(id,{waiting:'alarm_time'}); return send(id,'⏰ Type alarm time:\n_Format: HH:MM (e.g. 07:30)_'); }
    if (data==='al_timer')   { setState(id,{waiting:'timer_secs'}); return send(id,'⏱ Type timer duration in seconds:\n_e.g. 300 for 5 minutes_'); }
    if (data==='al_list')    return send(id, rp('dumpsys alarm 2>/dev/null|grep RTC|head -10')||'No alarms found');
    if (data==='al_cancel')  { rp('alarmmanager cancel 2>/dev/null'); return send(id,'⏰ Alarms cancelled'); }

    // Settings
    if (data==='st_models') {
      const r=await fetch(`${OLLAMA_URL}/api/tags`,{timeout:5000}).catch(()=>null);
      if(!r?.ok) return send(id,'❌ Ollama offline. Run: `nastech serve`');
      const d=await r.json();
      const ms=d.models?.map(m=>`${m.name===currentModel?'▶ ':'  '}\`${m.name}\``).join('\n')||'No models';
      return send(id,`*Available Ollama Models:*\n${ms}\n\nCurrent: \`${currentModel}\``);
    }
    if (data==='st_model')   { setState(id,{waiting:'model_pick'}); return send(id,'🧠 Type model name:\n_(e.g. tinyllama, llama3.2:1b, phi3:mini)_'); }
    if (data==='st_clear')   { chatHistories[id]=[]; return send(id,'🧹 AI chat history cleared'); }
    if (data==='st_auto')    { autoReplyMode=!autoReplyMode; return send(id,`🤖 Auto-Reply Mode: ${autoReplyMode?'✅ ON — bot replies everything with AI':'❌ OFF'}`); }
    if (data==='st_apis')    return send(id, `*API Status:*\n🟢 Groq: ${GROQ_KEY?'✅':'❌'}\n🔵 OpenRouter: ${OR_KEY?'✅':'❌'}\n🟡 Gemini: ${GEM_KEY?'✅':'❌'}\n\nEdit: \`nano ~/.nastech/config.env\``);
    if (data==='st_shizuku') {
      const b=getBackend();
      if(b) return send(id,`✅ Shizuku via *${b.toUpperCase()}* — Test: \`${PHONE.shell('whoami')}\``);
      return send(id,'❌ Shizuku not connected\nRun: `nastech-reconnect`\nSee reconnected.txt for full guide');
    }
    if (data==='st_features') { // F99: Show all 99 features list
      return send(id,
        `*NasTech AI v4.1 — All 99 Features:*\n\n` +
        `*System Info (8):* Battery, Device, Storage, CPU/RAM, Processes, Network, Uptime, App stats\n\n` +
        `*Screen (7):* Screenshot, Record, Lock, Wake, Screen off, Brightness, Timeout\n\n` +
        `*Files (10):* Search, Songs, Videos, Browse, Latest photo/video/download, WA media, Screenshots, Bulk send\n\n` +
        `*Download (6):* URL, YT Audio, YT Video, Playlist, Instagram, TikTok\n\n` +
        `*Network (8):* WiFi, Mobile, Bluetooth, Airplane, Hotspot, NFC, GPS, Status\n\n` +
        `*Volume (6):* Media, Ringtone, Notification, Alarm, Mute, Unmute\n\n` +
        `*Display (8):* Dark, DND, Rotate, Night light, Invert, Brightness, Font, Timeout\n\n` +
        `*Screen Control (8):* Home, Back, Recents, Scroll, Tap, Type, UI dump, Find & tap\n\n` +
        `*Media (5):* Play, Next, Prev, Stop, Music app\n\n` +
        `*Comms (6):* Call, SMS, WhatsApp, Notification, Contacts, Location\n\n` +
        `*Apps (7):* List, Open, Kill, Clear, Uninstall, Install APK, Running\n\n` +
        `*Hardware (7):* Flashlight, Vibrate, Camera, Alarm, Timer, Clipboard, Battery saver\n\n` +
        `*Voice (3):* Transcribe, TTS phone, TTS voice reply\n\n` +
        `*AI (7):* Chat, Vision, Code, Translate, Explain, Weather, Auto-reply\n\n` +
        `*System (4):* Maps, Power off, Reboot, Status\n\n` +
        `_Total: 99 features ✅_`
      );
    }

    // Config
    if (data==='cf_token')  { setState(id,{waiting:'cf_token'});  return send(id,'🤖 Paste your *Telegram Bot Token:*\n_(from @BotFather)_\n⚠️ Private chat only!'); }
    if (data==='cf_admin')  { setState(id,{waiting:'cf_admin'});  return send(id,'👤 Paste your *Telegram User ID:*\n_(message @userinfobot)_'); }
    if (data==='cf_groq')   { setState(id,{waiting:'cf_groq'});   return send(id,'🔑 Paste your *Groq API Key:*\n_(free at groq.com)_'); }
    if (data==='cf_gemini') { setState(id,{waiting:'cf_gemini'}); return send(id,'🔑 Paste your *Gemini API Key:*\n_(free at aistudio.google.com)_'); }
    if (data==='cf_or')     { setState(id,{waiting:'cf_or'});     return send(id,'🔑 Paste your *OpenRouter API Key:*\n_(free at openrouter.ai)_'); }
    if (data==='cf_ollama') { setState(id,{waiting:'cf_ollama'}); return send(id,'🌐 Paste your *Ollama URL:*\n_(default: http://127.0.0.1:11434)_'); }
    if (data==='cf_model')  { setState(id,{waiting:'cf_model'});  return send(id,'🧠 Type default *Ollama model name:*\n_(e.g. tinyllama, llama3.2:1b)_'); }
    if (data==='cf_view') {
      try {
        const raw=fs.readFileSync(ENV_FILE,'utf8').replace(/TOKEN=[^\n]*/g,'TOKEN=***').replace(/KEY=[^\n]*/g,'KEY=***');
        return send(id,`*Config (keys hidden):*\n\`\`\`\n${raw.slice(0,2000)}\n\`\`\``);
      } catch { return send(id,'❌ Config file not found. Run: `nastech setup`'); }
    }

    // Power
    if (data==='ok_poweroff') return send(id, PHONE.poweroff());
    if (data==='ok_reboot')   return send(id, PHONE.reboot());
    if (data==='cancel')      { clearState(id); return send(id,'❌ Cancelled.'); }

    // YouTube picks (answCQ already called at top of handler)
    if (data==='yt_audio') { setState(id,{waiting:'ytdl_url',audio:true});  return send(id,'🎵 Paste YouTube URL to download as *MP3*:'); }
    if (data==='yt_video') { setState(id,{waiting:'ytdl_url',audio:false}); return send(id,'🎬 Paste YouTube URL to download as *MP4*:'); }

    // Flashlight toggle
    if (data==='fl_torch_on')  return send(id, PHONE.flashlight('on'));
    if (data==='fl_torch_off') return send(id, PHONE.flashlight('off'));

    // TTS callbacks (merged from second handler)
    if (data==='tts_phone')    { setState(id,{waiting:'tts_speak'});     return send(id,'🔊 Type text to speak on phone speaker:'); }
    if (data==='tts_send')     { setState(id,{waiting:'tts_voice'});     return send(id,'🎤 Type text — I will send back a voice message:'); }

    // Clipboard callbacks
    if (data==='clip_get')     return send(id, PHONE.clipboard());
    if (data==='clip_set')     { setState(id,{waiting:'clipboard_set'}); return send(id,'📋 Type text to copy to clipboard:'); }

    // Maps callbacks
    if (data==='map_search_btn') { setState(id,{waiting:'map_search'}); return send(id,'📍 What place to search?'); }
    if (data==='map_dir_btn')    { setState(id,{waiting:'map_dir'});    return send(id,'🚗 Directions to where?'); }
    if (data==='map_food_btn')   return send(id, PHONE.maps('restaurants near me'));
    if (data==='map_gas_btn')    return send(id, PHONE.maps('gas station near me'));
    if (data==='map_hosp_btn')   return send(id, PHONE.maps('hospital near me'));
    if (data==='map_me_btn')     { PHONE.maps('my location'); return send(id,'📌 Your location opened in Maps'); }

    // AI extra callbacks
    if (data==='ai_code_btn')    { setState(id,{waiting:'ai_code'});      return send(id,'💻 What code should I write?'); }
    if (data==='ai_trans_btn')   { setState(id,{waiting:'ai_translate'});  return send(id,'🌍 Paste text to translate:'); }
  });

  // ── MESSAGE HANDLER ─────────────────────────────────────────────────────
  bot.on('message', async msg => {
    const id   = msg.chat.id;
    const text = (msg.text||'').trim();
    if (!text || text==='/start') return;

    const state = getState(id);

    // ── State machine ────────────────────────────────────────────────────
    if (state) {
      clearState(id);

      // App control
      if (state.waiting==='app_open')   return send(id, PHONE.openApp(text));
      if (state.waiting==='app_kill')   return send(id, PHONE.killApp(text));
      if (state.waiting==='app_clear')  return send(id, PHONE.clearApp(text));
      if (state.waiting==='app_unins')  return send(id, PHONE.uninstall(text));
      if (state.waiting==='model_pick') { currentModel=text; return send(id,`✅ Model: \`${text}\``); }

      // APK install
      if (state.waiting==='apk_url') {
        send(id,'📦 Downloading APK...');
        return send(id, await PHONE.installApk(text));
      }

      // Comms
      if (state.waiting==='call_num')  return send(id, PHONE.call(text));
      if (state.waiting==='sms_num')   { const[n,...r]=text.split(' '); return send(id, PHONE.sms(n,r.join(' '))); }
      if (state.waiting==='wa_num')    { const[n,...r]=text.split(' '); return send(id, PHONE.wa(n,r.join(' '))); }
      if (state.waiting==='notif_msg') { const[t,...r]=text.split('|'); return send(id, PHONE.notify(t.trim(),r.join('|').trim()||t.trim())); }

      // Files
      if (state.waiting==='search_files') {
        send(id,`🔍 Searching: *${text}*...`);
        const res=searchStorage(text);
        if(!res.length) return send(id,`❌ Nothing found for: "${text}"`);
        const list=res.slice(0,10).map((f,i)=>`${i+1}. ${fileEmoji(f.ext)} \`${f.name}\` (${fmtSize(f.size)})`).join('\n');
        return send(id,`*Found ${res.length} files:*\n${list}`);
      }
      if (state.waiting==='song_name') {
        send(id,`🎵 Searching: *${text}*...`);
        const res=searchStorage(text,AUDIO,3);
        if(res.length){uploading(id);const p=await pullFile(res[0].path);if(p.ok){send(id,`📤 Sending: \`${res[0].name}\``);return await sendFile(bot,id,p.localPath,`🎵 ${res[0].name}`);}}
        return send(id,`❌ Not found: "${text}"\nTap *▶️ YouTube DL* to download instead`);
      }
      if (state.waiting==='video_name') {
        send(id,`🎬 Searching: *${text}*...`);
        const res=searchStorage(text,VIDEO,3);
        if(res.length){uploading(id);const p=await pullFile(res[0].path);if(p.ok)return await sendFile(bot,id,p.localPath,`🎬 ${res[0].name}`);}
        return send(id,`❌ Not found: "${text}"\nTap *▶️ YouTube DL* to download`);
      }

      // Downloads
      if (state.waiting==='download_url') {
        send(id,'⬇️ Downloading...'); uploading(id);
        const r=await downloadURL(text,DL_DIR);
        if(!r.ok) return send(id,`❌ Failed: ${r.error}`);
        send(id,`✅ Got: \`${r.name}\` (${fmtSize(r.size)})\nSending...`);
        const sent=await sendFile(bot,id,r.path,`📁 ${r.name}`);
        if(!sent) send(id,`Saved: \`${r.path}\``);
        return;
      }
      if (state.waiting==='ytdl_url') {
        const isAudio=state.audio!==false;
        send(id,`${isAudio?'🎵':'🎬'} Downloading... _(may take a minute)_`); uploading(id);
        const r=await ytDlp(text,isAudio,DL_DIR);
        if(!r.ok) return send(id,`❌ Failed: ${r.error}\n\nFix: \`pip install yt-dlp\``);
        send(id,`✅ Got: \`${r.name}\`\nSending...`);
        const sent=await sendFile(bot,id,r.path,`${isAudio?'🎵':'🎬'} ${r.name}`);
        if(!sent) send(id,`Saved: \`${r.path}\``);
        return;
      }

      // Screen interactions
      if (state.waiting==='tap_coords') { const[x,y]=text.split(/[ ,]+/); return send(id, PHONE.tap(x,y)); }
      if (state.waiting==='type_text')  return send(id, PHONE.typeText(text));
      if (state.waiting==='findtap')    return send(id, PHONE.findTap(text));
      if (state.waiting==='chrome_url') {
        const url=text.startsWith('http')?text:text.includes(' ')?`https://google.com/search?q=${encodeURIComponent(text)}`:`https://${text}`;
        return send(id, PHONE.chrome(url));
      }

      // Shell
      if (state.waiting==='shell_cmd') {
        if(!isAdmin(id)) return send(id,'❌ Admin only');
        return send(id,`\`\`\`\n${PHONE.shell(text).slice(0,3500)}\n\`\`\``);
      }

      // Alarms
      if (state.waiting==='alarm_time') return send(id, PHONE.alarm(text));
      if (state.waiting==='timer_secs') return send(id, PHONE.timer(parseInt(text)||60));

      // Maps
      if (state.waiting==='map_search') return send(id, PHONE.maps(text));
      if (state.waiting==='map_dir')    return send(id, PHONE.directions(text));

      // Clipboard
      if (state.waiting==='clipboard_set') return send(id, PHONE.clipboard(text));

      // TTS speak
      if (state.waiting==='tts_speak')  return send(id, ttsSpeak(text));
      if (state.waiting==='tts_voice')  { send(id,'🔊 Generating voice...'); const ok=await ttsSendVoice(bot,id,text); if(!ok) send(id,ttsSpeak(text)); return; }

      // Weather
      if (state.waiting==='weather_loc') { send(id,'🌤 Checking weather...'); return send(id, await PHONE.weather(text)); }

      // AI states
      if (state.waiting==='ai_chat') {
        typing(id);
        const r=await aiChat(text,id);
        return send(id, r.content.slice(0,4096)+`\n_[${r.provider} • ${currentModel}]_`);
      }
      if (state.waiting==='ai_code') {
        typing(id);
        const r=await aiChat(`Write code for: ${text}`,id,'You are NasTech AI — an expert programmer. Write clean, working code with brief explanation. Use code blocks.');
        return send(id, r.content.slice(0,4096));
      }
      if (state.waiting==='ai_translate') {
        typing(id);
        const r=await aiChat(text,id,'You are NasTech AI translator. Detect the source language and translate to English (or if already English, translate to Spanish). Show both original and translation.');
        return send(id, r.content.slice(0,4096));
      }

      // Flashlight off (safety net for any lingering state)
      if (state.waiting==='flash_off_confirm') {
        sh('termux-torch off 2>/dev/null',{timeout:5000});
        return send(id,'💡 Flashlight OFF');
      }

      // Config inputs
      const cfgMap = { cf_token:'TELEGRAM_BOT_TOKEN', cf_admin:'TELEGRAM_ADMIN_ID', cf_groq:'GROQ_API_KEY', cf_gemini:'GEMINI_API_KEY', cf_or:'OPENROUTER_API_KEY', cf_ollama:'OLLAMA_URL', cf_model:null };
      if (cfgMap.hasOwnProperty(state.waiting)) {
        if (state.waiting==='cf_model') { currentModel=text; return send(id,`✅ Default model: \`${text}\``); }
        const k=cfgMap[state.waiting];
        if(saveConfig(k,text)) return send(id,`✅ *${k}* saved!\n\n_Restart bot:_ \`pkill -f nastech_bot && nastech bot\``);
        return send(id,`❌ Save failed. Edit manually:\n\`nano ~/.nastech/config.env\``);
      }
    }

    // ── Button text matching ─────────────────────────────────────────────
    switch (text) {
      // Row 1 — Info
      case '🔋 Battery':       return send(id, PHONE.battery());
      case '📱 Device Info':   return send(id, PHONE.info());
      case '💾 Storage':       return send(id, PHONE.storage());

      // Row 2 — Screen actions
      case '📸 Screenshot': {
        send(id,'📸 Taking screenshot...');
        uploading(id);
        const fp=PHONE.screenshot();
        await new Promise(r=>setTimeout(r,1500));
        const pi=await pullFile(fp);
        if(pi.ok) await sendFile(bot,id,pi.localPath,'📸 NasTech Screenshot');
        else send(id,`📸 Saved: \`${fp}\``);
        return;
      }
      case '🎬 Record Screen': {
        send(id,'🎬 Recording 10 seconds...');
        const rf=PHONE.record(10);
        await new Promise(r=>setTimeout(r,12000));
        uploading(id);
        const pr=await pullFile(rf);
        if(pr.ok) await sendFile(bot,id,pr.localPath,'🎬 NasTech Recording');
        else send(id,`🎬 Saved: \`${rf}\``);
        return;
      }
      case '🔒 Lock Screen': return send(id, PHONE.lock());

      // Row 3 — Files
      case '🎵 Send Song':   setState(id,{waiting:'song_name'});  return send(id,'🎵 Song name or artist:');
      case '🎬 Send Video':  setState(id,{waiting:'video_name'}); return send(id,'🎬 Video name or keyword:');
      case '📁 Browse Files':return sendInline(id,'📁 *Browse Storage:*\nChoose folder:', KB.files());

      // Row 4 — Quick files
      case '📷 Latest Photo': {
        uploading(id);
        send(id,'📷 Getting latest photo...');
        const f=latestFile(['/sdcard/DCIM','/sdcard/Pictures'],IMAGE);
        if(!f) return send(id,'❌ No photos found');
        await sendFile(bot,id,f.path,`📷 ${f.name}`);
        return;
      }
      case '🎞 Latest Video': {
        uploading(id);
        send(id,'🎞 Getting latest video...');
        const f=latestFile(['/sdcard/DCIM','/sdcard/Movies','/sdcard/Videos'],VIDEO);
        if(!f) return send(id,'❌ No videos found');
        await sendFile(bot,id,f.path,`🎞 ${f.name}`);
        return;
      }
      case '📂 Last Download': {
        uploading(id);
        send(id,'📂 Getting last download...');
        const f=latestFile([DL_DIR,'/sdcard/Download'],null);
        if(!f) return send(id,'❌ No downloads found');
        await sendFile(bot,id,f.path,`📂 ${f.name}`);
        return;
      }

      // Row 5 — Downloads
      case '⬇️ Download URL': setState(id,{waiting:'download_url'}); return send(id,'⬇️ *Paste URL to download:*\n_(Any direct link — MP3, ZIP, APK, image...)_');
      case '▶️ YouTube DL':   setState(id,{waiting:'ytdl_url',audio:true}); return sendInline(id,'▶️ *YouTube Download*\nPaste URL, then choose:', KB.ytdl());
      case '🌐 Open Chrome':  setState(id,{waiting:'chrome_url'}); return send(id,'🌐 Type URL or Google search:');

      // Row 6 — Network/Volume/Display
      case '📶 WiFi':         return sendInline(id,'📶 *Network Controls:*', KB.wifi());
      case '🔊 Volume':       return sendInline(id,'🔊 *Volume Controls:*',  KB.volume());
      case '💡 Display':      return sendInline(id,'💡 *Display Controls:*', KB.display());

      // Row 7
      case '🖥 Screen Control': return sendInline(id,'🖥 *Screen Control:*', KB.screen());
      case '🎮 Media Keys':     return sendInline(id,'🎮 *Media Controls:*', KB.media());
      case '🔦 Flashlight':
        return sendInline(id,'🔦 *Flashlight Control:*', { inline_keyboard:[
          [{ text:'🔦 Flashlight ON',  callback_data:'fl_torch_on'  },
           { text:'💡 Flashlight OFF', callback_data:'fl_torch_off' }],
          [{ text:'ℹ️ Requires Termux:API app (F-Droid)', callback_data:'cancel'}],
        ]});

      // Row 8
      case '📞 Calls & SMS': return sendInline(id,'📞 *Communication:*', KB.comms());
      case '📱 Apps':        return sendInline(id,'📱 *App Controls:*',  KB.apps());
      case '🧠 Ask AI':      setState(id,{waiting:'ai_chat'}); return send(id,'🧠 What do you want to ask?\n_Type anything — code, questions, tasks..._');

      // Row 9
      case '🗺 Maps': {
        return sendInline(id,'🗺 *Maps & Navigation:*', { inline_keyboard:[
          [{ text:'🔍 Search Place', callback_data:'map_search_btn'}, { text:'🚗 Directions', callback_data:'map_dir_btn'}],
          [{ text:'🍕 Restaurants',  callback_data:'map_food_btn' }, { text:'⛽ Gas Station', callback_data:'map_gas_btn'}],
          [{ text:'🏥 Hospital',     callback_data:'map_hosp_btn' }, { text:'📌 My Location', callback_data:'map_me_btn'}],
        ]});
      }
      case '💚 WhatsApp':   setState(id,{waiting:'wa_num'}); return send(id,'💚 Type: *number message*\n_e.g. +1234567890 Hello!_');
      case '🌤 Weather':    setState(id,{waiting:'weather_loc'}); return send(id,'🌤 Type city or location:\n_(or just press Enter for auto)_');

      // Row 10
      case '📋 Clipboard': {
        return sendInline(id,'📋 *Clipboard:*',{ inline_keyboard:[
          [{ text:'📋 Get Clipboard', callback_data:'clip_get'}, { text:'✏️ Set Clipboard', callback_data:'clip_set'}],
        ]});
      }
      case '⏰ Alarm & Timer': return sendInline(id,'⏰ *Alarm & Timer:*', KB.alarms());
      case '📍 My Location':   { const r=runPhone('content query --uri content://telephony/carriers 2>/dev/null||ip route get 1.1.1.1 2>/dev/null'); PHONE.maps('my location'); return send(id,`📍 Maps opened at your location\n${r.ok?r.out.slice(0,200):''}`); }

      // Row 11
      case '🎤 Voice Mode': {
        return send(id,
          '🎤 *Voice Mode Active*\n\n' +
          'Send a *voice note* 🎤 in this chat and I will:\n' +
          '1️⃣ Transcribe it automatically\n' +
          '2️⃣ Process it as an AI command\n' +
          '3️⃣ Speak the reply on your phone\n\n' +
          '_Requires GROQ_API_KEY for transcription_\n' +
          '_Requires espeak for phone speaker_'
        );
      }
      case '🔊 TTS Speak': {
        return sendInline(id,'🔊 *Text-to-Speech:*',{ inline_keyboard:[
          [{ text:'🔊 Speak on Phone',       callback_data:'tts_phone'}],
          [{ text:'🎤 Send Voice Message',    callback_data:'tts_send' }],
        ]});
      }
      case '📸 AI Vision': {
        send(id,'📸 *AI Vision*\n\nTaking screenshot and analyzing...');
        const fp=PHONE.screenshot();
        await new Promise(r=>setTimeout(r,1500));
        const pi=await pullFile(fp);
        if(!pi.ok) return send(id,'❌ Screenshot failed');
        typing(id);
        send(id,'🧠 Analyzing screen with AI...');
        const desc=await PHONE.aiVision(bot,id,pi.localPath);
        return send(id,`📸 *AI Vision — What I see:*\n${desc}`);
      }

      // Row 12
      case '⚙️ More Controls': return sendInline(id,'⚙️ *More Controls:*', KB.more());
      case '🔴 Power Off':      return sendInline(id,'⚠️ *Power OFF the phone?*', KB.confirm('poweroff'));
      case '🔄 Reboot':         return sendInline(id,'⚠️ *Reboot the phone?*',    KB.confirm('reboot'));

      // Row 13
      case '📊 Status': {
        const ollamaOk=await fetch(`${OLLAMA_URL}/api/tags`,{timeout:3000}).then(r=>r.ok).catch(()=>false);
        const b=getBackend();
        const dlCount=fs.existsSync(DL_DIR)?fs.readdirSync(DL_DIR).length:0;
        const bat=runPhone('dumpsys battery|grep level').out||'?';
        return send(id,
          `*📊 NasTech AI v4.1 — Status*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🤖 Ollama:  ${ollamaOk?'✅ Running':'❌ Offline'}\n` +
          `📱 Shizuku: ${b?`✅ ${b.toUpperCase()}`:'❌ Not connected'}\n` +
          `🧠 Model:   \`${currentModel}\`\n` +
          `🔑 Groq: ${GROQ_KEY?'✅':'❌'} OR: ${OR_KEY?'✅':'❌'} Gem: ${GEM_KEY?'✅':'❌'}\n` +
          `🔋 Battery: ${bat}\n` +
          `📁 Downloads: ${dlCount} files\n` +
          `💬 AI turns: ${Math.floor((chatHistories[id]||[]).length/2)}\n` +
          `🔊 Auto-reply: ${autoReplyMode?'✅ ON':'❌ OFF'}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `_Built by NasTech © 2025_`
        );
      }
      case '🔧 Config Setup':  return sendInline(id,'🔧 *NasTech Config Setup:*', KB.config());
      case '❌ Cancel':         clearState(id); return send(id,'✅ Cancelled.');

      // Row 14
      case '📝 Run Command':
        if(!isAdmin(id)) return send(id,'❌ Admin only');
        setState(id,{waiting:'shell_cmd'});
        return send(id,'📝 *Type any shell/ADB command:*');
      case '🔌 Reconnect': {
        const b=getBackend();
        if(b) return send(id,`✅ Shizuku via *${b.toUpperCase()}* — OK`);
        const r=sh('nastech-reconnect 2>/dev/null',{timeout:10000});
        return send(id, r.ok&&r.out?r.out.slice(0,500):'❌ Run: `nastech-reconnect` in Termux\nSee `cat ~/NasTech/reconnected.txt`');
      }
      case '⚙️ Settings': return sendInline(id,'⚙️ *Settings:*', KB.settings());

      default: break;
    }

    // Extra inline callbacks via message
    if (text==='map_search_btn'||text==='map_dir_btn') {
      setState(id,{waiting:text==='map_search_btn'?'map_search':'map_dir'});
      return send(id,text==='map_search_btn'?'📍 What place to search?':'🚗 Where to get directions?');
    }

    // ── Auto-reply mode (F95) ────────────────────────────────────────────
    if (autoReplyMode && isAdmin(id)) {
      typing(id);
      const r=await aiChat(text,id);
      return send(id, r.content.slice(0,4096)+`\n_[auto-reply • ${r.provider}]_`);
    }

    // ── Natural language AI fallback (F89) ───────────────────────────────
    typing(id);
    const r=await aiChat(text,id);
    send(id, r.content.slice(0,4096)+`\n_[${r.provider} • ${currentModel}]_`);
  });

  console.log(`\x1b[36m\x1b[1m🤖 NasTech AI v4.1 — 99 Features running\x1b[0m\nModel: ${currentModel} | Admin: ${ADMIN_ID||'not set'}`);
  blog('NasTech Bot v4.1 started');
}

// ── CLI mode ──────────────────────────────────────────────────────────────────
async function startCLI() {
  const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
  console.log('\x1b[36m\x1b[1m🤖 NasTech AI CLI — type exit to quit\x1b[0m');
  const prompt=()=>rl.question('\x1b[36mnastech>\x1b[0m ',async t=>{
    t=t.trim();
    if(!t) return prompt();
    if(t==='exit') process.exit(0);
    const r=await aiChat(t,'cli');
    console.log(`\n\x1b[32m${r.content}\x1b[0m\n\x1b[2m[${r.provider}]\x1b[0m\n`);
    prompt();
  });
  prompt();
}

// ── Process Stability & Crash Notifications ───────────────────────────────────
const _tgNotify = (msg) => {
  if (!TOKEN || !ADMIN_ID) return;
  fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_ID, text: msg })
  }).catch(() => {});
};

process.on('uncaughtException', (err) => {
  blog(`CRASH uncaughtException: ${err.message}\n${err.stack}`);
  _tgNotify(`⚠️ NasTech bot error (non-fatal):\n${err.message}\n\nBot is still running.\nCheck logs: nastech log`);
});

process.on('unhandledRejection', (reason) => {
  blog(`WARN unhandledRejection: ${reason}`);
});

process.on('SIGTERM', () => {
  blog('NasTech bot stopped (SIGTERM)');
  _tgNotify('🔴 NasTech bot stopped (SIGTERM).\nRestart: nastech bot\nAuto-restart: nastech watch');
  process.exit(0);
});

process.on('SIGINT', () => {
  blog('NasTech bot stopped (SIGINT)');
  process.exit(0);
});

process.on('exit', (code) => {
  blog(`NasTech bot exited (code ${code})`);
});

// ── Entry ─────────────────────────────────────────────────────────────────────
const mode=(process.argv.find(a=>a.startsWith('--mode='))?.split('=')?.[1])||'bot';
(async()=>{
  if (mode==='cli')     await startCLI();
  else if (mode==='copilot') { const r=await aiChat(process.argv.slice(2).join(' ').replace(/--mode=\S+/g,'').trim(),'cli'); console.log(r.content); process.exit(0); }
  else startBot();
})().catch(e=>{ console.error('❌ NasTech Error:',e.message); process.exit(1); });
