# No Thanks, ChatGPT

A Chrome extension that automatically dismisses annoying popups on ChatGPT, focuses the prompt box, and lets you locally export loaded conversations in clean, readable formats.

<img width="1280" height="800" alt="No Thanks, ChatGPT - Chrome Extension" src="https://github.com/user-attachments/assets/caa1ee74-8f29-4709-8d5e-b9d522a57032" />

## What It Does
- **"Thanks for trying ChatGPT" dialog** — auto-clicks "Stay logged out"
- **"Try Go, Free" upsell popup** — auto-clicks "Maybe later"
- **Google sign-in prompt** — blocks/removes the account chooser shown on ChatGPT pages
- **Cookie consent banner** — auto-clicks "Reject non-essential"
- **Signup button** — hides/removes the top-bar "Sign up for free" button
- **Sidebar login pane** — hides/removes the "Get responses tailored to you" prompt
- **Promotional cards** — removes the "Get smarter responses" card above the input box
- Automatically focuses the prompt textarea so you can start typing immediately
- **Conversation export** — exports the currently loaded chat as Markdown, JSON, HTML, or TXT
- Toolbar popup offers the same export formats as the in-page floating button
- As a fallback, removes modals if clicking isn't possible
- Runs only on ChatGPT domains; no background page, storage, analytics, or download permission

## Why
Some users prefer to browse ChatGPT while logged out but are interrupted by multiple popups, cookie banners, and promotional cards. This extension removes all that friction.

## Install (from source)
1. Download or clone this repository.
2. Unzip it in a folder, say `no-thanks-chatgpt`
3. Open `chrome://extensions`.
4. Enable `Developer mode` (top right).
5. Click `Load unpacked` and select the `no-thanks-chatgpt` folder.

## Web Store
Install from Chrome Web Store: [No Thanks, ChatGPT](https://chromewebstore.google.com/detail/no-thanks-chatgpt/nmgfghmecclnpobkngegmeaimijaojag) 

## Permissions
- `host_permissions`:
  - `https://chat.openai.com/*`
  - `https://chatgpt.com/*`
  - `https://*.chatgpt.com/*`

Justification: The content script must run on ChatGPT pages to detect and dismiss popups. No other sites are matched.

## Privacy
- No data collection, storage, or transmission.
- No external network requests.
- Reads only minimal page text to find and click dismiss buttons.
- When you click export, reads the rendered conversation text already loaded in the page and saves it locally in your browser.
- Exported files are generated with browser-native Blob downloads; chat data is not sent to any server.

## How It Works
- A `MutationObserver` watches for popups and banners to be added to the DOM.
- On detection, the script searches for dismiss buttons ("Stay logged out", "Maybe later", "Reject non-essential") and clicks them.
- Google sign-in prompts are blocked early and removed if they are injected as page iframes.
- The signup button, sidebar login pane, and promotional cards are removed directly when detected.
- After dismissing popups, automatically focuses the prompt textarea.
- If buttons cannot be clicked, the specific modal containers are removed as a fallback.
- A separate isolated content script adds a small export button on ChatGPT pages.
- Clicking the extension icon opens a popup with the same copy/export options for the active ChatGPT tab.
- The exporter scans the currently rendered conversation, separates user and assistant turns, preserves common formatting such as headings, lists, links, tables, and code blocks, then creates a local file.
- Exports only messages currently loaded in the page DOM. Copy and Export briefly scroll through the chat to load virtualized turns (then restore your scroll position). It does not call private ChatGPT APIs.
- Assistant “thinking” blocks (for example, “Thought for …”) are omitted from exports.
- If fewer messages export than visible turns, the UI warns that the export may be incomplete.

## Export Formats
- **Markdown (`.md`)** — best for notes, docs, and version control.
- **JSON (`.json`)** — structured messages with roles, text, Markdown, and optional links.
- **HTML (`.html`)** — a standalone readable page with lightweight styling.
- **TXT (`.txt`)** — plain transcript with clear user and assistant labels.

## Attribution
- Author: [**DeepakNess**](https://deepakness.com)

## Disclaimer
This project is not affiliated with or endorsed by OpenAI. "ChatGPT" is a trademark of its respective owner.
