/**
 * HumanTyper — Popup Logic
 * Handles config UI, save/load, and communication with content script.
 */

/* ─── DOM References ─────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const els = {
  textInput: $('textInput'),
  charCount: $('charCount'),
  btnClipboard: $('btnClipboard'),
  btnStart: $('btnStart'),
  btnStop: $('btnStop'),
  advancedToggle: $('advancedToggle'),
  advancedPanel: $('advancedPanel'),
  statusBar: $('statusBar'),
  statusText: $('statusText'),
  progressFill: $('progressFill'),
  statusStats: $('statusStats'),
  // Basic
  delay: $('delay'),
  wpm: $('wpm'),
  errorRate: $('errorRate'),
  // Burst
  burstEnabled: $('burstEnabled'),
  burstWords: $('burstWords'),
  burstPauseMin: $('burstPauseMin'),
  burstPauseMax: $('burstPauseMax'),
  burstSettings: $('burstSettings'),
  // Substitution
  substituteEnabled: $('substituteEnabled'),
  substituteRate: $('substituteRate'),
  substituteComplexity: $('substituteComplexity'),
  substituteSettings: $('substituteSettings'),
  // Human behavior
  fatigueRate: $('fatigueRate'),
  paragraphPauseMin: $('paragraphPauseMin'),
  paragraphPauseMax: $('paragraphPauseMax'),
  hesitationEnabled: $('hesitationEnabled'),
  rereadingEnabled: $('rereadingEnabled'),
  rereadingPauseMin: $('rereadingPauseMin'),
  rereadingPauseMax: $('rereadingPauseMax'),
  rereadingSettings: $('rereadingSettings'),
};

let isTyping = false;

/* ─── Config ─────────────────────────────────────────── */

function getConfig() {
  return {
    delay: parseFloat(els.delay.value) || 5.0,
    wpm: parseInt(els.wpm.value) || 65,
    errorRate: (parseFloat(els.errorRate.value) || 3.0) / 100,
    burstEnabled: els.burstEnabled.checked,
    burstWords: parseInt(els.burstWords.value) || 8,
    burstPauseMin: parseFloat(els.burstPauseMin.value) || 2.0,
    burstPauseMax: parseFloat(els.burstPauseMax.value) || 5.0,
    substituteEnabled: els.substituteEnabled.checked,
    substituteRate: (parseFloat(els.substituteRate.value) || 3.0) / 100,
    substituteComplexity: els.substituteComplexity.value,
    fatigueRate: (parseFloat(els.fatigueRate.value) || 10) / 100,
    paragraphPauseMin: parseFloat(els.paragraphPauseMin.value) || 2.0,
    paragraphPauseMax: parseFloat(els.paragraphPauseMax.value) || 8.0,
    hesitationEnabled: els.hesitationEnabled.checked,
    rereadingEnabled: els.rereadingEnabled.checked,
    rereadingPauseMin: parseFloat(els.rereadingPauseMin.value) || 0.5,
    rereadingPauseMax: parseFloat(els.rereadingPauseMax.value) || 2.0,
  };
}

function setConfig(config) {
  if (!config) return;
  els.delay.value = config.delay ?? 5.0;
  els.wpm.value = config.wpm ?? 65;
  els.errorRate.value = (config.errorRate ?? 0.03) * 100;
  els.burstEnabled.checked = config.burstEnabled ?? true;
  els.burstWords.value = config.burstWords ?? 8;
  els.burstPauseMin.value = config.burstPauseMin ?? 2.0;
  els.burstPauseMax.value = config.burstPauseMax ?? 5.0;
  els.substituteEnabled.checked = config.substituteEnabled ?? true;
  els.substituteRate.value = (config.substituteRate ?? 0.03) * 100;
  els.substituteComplexity.value = config.substituteComplexity ?? 'moderate';
  els.fatigueRate.value = (config.fatigueRate ?? 0.10) * 100;
  els.paragraphPauseMin.value = config.paragraphPauseMin ?? 2.0;
  els.paragraphPauseMax.value = config.paragraphPauseMax ?? 8.0;
  els.hesitationEnabled.checked = config.hesitationEnabled ?? true;
  els.rereadingEnabled.checked = config.rereadingEnabled ?? true;
  els.rereadingPauseMin.value = config.rereadingPauseMin ?? 0.5;
  els.rereadingPauseMax.value = config.rereadingPauseMax ?? 2.0;
  updateToggleVisibility();
}

function saveConfig() {
  chrome.storage.local.set({ config: getConfig() });
}

