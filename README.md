# No Thanks, ChatGPT

A Chrome extension that automatically dismisses all annoying popups on ChatGPT and instantly focuses the prompt box, so you can start typing your questions right away without any extra clicks.

<img width="1280" height="800" alt="No Thanks, ChatGPT - Chrome Extension" src="https://github.com/user-attachments/assets/caa1ee74-8f29-4709-8d5e-b9d522a57032" />

## What It Does
- **"Thanks for trying ChatGPT" dialog** — auto-clicks "Stay logged out"
- **"Try Go, Free" upsell popup** — auto-clicks "Maybe later"
- **Cookie consent banner** — auto-clicks "Reject non-essential"
- **Promotional cards** — removes the "Get smarter responses" card above the input box
- Automatically focuses the prompt textarea so you can start typing immediately
- As a fallback, removes modals if clicking isn't possible
- Runs only on ChatGPT domains; no background page, storage, or analytics

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

## How It Works
- A `MutationObserver` watches for popups and banners to be added to the DOM.
- On detection, the script searches for dismiss buttons ("Stay logged out", "Maybe later", "Reject non-essential") and clicks them.
- Promotional cards are removed directly when detected.
- After dismissing popups, automatically focuses the prompt textarea.
- If buttons cannot be clicked, the specific modal containers are removed as a fallback.

## Attribution
- Author: [**DeepakNess**](https://deepakness.com)

## Disclaimer
This project is not affiliated with or endorsed by OpenAI. "ChatGPT" is a trademark of its respective owner.
