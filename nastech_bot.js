#!/usr/bin/env node
'use strict';
// =============================================================================
// 🤖 NasTech AI v4.0 — Full Button Keyboard UI
// All controls via Telegram keyboard buttons — no slash commands needed
// =============================================================================

require('dotenv').config({ path: require('os').homedir() + '/.nastech/config.env' });

const TelegramBot  = require('node-telegram-bot-api');
const { execSync, exec } = require('child_process');
const fetch        = require('node-fetch');
const fs           = require('fs');
const path         = require('path');
const readline     = require('readline');
const os           = require('os');

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN      = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_ID   = parseInt(process.env.TELEGRAM_ADMIN_ID || '0');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const GROQ_KEY   = process.env.GROQ_API_KEY || '';
const OR_KEY     = process.env.OPENROUTER_API_KEY || '';
const GEM_KEY    = process.env.GEMINI_API_KEY || '';
const HOME       = os.homedir();
const DL_DIR     = `${HOME}/.nastech/downloads`;
const LOG_FILE   = `${HOME}/.nastech/nastech.log`;
const TMP_DIR    = `${HOME}/.nastech/tmp`;

[DL_DIR, TMP_DIR, `${HOME}/.nastech`].forEach(d => {
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch {}
});

// ─── State machine — tracks what each user is waiting for ────────────────────
// e.g. userState[chatId] = { waiting: 'song_name' }
const userState    = {};
let   currentModel = process.env.DEFAULT_MODEL || 'llama3.2:1b';
const chatHistories = {};