function updateToggleVisibility() {
  const burstOn = els.burstEnabled.checked;
  els.burstSettings.style.display = burstOn ? 'block' : 'none';

  const subOn = els.substituteEnabled.checked;
  els.substituteSettings.style.display = subOn ? 'block' : 'none';

  const rereadOn = els.rereadingEnabled.checked;
  els.rereadingSettings.style.display = rereadOn ? 'block' : 'none';
}

/* ─── Status Updates ─────────────────────────────────── */

function showStatus(text, type = 'info') {
  els.statusBar.classList.remove('hidden');
  els.statusText.textContent = text;
  els.statusText.className = 'status-text' + (type === 'error' ? ' error' : type === 'typing' ? ' typing' : '');
}

function updateProgress(data) {
  const pct = Math.round(data.progress * 100);
  els.progressFill.style.width = pct + '%';
  els.statusStats.textContent =
    `${data.charsTyped}/${data.totalChars} chars · ${data.errorsCount} errors · ${data.subsCount} substitutions`;
}

function setTypingState(typing) {
  isTyping = typing;
  els.btnStart.classList.toggle('hidden', typing);
  els.btnStop.classList.toggle('hidden', !typing);
  els.textInput.disabled = typing;
  els.btnClipboard.disabled = typing;

  if (typing) {
    showStatus('⌨ Typing...', 'typing');
    els.statusText.classList.add('typing-indicator');
  } else {
    els.statusText.classList.remove('typing-indicator');
  }
}

/* ─── Actions ─────────────────────────────────────────── */

async function startTyping() {
  const text = els.textInput.value.trim();
  if (!text) {
    showStatus('❌ No text entered!', 'error');
    return;
  }

  const config = getConfig();
  saveConfig();

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    showStatus('❌ No active tab found', 'error');
    return;
  }

  setTypingState(true);
  showStatus(`⏱ Starting in ${config.delay}s — switch to your text field!`, 'typing');

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'start-typing',
      text: text,
      config: config,
    });

    if (response && response.status === 'error') {
      showStatus('❌ ' + response.message, 'error');
      setTypingState(false);
    }
  } catch (err) {
    showStatus('❌ Cannot reach page. Reload the tab and try again.', 'error');
    setTypingState(false);
  }
}

async function stopTyping() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'stop-typing' });
    } catch { /* tab might be gone */ }
  }
  setTypingState(false);
  showStatus('⚠ Stopped', 'error');
}

/* ─── Message Listener (from content script) ──────────── */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'typing-progress') {
    showStatus('⌨ Typing...', 'typing');
    updateProgress(msg);
  } else if (msg.action === 'typing-done') {
    setTypingState(false);
    if (msg.stopped) {
      showStatus('⚠ Stopped early', 'error');
    } else {
      showStatus('✅ Done!', 'info');
    }
    updateProgress({
      charsTyped: msg.charsTyped,
      totalChars: msg.charsTyped,
      errorsCount: msg.errorsCount,
      subsCount: msg.subsCount,
      progress: 1,
    });
  } else if (msg.action === 'typing-error') {
    setTypingState(false);
    showStatus('❌ Error: ' + msg.message, 'error');
  }
});

/* ─── Event Listeners ─────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Load saved config
  chrome.storage.local.get('config', (data) => {
    if (data.config) setConfig(data.config);
  });

  // Char count
  els.textInput.addEventListener('input', () => {
    const len = els.textInput.value.length;
    els.charCount.textContent = len.toLocaleString() + ' chars';
  });

  // Clipboard button
  els.btnClipboard.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        els.textInput.value = text;
        els.charCount.textContent = text.length.toLocaleString() + ' chars';
      } else {
        showStatus('📋 Clipboard is empty', 'error');
      }
    } catch {
      showStatus('📋 Clipboard access denied. Paste manually.', 'error');
    }
  });

  // Advanced toggle
  els.advancedToggle.addEventListener('click', () => {
    const panel = els.advancedPanel;
    const isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    panel.classList.toggle('hidden', isOpen);
    els.advancedToggle.classList.toggle('open', !isOpen);
  });

  // Toggle visibility for sub-settings
  els.burstEnabled.addEventListener('change', updateToggleVisibility);
  els.substituteEnabled.addEventListener('change', updateToggleVisibility);
  els.rereadingEnabled.addEventListener('change', updateToggleVisibility);

  // Auto-save on change
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', saveConfig);
  });

  // Start/Stop
  els.btnStart.addEventListener('click', startTyping);
  els.btnStop.addEventListener('click', stopTyping);
});
