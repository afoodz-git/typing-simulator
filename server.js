const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3847;

let nativeSender = null;
let rawCode = "";
let codeToType = "";
let currentIndex = 0;
let isHackerModeActive = false;
let autoPlayTimer = null;
let charsPerKeypress = 3;
let autoSpeedMs = 50;
let autoDelaySeconds = 5;
let triggerKey = 'Space'; // 'Space', 'Tab', 'ArrowRight', 'CtrlRight', 'F7', 'Any'
let indentMode = 'smart'; // 'smart' (VS Code / Visual Studio) or 'raw' (Notepad)

function prepareCodeForVSCode(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let result = [];
  let currentIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)/);
    const lineIndent = match ? match[1].length : 0;
    const content = line.substring(lineIndent);

    if (content.length === 0) {
      result.push('\n');
      continue;
    }

    if (i === 0) {
      result.push(line);
      currentIndent = line.trimEnd().endsWith('{') ? lineIndent + 4 : lineIndent;
    } else {
      const diff = lineIndent - currentIndent;
      let textToType = '';
      if (diff > 0) {
        textToType = ' '.repeat(diff) + content;
      } else {
        textToType = content;
      }
      result.push(textToType);
      currentIndent = line.trimEnd().endsWith('{') ? lineIndent + 4 : lineIndent;
    }

    if (i < lines.length - 1) {
      result.push('\n');
    }
  }

  return result.join('');
}

function updateProcessedCode() {
  codeToType = rawCode.replace(/\r\n/g, '\n');
}

function createSenderProcess() {
  const exePath = path.join(__dirname, 'NativeSender.exe');
  if (fs.existsSync(exePath)) {
    nativeSender = spawn(exePath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    nativeSender.stdout.on('data', () => {});
    nativeSender.stderr.on('data', (d) => console.error('Sender stderr:', d.toString()));

    nativeSender.on('close', (code) => {
      console.log('NativeSender closed with code:', code);
      nativeSender = null;
    });
  }
}

function sendTextToActiveWindow(text) {
  if (!text) return;
  if (!nativeSender) {
    createSenderProcess();
  }
  if (!nativeSender) return;

  const base64 = Buffer.from(text, 'utf8').toString('base64');
  try {
    nativeSender.stdin.write(`TYPE:${base64}\n`);
  } catch (err) {
    console.error('Send error:', err);
    createSenderProcess();
  }
}

function broadcast(msgObj) {
  const data = JSON.stringify(msgObj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function typeNextChunk() {
  if (!codeToType || currentIndex >= codeToType.length) {
    broadcast({ type: 'status-update', status: 'finished', currentIndex, totalLength: codeToType.length });
    return;
  }

  const chunk = codeToType.substr(currentIndex, charsPerKeypress);
  currentIndex += chunk.length;
  sendTextToActiveWindow(chunk);

  broadcast({
    type: 'progress-update',
    currentIndex,
    totalLength: codeToType.length,
    percentage: Math.min(100, Math.round((currentIndex / codeToType.length) * 100))
  });
}

let countdownTimer = null;
let countdownRemaining = 0;

function startAutoPlayWithDelay(delaySeconds = 5) {
  stopAutoPlay();
  if (delaySeconds <= 0) {
    startAutoPlayImmediate();
    return;
  }

  countdownRemaining = delaySeconds;
  broadcast({ type: 'countdown-tick', seconds: countdownRemaining });

  countdownTimer = setInterval(() => {
    countdownRemaining--;
    if (countdownRemaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      broadcast({ type: 'countdown-tick', seconds: 0 });
      startAutoPlayImmediate();
    } else {
      broadcast({ type: 'countdown-tick', seconds: countdownRemaining });
    }
  }, 1000);
}

function startAutoPlayImmediate() {
  autoPlayTimer = setInterval(() => {
    if (currentIndex >= codeToType.length) {
      stopAutoPlay();
      broadcast({ type: 'autoplay-toggled', active: false });
      return;
    }
    typeNextChunk();
  }, autoSpeedMs);
  broadcast({ type: 'autoplay-toggled', active: true });
}

function stopAutoPlay() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownRemaining = 0;
    broadcast({ type: 'countdown-tick', seconds: 0 });
  }
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }

  // Instantly cancel any queued keystrokes in the OS pipe buffer!
  if (nativeSender) {
    try {
      nativeSender.kill();
    } catch (e) {}
    nativeSender = null;
  }
  createSenderProcess();

  broadcast({ type: 'autoplay-toggled', active: false });
}

