# No Thanks, ChatGPT

Automatically dismiss ChatGPT’s “Thanks for trying ChatGPT” popup by clicking “Stay logged out,” keeping the site usable while logged out.

## What It Does
- Auto-clicks the “Stay logged out” link when the login modal appears.
- As a fallback, removes that specific modal if clicking isn’t possible.
- Runs only on ChatGPT domains; no background page, storage, or analytics.

## Why
Some users prefer to browse ChatGPT while logged out but are interrupted by a modal. This extension removes that friction.

## Install (from source)
1. Download or clone this repository.
2. Unzip it in a folder, say `no-thanks-chatgpt`
2. Open `chrome://extensions`.
3. Enable `Developer mode` (top right).
4. Click `Load unpacked` and select the `no-thanks-chatgpt` folder.

## Web Store
Once published, the Web Store link will go here: 

## Permissions
- `host_permissions`:
  - `https://chat.openai.com/*`
  - `https://chatgpt.com/*`
  - `https://*.chatgpt.com/*`

Justification: The content script must run on ChatGPT pages to detect the modal text and click “Stay logged out.” No other sites are matched.

## Privacy
- No data collection, storage, or transmission.
- No external network requests.
- Reads only minimal page text to find and click the “Stay logged out” link.

## How It Works
- A `MutationObserver` watches for the modal to be added to the DOM.
- On detection, the script searches for the “Stay logged out” link and clicks it.
- If the link cannot be clicked, the specific modal container is removed as a fallback.

## Attribution
- Author: [**DeepakNess**](https://deepakness.com)

## Disclaimer
This project is not affiliated with or endorsed by OpenAI. “ChatGPT” is a trademark of its respective owner.