// ─── Logging ──────────────────────────────────────────────────────────────────
const blog = m => { try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${m}\n`); } catch {} };

// =============================================================================
// ── KEYBOARD LAYOUTS ─────────────────────────────────────────────────────────
// =============================================================================

// Main persistent keyboard (shown at bottom of chat always)
const MAIN_KB = {
  keyboard: [
    ['🔋 Battery',    '📱 Device Info',  '💾 Storage'],
    ['📸 Screenshot', '🎬 Record Screen','🔒 Lock Screen'],
    ['🎵 Send Song',  '🎬 Send Video',   '📁 Browse Files'],
    ['⬇️ Download',   '▶️ YouTube DL',   '🌐 Open Chrome'],
    ['📶 WiFi',       '🔊 Volume',       '💡 Display'],
    ['📞 Calls & SMS','📱 Apps',         '🧠 Ask AI'],
    ['🔴 Power Off',  '🔄 Reboot',       '📊 Status'],
    ['⚙️ Settings',   '📝 Run Command',  '❌ Cancel'],
  ],
  resize_keyboard: true,
  persistent: true,
};

// Inline sub-keyboards
function wifiKB() {
  return { inline_keyboard: [
    [{ text:'📶 WiFi ON',  callback_data:'wifi_on'  }, { text:'📶 WiFi OFF', callback_data:'wifi_off' }],
    [{ text:'📡 Mobile ON',callback_data:'mob_on'   }, { text:'📡 Mobile OFF',callback_data:'mob_off'  }],
    [{ text:'🔵 BT ON',    callback_data:'bt_on'    }, { text:'🔵 BT OFF',   callback_data:'bt_off'   }],
    [{ text:'✈️ Airplane ON',callback_data:'air_on' }, { text:'✈️ Airplane OFF',callback_data:'air_off'}],
    [{ text:'🌐 Hotspot ON',callback_data:'hot_on'  }, { text:'🌐 Hotspot OFF',callback_data:'hot_off' }],
    [{ text:'📶 WiFi Status',callback_data:'wifi_status'}],
  ]};
}
function volumeKB() {
  return { inline_keyboard: [
    [{ text:'🔊 Vol+1',  callback_data:'vol_up1'  }, { text:'🔊 Vol+3',  callback_data:'vol_up3'  }, { text:'🔊 Vol+5',  callback_data:'vol_up5'  }],
    [{ text:'🔉 Vol-1',  callback_data:'vol_dn1'  }, { text:'🔉 Vol-3',  callback_data:'vol_dn3'  }, { text:'🔉 Vol-5',  callback_data:'vol_dn5'  }],
    [{ text:'🔇 Mute',   callback_data:'vol_mute' }, { text:'🔔 Unmute', callback_data:'vol_unmute'}],
  ]};
}
function displayKB() {
  return { inline_keyboard: [
    [{ text:'🌙 Dark ON',  callback_data:'dark_on'  }, { text:'☀️ Dark OFF', callback_data:'dark_off' }],
    [{ text:'🔕 DND ON',   callback_data:'dnd_on'   }, { text:'🔔 DND OFF',  callback_data:'dnd_off'  }],
    [{ text:'🔄 Rotation ON',callback_data:'rot_on' }, { text:'🔄 Rotation OFF',callback_data:'rot_off'}],
    [{ text:'☀️ Bright MAX',callback_data:'bright_max'},{ text:'🌑 Bright MIN',callback_data:'bright_min'}],
    [{ text:'☀️ Bright 50%',callback_data:'bright_mid'}],
  ]};
}
function appsKB() {
  return { inline_keyboard: [
    [{ text:'📋 List All Apps',   callback_data:'apps_list'    }],
    [{ text:'▶️ Open App',        callback_data:'apps_open'    }, { text:'💀 Kill App',  callback_data:'apps_kill'  }],
    [{ text:'🧹 Clear App Data',  callback_data:'apps_clear'   }, { text:'📦 List APKs', callback_data:'apps_apks'  }],
    [{ text:'🏃 Running Apps',    callback_data:'apps_running' }],
  ]};
}
function commsKB() {
  return { inline_keyboard: [
    [{ text:'📞 Make Call',     callback_data:'comm_call'  }],
    [{ text:'💬 Send SMS',      callback_data:'comm_sms'   }],
    [{ text:'💚 WhatsApp',      callback_data:'comm_wa'    }],
    [{ text:'🔔 Send Notification', callback_data:'comm_notif'}],
  ]};
}
function filesKB(dirPath = '/sdcard') {
  return { inline_keyboard: [
    [{ text:'📥 Downloads',  callback_data:`ls_/sdcard/Download`     }, { text:'🎵 Music',  callback_data:`ls_/sdcard/Music`     }],
    [{ text:'🖼 Pictures',   callback_data:`ls_/sdcard/Pictures`     }, { text:'🎬 Movies', callback_data:`ls_/sdcard/Movies`    }],
    [{ text:'📸 DCIM',       callback_data:`ls_/sdcard/DCIM`         }, { text:'📄 Docs',   callback_data:`ls_/sdcard/Documents` }],
    [{ text:'💚 WhatsApp',   callback_data:`ls_/sdcard/WhatsApp/Media`},{ text:'📦 APKs',   callback_data:'find_apks'            }],
    [{ text:'🔍 Search All', callback_data:'search_prompt'           }],
  ]};
}
function settingsKB() {
  return { inline_keyboard: [
    [{ text:'🧠 Models List',   callback_data:'set_models'    }],
    [{ text:'🔄 Change Model',  callback_data:'set_model_pick'}],
    [{ text:'🧹 Clear AI Chat', callback_data:'set_clear'     }],
    [{ text:'🔑 Check APIs',    callback_data:'set_apis'      }],
    [{ text:'🔌 Reconnect Shizuku', callback_data:'set_shizuku'}],
    [{ text:'📋 All Commands',  callback_data:'set_allcmds'   }],
  ]};
}
function confirmKB(action) {
  return { inline_keyboard: [
    [{ text:`✅ YES — ${action}`, callback_data:`confirm_${action}` }, { text:'❌ Cancel', callback_data:'cancel' }],
  ]};
}

// =============================================================================
// ── SHELL / PHONE ─────────────────────────────────────────────────────────────
// =============================================================================

function sh(cmd, opts = {}) {
  try {
    return { ok: true, out: execSync(cmd, { timeout: opts.timeout || 30000, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim() };
  } catch(e) { return { ok: false, out: (e.stderr || '').trim() || e.message }; }
}
function shAsync(cmd, ms = 120000) {
  return new Promise(resolve => exec(cmd, { timeout: ms, encoding: 'utf8' }, (e, o, r) => resolve({ ok: !e, out: (o || r || '').trim() })));
}
function getBackend() {
  if (sh('command -v rish').ok && sh('rish -c whoami 2>/dev/null', {timeout:3000}).ok) return 'rish';
  if (sh('adb get-state 2>/dev/null', {timeout:3000}).ok) return 'adb';
  if (sh('command -v su').ok) return 'su';
  return null;
}
function runPhone(cmd) {
  const b = getBackend();
  if (!b) return { ok: false, out: '❌ Shizuku not connected.\nRun: *nastech-reconnect*' };
  const w = cmd.replace(/"/g, '\\"');
  return sh(b === 'rish' ? `rish -c "${w}"` : b === 'adb' ? `adb shell "${w}"` : `su -c "${w}"`, { timeout: 20000 });
}

// =============================================================================
// ── FILE MANAGER ──────────────────────────────────────────────────────────────
// =============================================================================

const AUDIO_EXT = ['.mp3','.flac','.wav','.aac','.ogg','.m4a','.opus','.wma'];
const VIDEO_EXT = ['.mp4','.mkv','.avi','.mov','.3gp','.webm','.m4v','.wmv'];
const IMAGE_EXT = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.heic','.heif'];
const DOC_EXT   = ['.pdf','.doc','.docx','.txt','.xlsx','.xls','.ppt','.pptx','.zip','.apk'];

function fmtSize(b) {
  if (!b) return '?';
  const u = ['B','KB','MB','GB'], i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}
function fileEmoji(ext) {
  if (AUDIO_EXT.includes(ext)) return '🎵';
  if (VIDEO_EXT.includes(ext)) return '🎬';
  if (IMAGE_EXT.includes(ext)) return '🖼';
  if (ext==='.pdf')  return '📕'; if (ext==='.apk') return '📦';
  if (['.zip','.rar'].includes(ext)) return '🗜'; if (['.txt','.md'].includes(ext)) return '📝';
  if (['.doc','.docx'].includes(ext)) return '📄'; if (['.xlsx','.xls'].includes(ext)) return '📊';
  return '📁';
}
function searchStorage(q, exts = null, max = 15) {
  const lq = (q||'').toLowerCase();
  const results = [];
  const findCmd = exts
    ? `find /sdcard -maxdepth 8 \\( ${exts.map(e=>`-iname "*${e}"`).join(' -o ')} \\) ${q?`-iname "*${lq}*"`:''} 2>/dev/null | head -${max}`
    : `find /sdcard -maxdepth 8 -iname "*${lq}*" 2>/dev/null | head -${max}`;
  const r = sh(findCmd, { timeout: 15000 });
  if (r.ok && r.out) {
    for (const line of r.out.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const ext = path.extname(t).toLowerCase();
      if (!exts || exts.includes(ext)) {
        let size = 0;
        try { const tp = t.replace('/sdcard/', `${HOME}/storage/shared/`); if (fs.existsSync(tp)) size = fs.statSync(tp).size; } catch {}
        results.push({ path: t, name: path.basename(t), ext, size });
      }
    }
  }
  // Also scan Termux storage mount
  const dirs = [
    `${HOME}/storage/shared`, `${HOME}/storage/music`, `${HOME}/storage/downloads`,
    `${HOME}/storage/pictures`, `${HOME}/storage/movies`,
  ].filter(d => { try { return fs.existsSync(d); } catch { return false; } });
  function scan(dir, depth = 0) {
    if (depth > 5 || results.length >= max) return;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (results.length >= max) break;
        const fp = path.join(dir, e.name);
        const nm = e.name.toLowerCase();
        if (e.isDirectory()) { if (!nm.startsWith('.') && !['android','data','obb'].includes(nm)) scan(fp, depth+1); }
        else {
          const ext = path.extname(e.name).toLowerCase();
          if ((!exts || exts.includes(ext)) && (!q || nm.includes(lq)) && !results.find(x => x.name === e.name)) {
            try { results.push({ path: fp, name: e.name, ext, size: fs.statSync(fp).size }); } catch {}
          }
        }
      }
    } catch {}
  }
  dirs.forEach(d => scan(d));
  return results.slice(0, max);
}
async function pullFile(androidPath) {
  const fname = path.basename(androidPath);
  const dest  = path.join(TMP_DIR, fname);
  const tries = [
    androidPath,
    androidPath.replace('/sdcard/', `${HOME}/storage/shared/`),
    androidPath.replace('/storage/emulated/0/', `${HOME}/storage/shared/`),
  ];
  for (const tp of tries) {
    try { if (fs.existsSync(tp) && fs.statSync(tp).size > 0) { fs.copyFileSync(tp, dest); return { ok: true, localPath: dest, name: fname }; } } catch {}
  }
  const r = await shAsync(`adb pull "${androidPath}" "${dest}" 2>/dev/null`, 30000);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return { ok: true, localPath: dest, name: fname };
  return { ok: false, name: fname, error: 'Cannot access file' };
}
async function sendFileTelegram(bot, chatId, filePath, caption = '') {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return false;
  if (stat.size > 50 * 1024 * 1024) {
    await bot.sendMessage(chatId, `⚠️ File too large (${fmtSize(stat.size)}). Telegram limit is 50MB.`, { reply_markup: MAIN_KB });
    return false;
  }
  const ext  = path.extname(filePath).toLowerCase();
  const opts = { caption: caption || path.basename(filePath) };
  try {
    if (AUDIO_EXT.includes(ext))      await bot.sendAudio(chatId,    fs.createReadStream(filePath), opts);
    else if (VIDEO_EXT.includes(ext)) await bot.sendVideo(chatId,    fs.createReadStream(filePath), opts);
    else if (IMAGE_EXT.includes(ext)) await bot.sendPhoto(chatId,    fs.createReadStream(filePath), { caption: opts.caption });
    else                              await bot.sendDocument(chatId, fs.createReadStream(filePath), opts);
    return true;
  } catch { try { await bot.sendDocument(chatId, fs.createReadStream(filePath), opts); return true; } catch { return false; } }
}
async function downloadURL(url, dir = DL_DIR, fname = '') {
  const name = fname || decodeURIComponent(path.basename(url.split('?')[0])) || `file_${Date.now()}`;
  const dest = path.join(dir, name);
  const r = await shAsync(`curl -L --max-time 120 --retry 2 -o "${dest}" "${url}" 2>&1`, 130000);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return { ok: true, path: dest, name, size: fs.statSync(dest).size };
  return { ok: false, error: r.out.slice(-300) };
}
async function ytDlp(url, audioOnly = true, dir = DL_DIR) {
  if (!sh('command -v yt-dlp').ok) sh('pip install -q yt-dlp 2>/dev/null || pip3 install -q yt-dlp 2>/dev/null');
  const tpl = path.join(dir, '%(title)s.%(ext)s');
  const flags = audioOnly ? `-x --audio-format mp3 --audio-quality 0` : `-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"`;
  const r = await shAsync(`yt-dlp ${flags} --no-playlist --max-filesize 48m --output "${tpl}" "${url}" 2>&1`, 180000);
  const line = r.out.split('\n').find(l => l.includes('[download] Destination:') || l.includes('[Merger]'));
  if (line) {
    const fp = line.replace(/\[download\] Destination: |\[Merger\] Merging formats into "|"$/g,'').trim();
    if (fs.existsSync(fp)) return { ok: true, path: fp, name: path.basename(fp) };
  }
  try {
    const files = fs.readdirSync(dir).map(f => ({ f, t: fs.statSync(path.join(dir,f)).mtime.getTime() })).sort((a,b)=>b.t-a.t);
    if (files.length && Date.now()-files[0].t < 300000) return { ok: true, path: path.join(dir,files[0].f), name: files[0].f };
  } catch {}
  return { ok: false, error: r.out.slice(-400) };
}