// Global hotkeys hook
uIOhook.on('keydown', (e) => {
  // F8: Toggle Hacker Mode
  if (e.keycode === UiohookKey.F8) {
    isHackerModeActive = !isHackerModeActive;
    broadcast({ type: 'mode-toggled', active: isHackerModeActive });
    return;
  }

  // F9: Toggle AutoPlay
  if (e.keycode === UiohookKey.F9) {
    if (autoPlayTimer || countdownTimer) {
      stopAutoPlay();
    } else {
      startAutoPlayWithDelay(autoDelaySeconds);
    }
    return;
  }

  // F10: Reset
  if (e.keycode === UiohookKey.F10) {
    currentIndex = 0;
    stopAutoPlay();
    broadcast({
      type: 'progress-update',
      currentIndex: 0,
      totalLength: codeToType.length,
      percentage: 0
    });
    return;
  }

  // Hacker Typer: Trigger key typing
  if (isHackerModeActive && !autoPlayTimer && !countdownTimer) {
    let matches = false;
    if (triggerKey === 'Space' && e.keycode === UiohookKey.Space) matches = true;
    else if (triggerKey === 'Tab' && e.keycode === UiohookKey.Tab) matches = true;
    else if (triggerKey === 'ArrowRight' && e.keycode === UiohookKey.ArrowRight) matches = true;
    else if (triggerKey === 'CtrlRight' && e.keycode === UiohookKey.CtrlRight) matches = true;
    else if (triggerKey === 'F7' && e.keycode === UiohookKey.F7) matches = true;
    else if (triggerKey === 'Any') {
      if (
        e.keycode !== UiohookKey.F8 &&
        e.keycode !== UiohookKey.F9 &&
        e.keycode !== UiohookKey.F10 &&
        e.keycode !== UiohookKey.Escape
      ) {
        matches = true;
      }
    }

    if (matches) {
      typeNextChunk();
    }
  }
});

// Serve frontend
app.use(express.static(__dirname));

wss.on('connection', (ws) => {
  // Sync state to newly connected client
  ws.send(JSON.stringify({
    type: 'init-state',
    isHackerModeActive,
    isAutoPlaying: !!autoPlayTimer,
    currentIndex,
    totalLength: codeToType.length,
    charsPerKeypress,
    autoSpeedMs,
    autoDelaySeconds,
    triggerKey,
    indentMode
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'set-code') {
        rawCode = data.code;
        updateProcessedCode();
        currentIndex = 0;
        broadcast({
          type: 'progress-update',
          currentIndex: 0,
          totalLength: codeToType.length,
          percentage: 0
        });
      } else if (data.action === 'set-config') {
        if (data.charsPerKeypress) charsPerKeypress = parseInt(data.charsPerKeypress) || 3;
        if (data.autoSpeedMs) autoSpeedMs = parseInt(data.autoSpeedMs) || 50;
        if (data.autoDelaySeconds !== undefined) autoDelaySeconds = parseInt(data.autoDelaySeconds) || 0;
        if (data.triggerKey) triggerKey = data.triggerKey;
        if (data.indentMode) {
          indentMode = data.indentMode;
          updateProcessedCode();
          broadcast({
            type: 'progress-update',
            currentIndex,
            totalLength: codeToType.length,
            percentage: Math.min(100, Math.round((currentIndex / (codeToType.length || 1)) * 100))
          });
        }
      } else if (data.action === 'toggle-hacker-mode') {
        isHackerModeActive = data.active;
        broadcast({ type: 'mode-toggled', active: isHackerModeActive });
      } else if (data.action === 'toggle-autoplay') {
        if (data.active) {
          startAutoPlayWithDelay(autoDelaySeconds);
        } else {
          stopAutoPlay();
        }
      } else if (data.action === 'reset-progress') {
        currentIndex = 0;
        stopAutoPlay();
        broadcast({
          type: 'progress-update',
          currentIndex: 0,
          totalLength: codeToType.length,
          percentage: 0
        });
      }
    } catch (e) {
      console.error(e);
    }
  });
});

createSenderProcess();
uIOhook.start();

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Hacker Typer berjalan di: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
  
  const url = `http://localhost:${PORT}`;
  const chromePath = `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`;

  if (fs.existsSync(chromePath)) {
    exec(`"${chromePath}" --app="${url}"`, (err) => {
      if (err) exec(`start "" "${url}"`);
    });
  } else {
    exec(`start "" "${url}"`);
  }
});

process.on('SIGINT', () => {
  uIOhook.stop();
  if (nativeSender) {
    try { nativeSender.stdin.write('EXIT\n'); nativeSender.kill(); } catch (e) {}
  }
  process.exit();
});
