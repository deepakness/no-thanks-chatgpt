# No Thanks, ChatGPT

A Chrome extension that automatically dismisses ChatGPT's "Thanks for trying ChatGPT" popup and instantly focuses the prompt box, so you can start typing your questions right away without any extra clicks.

<img width="1280" height="800" alt="No Thanks, ChatGPT - Chrome Extension" src="https://github.com/user-attachments/assets/caa1ee74-8f29-4709-8d5e-b9d522a57032" />

## What It Does
- Auto-clicks the "Stay logged out" link when the login modal appears.
- Automatically focuses the prompt textarea so you can start typing immediately.
- As a fallback, removes that specific modal if clicking isn't possible.
- Runs only on ChatGPT domains; no background page, storage, or analytics.

## Why
Some users prefer to browse ChatGPT while logged out but are interrupted by a modal. This extension removes that friction.

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

Justification: The content script must run on ChatGPT pages to detect the modal text and click "Stay logged out." No other sites are matched.

## Privacy
- No data collection, storage, or transmission.
- No external network requests.
- Reads only minimal page text to find and click the "Stay logged out" link.

## How It Works
- A `MutationObserver` watches for the modal to be added to the DOM.
- On detection, the script searches for the "Stay logged out" link and clicks it.
- After dismissing the modal, automatically focuses the prompt textarea.
- If the link cannot be clicked, the specific modal container is removed as a fallback.

## Attribution
- Author: [**DeepakNess**](https://deepakness.com)

## Disclaimer
This project is not affiliated with or endorsed by OpenAI. "ChatGPT" is a trademark of its respective owner.