// =============================================================================
// ── PHONE CONTROL ─────────────────────────────────────────────────────────────
// =============================================================================

const PHONE = {
  battery() {
    const r = runPhone('dumpsys battery');
    if (!r.ok) return r.out;
    const lvl  = r.out.match(/level: (\d+)/)?.[1] ?? '?';
    const stat = r.out.match(/status: (\d+)/)?.[1];
    const plug = stat==='2'?'⚡ Charging':stat==='5'?'⚡ Full':'🔋 Discharging';
    const temp = r.out.match(/temperature: (\d+)/)?.[1];
    const volt = r.out.match(/voltage: (\d+)/)?.[1];
    return `🔋 *Battery*\nLevel: *${lvl}%* (${plug})\n🌡 Temp: ${temp?(parseInt(temp)/10).toFixed(1)+'°C':'N/A'}\n⚡ Voltage: ${volt?parseInt(volt)/1000+'V':'N/A'}`;
  },
  info() {
    const g = p => runPhone(`getprop ${p}`).out || 'N/A';
    const ram = runPhone('cat /proc/meminfo | grep MemTotal').out;
    const ramMb = ram ? Math.round(parseInt(ram.match(/\d+/)?.[0]||0)/1024)+' MB' : 'N/A';
    return `📱 *Device Info*\nBrand:   ${g('ro.product.brand')}\nModel:   ${g('ro.product.model')}\nAndroid: ${g('ro.build.version.release')} (SDK ${g('ro.build.version.sdk')})\nCPU:     ${g('ro.product.cpu.abi')}\nRAM:     ${ramMb}\nSerial:  ${g('ro.serialno')}`;
  },
  storage() {
    const r = runPhone('df -h /sdcard 2>/dev/null');
    const dl = runPhone('du -sh /sdcard/Download 2>/dev/null').out;
    const mu = runPhone('du -sh /sdcard/Music 2>/dev/null').out;
    return `💾 *Storage*\n${r.out||'N/A'}\n📥 Downloads: ${dl||'?'}\n🎵 Music: ${mu||'?'}`;
  },
  wifi(s)        { runPhone(s==='on'?'svc wifi enable':'svc wifi disable'); return `📶 WiFi ${s.toUpperCase()}`; },
  wifiStatus()   { return `📶 WiFi: ${runPhone('dumpsys wifi | grep mWifiState').out || runPhone('getprop init.svc.wpa_supplicant').out || 'Unknown'}`; },
  bluetooth(s)   { runPhone(`input keyevent ${s==='on'?138:139}`); return `🔵 Bluetooth ${s.toUpperCase()}`; },
  mobile(s)      { runPhone(s==='on'?'svc data enable':'svc data disable'); return `📡 Mobile data ${s.toUpperCase()}`; },
  airplane(s)    { runPhone(`settings put global airplane_mode_on ${s==='on'?1:0}`); return `✈️ Airplane mode ${s.toUpperCase()}`; },
  brightness(v)  { runPhone('settings put system screen_brightness_mode 0'); runPhone(`settings put system screen_brightness ${v}`); return `☀️ Brightness: ${v}/255`; },
  screenshot(f)  { const fp=f||`/sdcard/NasTech_${Date.now()}.png`; runPhone(`screencap -p "${fp}"`); return fp; },
  record(s,f)    { const fp=f||`/sdcard/NasTech_rec_${Date.now()}.mp4`; runPhone(`screenrecord --time-limit ${s||10} "${fp}" &`); return fp; },
  lock()         { runPhone('input keyevent 26'); return '🔒 Screen locked'; },
  poweroff()     { runPhone('reboot -p 2>/dev/null') || runPhone('svc power shutdown 2>/dev/null') || runPhone('am start -a android.intent.action.ACTION_REQUEST_SHUTDOWN'); return '🔴 Power off sent — shutting down...'; },
  rebootPhone()  { runPhone('reboot'); return '🔄 Reboot sent...'; },
  darkMode(s)    { runPhone(`cmd uimode night ${s==='on'?'yes':'no'}`); return `🌙 Dark mode ${s.toUpperCase()}`; },
  dnd(s)         { runPhone(`cmd notification set_interruption_filter ${s==='on'?1:0}`); return `🔕 DND ${s.toUpperCase()}`; },
  rotation(s)    { runPhone(`settings put system accelerometer_rotation ${s==='on'?1:0}`); return `🔄 Rotation ${s.toUpperCase()}`; },
  volumeUp(n=1)  { for(let i=0;i<parseInt(n);i++) runPhone('input keyevent 24'); return `🔊 Volume +${n}`; },
  volumeDown(n=1){ for(let i=0;i<parseInt(n);i++) runPhone('input keyevent 25'); return `🔉 Volume -${n}`; },
  mute()         { runPhone('input keyevent 164'); return '🔇 Muted'; },
  tap(x,y)       { runPhone(`input tap ${x} ${y}`); return `👆 Tapped (${x},${y})`; },
  swipe(x1,y1,x2,y2,ms=400){ runPhone(`input swipe ${x1} ${y1} ${x2} ${y2} ${ms}`); return `👆 Swipe done`; },
  type(t)        { runPhone(`input text "${t.replace(/ /g,'%s').replace(/['"]/g,'')}"`); return `⌨️ Typed`; },
  key(c)         { runPhone(`input keyevent ${c}`); return `🔑 Key ${c} sent`; },
  home()         { runPhone('input keyevent 3');   return '🏠 Home'; },
  back()         { runPhone('input keyevent 4');   return '⬅️ Back'; },
  recent()       { runPhone('input keyevent 187'); return '📋 Recents'; },
  scroll(d)      { const[x1,y1,x2,y2]=d==='down'?[500,1500,500,800]:[500,800,500,1500]; runPhone(`input swipe ${x1} ${y1} ${x2} ${y2} 300`); return `📜 Scrolled ${d}`; },
  openApp(p)     { runPhone(`monkey -p ${p} -c android.intent.category.LAUNCHER 1 2>/dev/null`); return `📱 Opened: ${p}`; },
  killApp(p)     { runPhone(`am force-stop ${p}`); return `💀 Killed: ${p}`; },
  clearApp(p)    { runPhone(`pm clear ${p}`); return `🧹 Cleared: ${p}`; },
  listApps(f='') { return runPhone(`pm list packages${f?' | grep '+f:''} | sed 's/package://' | sort`).out; },
  listRunning()  { return runPhone("dumpsys activity activities | grep 'mResumedActivity'").out; },
  call(n)        { runPhone(`am start -a android.intent.action.CALL -d tel:${n}`); return `📞 Calling ${n}`; },
  sms(n,m)       { runPhone(`am start -a android.intent.action.SENDTO -d sms:${n} --es sms_body "${m}"`); return `💬 SMS to ${n}`; },
  whatsapp(n,m)  { runPhone(`am start -a android.intent.action.VIEW -d "https://wa.me/${n}?text=${encodeURIComponent(m)}"`); return `💚 WhatsApp → ${n}`; },
  notify(t,b)    { runPhone(`cmd notification post -S bigtext -t "${t}" "NasTech" "${b}"`); return `🔔 Sent: ${t}`; },
  openUrl(u)     { runPhone(`am start -a android.intent.action.VIEW -d "${u}"`); return `🌐 Opened: ${u}`; },
  youtube(q)     { const u=`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`; runPhone(`am start -a android.intent.action.VIEW -d "${u}" com.google.android.youtube 2>/dev/null`) || runPhone(`am start -a android.intent.action.VIEW -d "${u}"`); return `▶️ YouTube: ${q}`; },
  maps(q)        { runPhone(`am start -a android.intent.action.VIEW -d "geo:0,0?q=${encodeURIComponent(q)}"`); return `🗺 Maps: ${q}`; },
  chrome(u)      { const url=u.startsWith('http')?u:`https://${u}`; runPhone(`am start -a android.intent.action.VIEW -d "${url}" -n com.android.chrome/com.google.android.apps.chrome.Main 2>/dev/null`) || runPhone(`am start -a android.intent.action.VIEW -d "${url}"`); return `🌐 Chrome: ${url}`; },
  shell(c)       { return runPhone(c).out || '(no output)'; },
  lsDir(p='/sdcard') {
    const tp = p.replace('/sdcard/',`${HOME}/storage/shared/`);
    try {
      const entries = fs.readdirSync(fs.existsSync(tp)?tp:p);
      return entries.slice(0,40).map(e => { try { const s=fs.statSync(path.join(tp,e)); return `${s.isDirectory()?'📁':'📄'} ${e}${s.isDirectory()?'/':` (${fmtSize(s.size)})`}`; } catch { return `  ${e}`; } }).join('\n') || 'Empty';
    } catch {}
    return runPhone(`ls -la "${p}" 2>/dev/null | head -40`).out || 'No access';
  },
  uiDump() {
    runPhone('uiautomator dump /sdcard/ui_dump.xml 2>/dev/null');
    const r = runPhone('cat /sdcard/ui_dump.xml');
    if (!r.ok) return 'UI dump failed — is Shizuku running?';
    const re = /(?:text|content-desc)="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
    let m, items = [];
    while ((m=re.exec(r.out))!==null) { if(m[1].trim()) { const cx=Math.floor((+m[2]+ +m[4])/2),cy=Math.floor((+m[3]+ +m[5])/2); items.push(`(${cx},${cy}) "${m[1]}"`); } }
    return items.length ? `📱 UI (${items.length}):\n${items.slice(0,30).join('\n')}` : 'No UI elements found';
  },
  findAndTap(text) {
    runPhone('uiautomator dump /sdcard/ui_dump.xml 2>/dev/null');
    const r  = runPhone('cat /sdcard/ui_dump.xml');
    const pt = new RegExp(`(?:text|content-desc)="${text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
    const m  = r.out.match(pt);
    if (!m) return `❌ Not found: "${text}"`;
    const cx=Math.floor((+m[1]+ +m[3])/2), cy=Math.floor((+m[2]+ +m[4])/2);
    runPhone(`input tap ${cx} ${cy}`);
    return `✅ Tapped "${text}" at (${cx},${cy})`;
  },
};

// =============================================================================
// ── AI ENGINE ─────────────────────────────────────────────────────────────────
// =============================================================================

const AI_SYS = `You are NasTech AI v4 — autonomous AI on Android (Termux + Shizuku). You control the phone fully, search and send files, download YouTube, control Chrome, write code, chain commands. Be direct and concise.`;

async function aiChat(msg, uid) {
  if (!chatHistories[uid]) chatHistories[uid] = [];
  const hist = chatHistories[uid];
  const msgs = [{ role:'system', content:AI_SYS }, ...hist.slice(-10), { role:'user', content:msg }];
  for (const prov of ['ollama','groq','openrouter','gemini']) {
    try {
      let content = '';
      if (prov==='ollama') {
        const r = await fetch(`${OLLAMA_URL}/api/chat`,{ method:'POST', timeout:60000, headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model:currentModel, messages:msgs, stream:false }) });
        if (r.ok) content = (await r.json()).message?.content || '';
      } else if (prov==='groq' && GROQ_KEY) {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions',{ method:'POST', timeout:30000, headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`}, body:JSON.stringify({ model:'llama3-70b-8192', messages:msgs, max_tokens:4096 }) });
        if (r.ok) content = (await r.json()).choices?.[0]?.message?.content || '';
      } else if (prov==='openrouter' && OR_KEY) {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions',{ method:'POST', timeout:30000, headers:{'Content-Type':'application/json','Authorization':`Bearer ${OR_KEY}`,'HTTP-Referer':'nastech','X-Title':'NasTech'}, body:JSON.stringify({ model:'meta-llama/llama-3.3-70b-instruct:free', messages:msgs, max_tokens:4096 }) });
        if (r.ok) content = (await r.json()).choices?.[0]?.message?.content || '';
      } else if (prov==='gemini' && GEM_KEY) {
        const contents = msgs.filter(m=>m.role!=='system').map(m=>({ role:m.role==='assistant'?'model':'user', parts:[{text:m.content}] }));
        const sys = msgs.find(m=>m.role==='system')?.content;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEM_KEY}`,{ method:'POST', timeout:30000, headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents, ...(sys&&{systemInstruction:{parts:[{text:sys}]}}) }) });
        if (r.ok) content = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else continue;
      if (content) {
        hist.push({ role:'user', content:msg }, { role:'assistant', content });
        if (hist.length > 20) chatHistories[uid] = hist.slice(-20);
        return { content, provider: prov };
      }
    } catch(e) { blog(`[AI] ${prov}: ${e.message}`); }
  }
  return { content: '⚠️ All AI offline. Run: `nastech serve` to start Ollama', provider:'none' };
}

// =============================================================================
// ── STATE HELPERS ─────────────────────────────────────────────────────────────
// =============================================================================

function setState(chatId, state) { userState[chatId] = state; }
function getState(chatId)        { return userState[chatId]; }
function clearState(chatId)      { delete userState[chatId]; }

// =============================================================================
// ── TELEGRAM BOT ──────────────────────────────────────────────────────────────
// =============================================================================

function startBot() {
  if (!TOKEN) { console.error('No TELEGRAM_BOT_TOKEN in ~/.nastech/config.env'); process.exit(1); }

  const bot    = new TelegramBot(TOKEN, { polling: { interval: 800, autoStart: true } });
  const isAdmin = id => ADMIN_ID && id === ADMIN_ID;

  // ── shorthand helpers ────────────────────────────────────────────────────
  const send = (id, txt, extra = {}) =>
    bot.sendMessage(id, txt, { parse_mode:'Markdown', reply_markup: MAIN_KB, ...extra }).catch(()=>{});
  const sendMenu = (id, txt, kb, opts={}) =>
    bot.sendMessage(id, txt, { parse_mode:'Markdown', reply_markup: kb, ...opts }).catch(()=>{});
  const edit   = (id, mid, txt, kb) =>
    bot.editMessageText(txt, { chat_id:id, message_id:mid, parse_mode:'Markdown', reply_markup:kb }).catch(()=>{});
  const typing = id => bot.sendChatAction(id, 'typing').catch(()=>{});
  const uploading = id => bot.sendChatAction(id, 'upload_document').catch(()=>{});
  const answer = (id, txt='✅') => bot.answerCallbackQuery(id, { text: txt }).catch(()=>{});

  // ── /start ───────────────────────────────────────────────────────────────
  bot.onText(/\/start/, msg => {
    const id = msg.chat.id;
    clearState(id);
    send(id,
      `*🤖 NasTech AI v4 — Ready*\n\n` +
      `Admin: ${isAdmin(id)?'✅ YES':'❌ NO'} | Model: \`${currentModel}\`\n\n` +
      `_Use the buttons below — no commands needed!_\n` +
      `Just tap a button or type anything to chat with AI.`
    );
  });

  // ── CALLBACK QUERY handler (inline buttons) ───────────────────────────────
  bot.on('callback_query', async cq => {
    const id   = cq.message.chat.id;
    const mid  = cq.message.message_id;
    const data = cq.data;
    answer(cq.id);

    // WiFi / Network
    if (data==='wifi_on')      { send(id, PHONE.wifi('on'));       return; }
    if (data==='wifi_off')     { send(id, PHONE.wifi('off'));      return; }
    if (data==='mob_on')       { send(id, PHONE.mobile('on'));     return; }
    if (data==='mob_off')      { send(id, PHONE.mobile('off'));    return; }
    if (data==='bt_on')        { send(id, PHONE.bluetooth('on')); return; }
    if (data==='bt_off')       { send(id, PHONE.bluetooth('off'));return; }
    if (data==='air_on')       { send(id, PHONE.airplane('on'));   return; }
    if (data==='air_off')      { send(id, PHONE.airplane('off')); return; }
    if (data==='hot_on')       { send(id, PHONE.shell('svc wifi start-tethering 2>/dev/null || am start -n com.android.settings/.TetherSettings')); return; }
    if (data==='hot_off')      { send(id, PHONE.shell('svc wifi stop-tethering 2>/dev/null')); return; }
    if (data==='wifi_status')  { send(id, PHONE.wifiStatus());    return; }

    // Volume
    if (data==='vol_up1')      { send(id, PHONE.volumeUp(1));  return; }
    if (data==='vol_up3')      { send(id, PHONE.volumeUp(3));  return; }
    if (data==='vol_up5')      { send(id, PHONE.volumeUp(5));  return; }
    if (data==='vol_dn1')      { send(id, PHONE.volumeDown(1));return; }
    if (data==='vol_dn3')      { send(id, PHONE.volumeDown(3));return; }
    if (data==='vol_dn5')      { send(id, PHONE.volumeDown(5));return; }
    if (data==='vol_mute')     { send(id, PHONE.mute());       return; }
    if (data==='vol_unmute')   { send(id, PHONE.key(164));     return; }

    // Display
    if (data==='dark_on')      { send(id, PHONE.darkMode('on'));   return; }
    if (data==='dark_off')     { send(id, PHONE.darkMode('off'));  return; }
    if (data==='dnd_on')       { send(id, PHONE.dnd('on'));        return; }
    if (data==='dnd_off')      { send(id, PHONE.dnd('off'));       return; }
    if (data==='rot_on')       { send(id, PHONE.rotation('on'));   return; }
    if (data==='rot_off')      { send(id, PHONE.rotation('off')); return; }
    if (data==='bright_max')   { send(id, PHONE.brightness(255)); return; }
    if (data==='bright_min')   { send(id, PHONE.brightness(20));  return; }
    if (data==='bright_mid')   { send(id, PHONE.brightness(128)); return; }

    // Apps
    if (data==='apps_list') {
      const apps = PHONE.listApps();
      send(id, `📋 *Installed Apps:*\n\`\`\`\n${apps.slice(0,3000)}\n\`\`\``);
      return;
    }
    if (data==='apps_running') { send(id, `🏃 Running:\n${PHONE.listRunning()}`); return; }
    if (data==='apps_apks')    { send(id, `📦 Finding APKs...`); const r=sh('find /sdcard -iname "*.apk" 2>/dev/null | head -15',{timeout:10000}); send(id, r.out||'No APKs found'); return; }
    if (data==='apps_open')    { setState(id,{waiting:'app_open'});   send(id,'📱 Type the package name to open:\n_(e.g. com.whatsapp, com.android.chrome)_'); return; }
    if (data==='apps_kill')    { setState(id,{waiting:'app_kill'});   send(id,'💀 Type the package name to force stop:'); return; }
    if (data==='apps_clear')   { setState(id,{waiting:'app_clear'});  send(id,'🧹 Type the package name to clear data:'); return; }

    // Comms
    if (data==='comm_call')    { setState(id,{waiting:'call_num'});   send(id,'📞 Type the phone number to call:'); return; }
    if (data==='comm_sms')     { setState(id,{waiting:'sms_num'});    send(id,'💬 Type: *number message*\n_(e.g. +1234567890 Hello there)_'); return; }
    if (data==='comm_wa')      { setState(id,{waiting:'wa_num'});     send(id,'💚 Type: *number message*\n_(e.g. +1234567890 Hey!)_'); return; }
    if (data==='comm_notif')   { setState(id,{waiting:'notif'});      send(id,'🔔 Type: *title|body*\n_(e.g. Reminder|Check the oven)_'); return; }

    // Files
    if (data.startsWith('ls_')) {
      const dir = data.slice(3);
      const listing = PHONE.lsDir(dir);
      sendMenu(id, `📁 *${dir}*\n\`\`\`\n${listing.slice(0,3000)}\n\`\`\``, filesKB(dir));
      return;
    }
    if (data==='find_apks') {
      send(id,'📦 Scanning for APKs...');
      const r = sh('find /sdcard -iname "*.apk" 2>/dev/null | head -20',{timeout:12000});
      send(id, r.out ? `📦 *APKs found:*\n\`${r.out}\`` : '❌ No APKs found');
      return;
    }
    if (data==='search_prompt') {
      setState(id,{waiting:'search_files'});
      send(id,'🔍 What do you want to search for?\n_Type file name or keyword:_');
      return;
    }

    // Settings
    if (data==='set_models') {
      const r = await fetch(`${OLLAMA_URL}/api/tags`,{timeout:5000}).catch(()=>null);
      if (!r?.ok) return send(id,'❌ Ollama offline. Run: `nastech serve`');
      const d = await r.json();
      const ms = d.models?.map(m=>`${m.name===currentModel?'▶ ':'  '}\`${m.name}\``).join('\n')||'No models';
      send(id, `*Available Ollama Models:*\n${ms}\n\nCurrent: \`${currentModel}\``);
      return;
    }
    if (data==='set_model_pick') { setState(id,{waiting:'model_pick'}); send(id,'🧠 Type model name:\n_(e.g. tinyllama, llama3.2:1b, phi3:mini)_'); return; }
    if (data==='set_clear')      { chatHistories[id]=[]; send(id,'🧹 AI chat history cleared.'); return; }
    if (data==='set_apis') {
      send(id,
        `*API Keys Status:*\n` +
        `🟢 Groq: ${GROQ_KEY?'✅ Set':'❌ Missing'}\n` +
        `🔵 OpenRouter: ${OR_KEY?'✅ Set':'❌ Missing'}\n` +
        `🟡 Gemini: ${GEM_KEY?'✅ Set':'❌ Missing'}\n\n` +
        `Edit: \`~/.nastech/config.env\``
      );
      return;
    }
    if (data==='set_shizuku') {
      const b = getBackend();
      if (b) { send(id,`✅ Shizuku connected via *${b.toUpperCase()}*\nTest: \`${PHONE.shell('whoami')}\``); }
      else {
        send(id,
          `❌ *Shizuku not connected*\n\n` +
          `Run in Termux:\n\`\`\`\nnastech-reconnect\n\`\`\`\n\n` +
          `Or follow steps in *reconnected.txt*`
        );
      }
      return;
    }
    if (data==='set_allcmds') {
      send(id,
        `*All Available Commands:*\n\n` +
        `*Phone:* battery, info, storage, wifi, bluetooth, mobile, airplane, screenshot, record, lock, poweroff, reboot, darkmode, dnd, brightness, volume, mute, tap, swipe, type, key, home, back, recent, uidump, findtap, openapp, killapp, clearapp, listapps, call, sms, whatsapp, notify, maps, shell\n\n` +
        `*Files:* search, song, video, photo, docs, sendfile, pull, recent-files\n\n` +
        `*Download:* download, ytdl, ytvideo, chrome\n\n` +
        `*AI:* chat, code, explain, fix, model, clear\n\n` +
        `_All accessible via keyboard buttons — just tap!_`
      );
      return;
    }

    // Power confirmations
    if (data==='confirm_poweroff') { send(id, PHONE.poweroff()); return; }
    if (data==='confirm_reboot')   { send(id, PHONE.rebootPhone()); return; }
    if (data==='cancel')           { clearState(id); send(id,'❌ Cancelled.'); return; }
  });

  // ── MESSAGE handler ───────────────────────────────────────────────────────
  bot.on('message', async msg => {
    const id   = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text) return;

    // Handle /start here too
    if (text === '/start') return;

    const state = getState(id);

    // ── State machine — handle pending inputs ───────────────────────────────
    if (state) {
      clearState(id);

      // App control
      if (state.waiting==='app_open')   { return send(id, PHONE.openApp(text)); }
      if (state.waiting==='app_kill')   { return send(id, PHONE.killApp(text)); }
      if (state.waiting==='app_clear')  { return send(id, PHONE.clearApp(text)); }
      if (state.waiting==='model_pick') { currentModel=text; return send(id,`✅ Model set to \`${text}\``); }

      // Comms
      if (state.waiting==='call_num')  { return send(id, PHONE.call(text)); }
      if (state.waiting==='sms_num') {
        const [num,...rest] = text.split(' ');
        return send(id, PHONE.sms(num, rest.join(' ')));
      }
      if (state.waiting==='wa_num') {
        const [num,...rest] = text.split(' ');
        return send(id, PHONE.whatsapp(num, rest.join(' ')));
      }
      if (state.waiting==='notif') {
        const [title,...rest] = text.split('|');
        return send(id, PHONE.notify(title.trim(), rest.join('|').trim() || title.trim()));
      }

      // Files
      if (state.waiting==='search_files') {
        send(id,`🔍 Searching: *${text}*...`);
        const results = searchStorage(text);
        if (!results.length) return send(id,`❌ Nothing found for: "${text}"`);
        const list = results.slice(0,10).map((f,i)=>`${i+1}. ${fileEmoji(f.ext)} \`${f.name}\` (${fmtSize(f.size)})`).join('\n');
        return send(id,`*Found ${results.length}:*\n${list}\n\n_Type a full path or use search again_`);
      }
      if (state.waiting==='song_name') {
        send(id,`🎵 Searching for: *${text}*...`);
        const res = searchStorage(text, AUDIO_EXT, 3);
        if (res.length) {
          uploading(id);
          send(id,`🎵 Found: \`${res[0].name}\` (${fmtSize(res[0].size)})\nSending...`);
          const p = await pullFile(res[0].path);
          if (p.ok) return await sendFileTelegram(bot, id, p.localPath, `🎵 ${res[0].name}`);
        }
        return send(id,`❌ Not found: "${text}"\nTap *▶️ YouTube DL* to download instead`);
      }
      if (state.waiting==='video_name') {
        send(id,`🎬 Searching: *${text}*...`);
        const res = searchStorage(text, VIDEO_EXT, 3);
        if (res.length) {
          uploading(id);
          const p = await pullFile(res[0].path);
          if (p.ok) return await sendFileTelegram(bot, id, p.localPath, `🎬 ${res[0].name}`);
        }
        return send(id,`❌ Not found: "${text}"\nTap *▶️ YouTube DL* to try downloading`);
      }
      if (state.waiting==='photo_name') {
        send(id,`🖼 Searching: *${text}*...`);
        const res = searchStorage(text, IMAGE_EXT, 3);
        if (res.length) {
          uploading(id);
          const p = await pullFile(res[0].path);
          if (p.ok) return await sendFileTelegram(bot, id, p.localPath, `🖼 ${res[0].name}`);
        }
        return send(id,`❌ No photo found: "${text}"`);
      }
      if (state.waiting==='download_url') {
        send(id,`⬇️ Downloading...`);
        uploading(id);
        const r = await downloadURL(text, DL_DIR);
        if (!r.ok) return send(id,`❌ Failed: ${r.error}`);
        send(id,`✅ Got: \`${r.name}\` (${fmtSize(r.size)})\nSending...`);
        const sent = await sendFileTelegram(bot, id, r.path, `📁 ${r.name}`);
        if (!sent) send(id,`File saved. Path: \`${r.path}\``);
        return;
      }
      if (state.waiting==='ytdl_url') {
        const isAudio = state.audioOnly !== false;
        send(id,`${isAudio?'🎵':'🎬'} Downloading from YouTube...\n_(may take a minute)_`);
        uploading(id);
        const r = await ytDlp(text, isAudio, DL_DIR);
        if (!r.ok) return send(id,`❌ Failed: ${r.error}\n\nMake sure yt-dlp is installed: \`pip install yt-dlp\``);
        send(id,`✅ Got: \`${r.name}\`\nSending...`);
        const sent = await sendFileTelegram(bot, id, r.path, `${isAudio?'🎵':'🎬'} ${r.name}`);
        if (!sent) send(id,`Saved at: \`${r.path}\``);
        return;
      }
      if (state.waiting==='chrome_url') {
        const url = text.startsWith('http') ? text : text.includes(' ') ? `https://www.google.com/search?q=${encodeURIComponent(text)}` : `https://${text}`;
        return send(id, PHONE.chrome(url));
      }
      if (state.waiting==='shell_cmd') {
        if (!isAdmin(id)) return send(id,'❌ Admin only');
        const out = PHONE.shell(text);
        return send(id, `\`\`\`\n${out.slice(0,3500)}\n\`\`\``);
      }
      if (state.waiting==='ai_chat') {
        typing(id);
        const r = await aiChat(text, id);
        return send(id, r.content.slice(0,4096)+`\n_[${r.provider} • ${currentModel}]_`);
      }
      if (state.waiting==='tap_coords') {
        const [x,y] = text.split(/[ ,]+/);
        return send(id, PHONE.tap(x,y));
      }
      if (state.waiting==='type_text') {
        return send(id, PHONE.type(text));
      }
      if (state.waiting==='findtap_text') {
        return send(id, PHONE.findAndTap(text));
      }
    }

    // ── Button text matching ────────────────────────────────────────────────
    switch(text) {

      // Row 1 — Info
      case '🔋 Battery':
        return send(id, PHONE.battery());

      case '📱 Device Info':
        return send(id, PHONE.info());

      case '💾 Storage':
        return send(id, PHONE.storage());

      // Row 2 — Screen
      case '📸 Screenshot':
        send(id,'📸 Taking screenshot...');
        uploading(id);
        const fp = PHONE.screenshot();
        await new Promise(r=>setTimeout(r,1500));
        const pi = await pullFile(fp);
        if (pi.ok) { await sendFileTelegram(bot, id, pi.localPath, '📸 Screenshot'); }
        else send(id,`📸 Saved at: \`${fp}\``);
        return;

      case '🎬 Record Screen':
        send(id,'🎬 Recording 10 seconds...');
        const rf = PHONE.record(10);
        await new Promise(r=>setTimeout(r,13000));
        uploading(id);
        const pr = await pullFile(rf);
        if (pr.ok) { await sendFileTelegram(bot, id, pr.localPath,'🎬 Screen Recording'); }
        else send(id,`🎬 Saved at: \`${rf}\``);
        return;

      case '🔒 Lock Screen':
        return send(id, PHONE.lock());

      // Row 3 — Files
      case '🎵 Send Song':
        setState(id,{waiting:'song_name'});
        return send(id,'🎵 What song do you want?\n_Type name or artist:_');

      case '🎬 Send Video':
        setState(id,{waiting:'video_name'});
        return send(id,'🎬 What video do you want?\n_Type filename or keyword:_');

      case '📁 Browse Files':
        return sendMenu(id,'📁 *Browse Phone Storage:*\nChoose a folder:', filesKB(), { parse_mode:'Markdown' });

      // Row 4 — Download
      case '⬇️ Download':
        setState(id,{waiting:'download_url'});
        return send(id,'⬇️ *Paste the URL to download:*\n_(Any direct file link, MP3, ZIP, APK...)_');

      case '▶️ YouTube DL':
        setState(id,{waiting:'ytdl_url', audioOnly:true});
        return sendMenu(id,
          '▶️ *YouTube Download*\nPaste a YouTube URL:',
          { inline_keyboard:[
            [{ text:'🎵 Audio (MP3)', callback_data:'ytdl_audio'}, { text:'🎬 Video (MP4)', callback_data:'ytdl_video'}]
          ]}
        );

      case '🌐 Open Chrome':
        setState(id,{waiting:'chrome_url'});
        return send(id,'🌐 Type a URL or search query:\n_(e.g. youtube.com or "best pizza recipe")_');

      // Row 5 — Network/Volume/Display
      case '📶 WiFi':
        return sendMenu(id,'📶 *Network Controls:*', wifiKB());

      case '🔊 Volume':
        return sendMenu(id,'🔊 *Volume Controls:*', volumeKB());

      case '💡 Display':
        return sendMenu(id,'💡 *Display Controls:*', displayKB());

      // Row 6 — Comms/Apps/AI
      case '📞 Calls & SMS':
        return sendMenu(id,'📞 *Communication:*', commsKB());

      case '📱 Apps':
        return sendMenu(id,'📱 *App Controls:*', appsKB());

      case '🧠 Ask AI':
        setState(id,{waiting:'ai_chat'});
        return send(id,'🧠 What do you want to ask?\n_Type your question:_');

      // Row 7 — Power/Status
      case '🔴 Power Off':
        return sendMenu(id,'⚠️ *Are you sure you want to POWER OFF the phone?*', confirmKB('poweroff'));

      case '🔄 Reboot':
        return sendMenu(id,'⚠️ *Reboot the phone?*', confirmKB('reboot'));

      case '📊 Status': {
        const ollamaOk = await fetch(`${OLLAMA_URL}/api/tags`,{timeout:3000}).then(r=>r.ok).catch(()=>false);
        const b = getBackend();
        const dlCount = fs.existsSync(DL_DIR) ? fs.readdirSync(DL_DIR).length : 0;
        return send(id,
          `*📊 NasTech AI v4 Status*\n\n` +
          `🤖 Ollama: ${ollamaOk?'✅ Running':'❌ Offline'}\n` +
          `📱 Phone: ${b?`✅ ${b.toUpperCase()}`:'❌ Shizuku not connected'}\n` +
          `🧠 Model: \`${currentModel}\`\n` +
          `🔑 Groq: ${GROQ_KEY?'✅':'❌'} | OpenRouter: ${OR_KEY?'✅':'❌'} | Gemini: ${GEM_KEY?'✅':'❌'}\n` +
          `📁 Downloads: ${dlCount} files\n` +
          `💬 AI History: ${Math.floor((chatHistories[id]||[]).length/2)} turns\n\n` +
          `_Run \`nastech-reconnect\` if phone shows ❌_`
        );
      }

      // Row 8 — Settings/Commands
      case '⚙️ Settings':
        return sendMenu(id,'⚙️ *Settings & Info:*', settingsKB());

      case '📝 Run Command':
        if (!isAdmin(id)) return send(id,'❌ Only the admin can run raw commands.');
        setState(id,{waiting:'shell_cmd'});
        return send(id,'📝 *Type any ADB/shell command:*\n_Runs directly on the phone via Shizuku_');

      case '❌ Cancel':
        clearState(id);
        return send(id,'✅ Cancelled. What would you like to do?');

      // YouTube inline picks
      default:
        // Inline button picks caught via message text (fallthrough to AI)
        break;
    }

    // ── Inline callback fallthrough handlers ─────────────────────────────────
    if (text === 'ytdl_audio_pick') { setState(id,{waiting:'ytdl_url',audioOnly:true});  return send(id,'🎵 Paste YouTube URL:'); }
    if (text === 'ytdl_video_pick') { setState(id,{waiting:'ytdl_url',audioOnly:false}); return send(id,'🎬 Paste YouTube URL:'); }

    // ── Natural language AI fallback ─────────────────────────────────────────
    typing(id);
    const r = await aiChat(text, id);
    send(id, r.content.slice(0,4096)+`\n_[${r.provider} • ${currentModel}]_`);
  });

  // Extra inline callback for YouTube audio/video choice
  bot.on('callback_query', async cq => {
    const id   = cq.message.chat.id;
    const data = cq.data;
    if (data==='ytdl_audio') { answer(cq.id,'🎵 Audio MP3'); setState(id,{waiting:'ytdl_url',audioOnly:true});  bot.sendMessage(id,'🎵 Paste the YouTube URL:',{reply_markup:MAIN_KB}).catch(()=>{}); }
    if (data==='ytdl_video') { answer(cq.id,'🎬 Video MP4'); setState(id,{waiting:'ytdl_url',audioOnly:false}); bot.sendMessage(id,'🎬 Paste the YouTube URL:',{reply_markup:MAIN_KB}).catch(()=>{}); }
  });

  console.log(`✅ NasTech AI v4 running | Model: ${currentModel}`);
  blog('Bot started v4');
}

// CLI mode
async function startCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  console.log('\x1b[36m\x1b[1m🤖 NasTech CLI — type ? for help\x1b[0m');
  const prompt = () => rl.question(`\x1b[36mnastech>\x1b[0m `, async t => {
    t = t.trim();
    if (!t) return prompt();
    if (t==='exit') process.exit(0);
    const r = await aiChat(t, 'cli');
    console.log(`\n\x1b[32m${r.content}\x1b[0m\n\x1b[2m[${r.provider}]\x1b[0m\n`);
    prompt();
  });
  prompt();
}

// Entry
const mode = process.argv.find(a=>a.startsWith('--mode='))?.split('=')[1] || 'bot';
(async()=>{
  if (mode==='cli') await startCLI();
  else if (mode==='copilot') { const r=await aiChat(process.argv.slice(2).join(' ').replace(/--mode=\S+/,'').trim(),'cli'); console.log(r.content); process.exit(0); }
  else startBot();
})().catch(e=>{ console.error(e.message); process.exit(1); });
