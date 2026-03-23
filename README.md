<p align="center">
  <img src="humantyper-extension/icons/icon128.png" alt="HumanTyper" width="96">
</p>

<h1 align="center">⌨️ HumanTyper — Chrome Extension</h1>

<p align="center">
  <b>Human-like Typing Simulation for Any Text Field</b><br>
  <sub>Types into any webpage like a real student drafting an essay — with burst typing, word substitutions, fatigue, typos, and natural thinking pauses.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/150%2B%20synonyms-built--in-blueviolet?style=flat-square" alt="Built-in synonyms">
  <img src="https://img.shields.io/badge/zero%20dependencies-vanilla%20js-success?style=flat-square" alt="Zero deps">
</p>

---
https://chromewebstore.google.com/detail/nmelhfdhhefhclcbpgcgfdpogoklbbih
## ✨ Features

- **Works Everywhere** — Types into `<input>`, `<textarea>`, and `contenteditable` elements (Google Docs, Gmail, etc.)
- **Burst Typing** — Types words in customizable bursts then pauses, simulating brainstorming
- **Word Substitution** — Occasionally types a synonym, pauses, backspaces it, and retypes the correct word
- **150+ Built-in Synonyms** — Offline dictionary with simple/moderate/complex filtering
- **Fatigue Simulation** — Speed gradually decreases over time
- **Micro-hesitations** — Pauses before long words (≥8 characters)
- **Paragraph Thinking Pauses** — Longer pauses at paragraph boundaries
- **Sentence-start Slowdown** — First words of each sentence typed slightly slower
- **Re-reading Pauses** — Periodic pauses as if reviewing what was typed
- **Realistic QWERTY Typos** — Nearby-key mistakes with natural self-corrections
- **Decimal Precision** — All timing accepts decimals (e.g., 2.5s delay)
- **Settings Saved** — Your configuration persists between sessions
- **Sleek Dark UI** — Beautiful popup with basic + advanced settings

## 🚀 Installation

Since this extension isn't on the Chrome Web Store, install it as an unpacked extension:

1. **Download** or clone this folder to your computer
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"**
5. Select the `humantyper-extension` folder
6. The ⌨️ icon appears in your toolbar — you're ready!

## 🎮 Usage

1. **Click** on a text field in any webpage (Google Docs, Gmail compose, any textarea, etc.)
2. **Click** the HumanTyper extension icon in your toolbar
3. **Paste** your text (or click "Use Clipboard")
4. **Configure** speed, error rate, and optionally advanced settings
5. **Click** "▶ Start Typing"
6. **Switch** to your text field within the delay countdown
7. Watch it type like a real human! ⌨️

Click **"■ Stop"** at any time to halt typing.

## ⚙️ Settings

### Basic

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Delay** | 5.0s | 0–500s | Countdown before typing starts |
| **WPM** | 65 | 10–500 | Typing speed |
| **Error Rate** | 3% | 0–15% | QWERTY typo frequency |

### Advanced (click "🔧 Advanced Settings")

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Burst Typing** | ✅ on | — | Write in bursts, then think |
| **Words/Burst** | 8 | 1–100 | Words before thinking pause |
| **Burst Pause** | 2–5s | 0–500s | Thinking pause duration |
| **Word Substitution** | ✅ on | — | Draft wrong word → correct |
| **Sub. Rate** | 3% | 0–50% | How often words get swapped |
| **Complexity** | moderate | simple/mod/complex | Word length preference |
| **Fatigue** | 10% | 0–30% | Speed decrease over time |
| **Paragraph Pause** | 2–8s | 0–500s | Pause between paragraphs |
| **Hesitation** | ✅ on | — | Pause before long words |
| **Re-reading** | ✅ on | — | Periodic review pauses |

## 🔒 Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Access the focused text field to type into |
| `storage` | Save your configuration between sessions |
| `clipboardRead` | "Use Clipboard" button functionality |

No data is sent anywhere — everything runs locally in your browser.

## 🧠 How It Works

1. **Content script** (`content.js`) runs on every page, waiting for commands
2. When you click Start, the **popup** sends your text + config to the content script
3. The **typing engine** (`typer.js`) tokenizes text, groups into bursts, and schedules each character
4. Characters are typed using `document.execCommand('insertText')` for contenteditable elements, or direct value manipulation + `InputEvent` dispatch for input/textarea
5. Full keyboard events (`keydown`/`keypress`/`keyup`) are dispatched for compatibility with JavaScript frameworks

## Test of it working

https://www.youtube.com/watch?v=y1FZuwaO_GM

## 📄 License

MIT License

---

<p align="center">
  <sub>Made with ☕ and a dislike for typing things twice</sub>
</p>
