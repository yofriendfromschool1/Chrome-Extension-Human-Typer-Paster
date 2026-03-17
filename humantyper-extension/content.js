/**
 * HumanTyper — Content Script
 * Runs in the page context. Types into the focused element using DOM events.
 */

let _htStopped = false;
let _htRunning = false;

/* ─── DOM Typing Functions ────────────────────────────── */

function getActiveElement() {
  let el = document.activeElement;
  // Traverse shadow DOMs
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function isEditableElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    return ['text', 'email', 'password', 'search', 'url', 'tel', 'number'].includes(type);
  }
  if (tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  // Google Docs uses an iframe — check for editable body inside
  if (tag === 'IFRAME') {
    try {
      const doc = el.contentDocument || el.contentWindow.document;
      return doc.designMode === 'on' || doc.body.isContentEditable;
    } catch { return false; }
  }
  return false;
}

function dispatchKeyEvents(el, char) {
  const keyOpts = {
    key: char,
    code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
    charCode: char.charCodeAt(0),
    keyCode: char.charCodeAt(0),
    which: char.charCodeAt(0),
    bubbles: true,
    cancelable: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
  el.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
  el.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
}

async function typeCharDOM(char) {
  const el = getActiveElement();
  if (!el || !isEditableElement(el)) return;

  if (el.isContentEditable) {
    // ContentEditable (Google Docs, rich editors, etc.)
    // Use insertText command for maximum compatibility
    document.execCommand('insertText', false, char);
  } else {
    // Input / Textarea
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    el.value = before + char + after;
    el.selectionStart = el.selectionEnd = start + char.length;

    // Dispatch input event for frameworks (React, Vue, etc.)
    el.dispatchEvent(new InputEvent('input', {
      inputType: 'insertText',
      data: char,
      bubbles: true,
      cancelable: false,
    }));
  }

  // Also fire key events for sites that listen to them
  dispatchKeyEvents(el, char);
}

async function typeBackspaceDOM(count) {
  for (let i = 0; i < count; i++) {
    const el = getActiveElement();
    if (!el || !isEditableElement(el)) return;

    if (el.isContentEditable) {
      document.execCommand('delete', false, null);
    } else {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;

      if (start === end && start > 0) {
        el.value = el.value.substring(0, start - 1) + el.value.substring(end);
        el.selectionStart = el.selectionEnd = start - 1;
      } else if (start !== end) {
        el.value = el.value.substring(0, start) + el.value.substring(end);
        el.selectionStart = el.selectionEnd = start;
      }

      el.dispatchEvent(new InputEvent('input', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: false,
      }));
    }

    // Fire backspace key events
    const bsOpts = {
      key: 'Backspace', code: 'Backspace',
      keyCode: 8, which: 8,
      bubbles: true, cancelable: true,
    };
    el.dispatchEvent(new KeyboardEvent('keydown', bsOpts));
    el.dispatchEvent(new KeyboardEvent('keyup', bsOpts));

    if (count > 1) {
      await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
    }
  }
}

/* ─── Message Handler ─────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'start-typing') {
    if (_htRunning) {
      sendResponse({ status: 'error', message: 'Already running' });
      return true;
    }

    const el = getActiveElement();
    if (!el || !isEditableElement(el)) {
      sendResponse({ status: 'error', message: 'No editable element focused. Click on a text field first!' });
      return true;
    }

    sendResponse({ status: 'started' });

    _htStopped = false;
    _htRunning = true;

    const config = msg.config;
    const text = msg.text;

    // Start typing after delay
    const delayMs = (config.delay || 0) * 1000;
    setTimeout(async () => {
      try {
        const result = await runTyper(
          text,
          config,
          typeCharDOM,
          typeBackspaceDOM,
          (progress) => {
            chrome.runtime.sendMessage({
              action: 'typing-progress',
              ...progress,
            });
          },
          () => _htStopped,
        );

        chrome.runtime.sendMessage({
          action: 'typing-done',
          ...result,
          stopped: _htStopped,
        });
      } catch (err) {
        chrome.runtime.sendMessage({
          action: 'typing-error',
          message: err.message,
        });
      } finally {
        _htRunning = false;
      }
    }, delayMs);

    return true;
  }

  if (msg.action === 'stop-typing') {
    _htStopped = true;
    _htRunning = false;
    sendResponse({ status: 'stopped' });
    return true;
  }

  if (msg.action === 'check-focus') {
    const el = getActiveElement();
    const editable = isEditableElement(el);
    sendResponse({
      focused: editable,
      tagName: el ? el.tagName : 'none',
      isContentEditable: el ? el.isContentEditable : false,
    });
    return true;
  }
});
