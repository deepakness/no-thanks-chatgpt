// No Thanks, ChatGPT — content script
// Goal: Never show ChatGPT popups, Google sign-in prompts, cookie notices, signup buttons, sidebar upsells, or promo cards when browsing logged out.

(() => {
  const TEXT_STAY_LOGGED_OUT = /\bstay\s+logged\s+out\b/i;
  const TEXT_THANKS_DIALOG = /\bthanks\s+for\s+trying\s+chatgpt\b/i;
  const TEXT_MAYBE_LATER = /\bmaybe\s+later\b/i;
  const TEXT_TRY_GO_FREE = /\btry\s+go,?\s+free\b/i;
  const TEXT_REJECT_COOKIES = /\breject\s+non-essential\b/i;
  const TEXT_COOKIE_DIALOG = /\bwe\s+use\s+cookies\b/i;
  const TEXT_PROMO_CARD = /\bget\s+smarter\s+responses,?\s+upload\s+files\b/i;
  const TEXT_SIDEBAR_LOGIN_PANE = /\bget\s+responses\s+tailored\s+to\s+you\b[\s\S]*\blog\s+in\s+to\s+get\s+answers\s+based\s+on\s+saved\s+chats\b/i;
  const TEXT_GOOGLE_SIGN_IN_PROMPT = /\bsign\s+in\s+to\s+chatgpt(?:\.com)?\s+with\s+google(?:\.com)?\b/i;
  const TEXT_CONTINUE_AS = /\bcontinue\s+as\b/i;
  const SIDEBAR_LOGIN_PANE_SELECTOR = [
    '.sticky.bottom-0',
    '[class*="sidebar-login-pane-bg"]',
  ].join(',');
  const SIDEBAR_LOGIN_PANE_STYLE_ID = 'no-thanks-chatgpt-sidebar-login-pane-style';
  const SIGNUP_BUTTON_SELECTOR = '[data-testid="signup-button"]';
  const SIGNUP_BUTTON_STYLE_ID = 'no-thanks-chatgpt-signup-button-style';
  const GOOGLE_PROMPT_SELECTOR = [
    '#credential_picker_container',
    'iframe[src*="accounts.google.com/gsi/iframe/select"]',
    'iframe[src*="accounts.google.com/gsi/iframe/intermediate"]',
  ].join(',');
  const GOOGLE_PROMPT_STYLE_ID = 'no-thanks-chatgpt-google-prompt-style';

  let handledOnce = false;
  let handledGoPopup = false;
  let handledCookies = false;
  let googleFedCmPatched = false;

  function isGoogleIdentityRequest(options) {
    const providers = options?.identity?.providers;
    if (!Array.isArray(providers)) return false;

    return providers.some((provider) => {
      const configURL = `${provider?.configURL || provider?.configUrl || ''}`.toLowerCase();
      return configURL.includes('accounts.google.com') || configURL.includes('google.com/gsi');
    });
  }

  function blockGoogleFedCmPrompt() {
    if (googleFedCmPatched) return;
    googleFedCmPatched = true;

    const credentials = navigator.credentials;
    const originalGet = credentials?.get;
    if (typeof originalGet !== 'function') return;

    const blockedGet = function (options) {
      if (isGoogleIdentityRequest(options) && !navigator.userActivation?.isActive) {
        return Promise.reject(new DOMException('Google sign-in prompt blocked by No Thanks, ChatGPT.', 'AbortError'));
      }

      return originalGet.apply(this, arguments);
    };

    try {
      Object.defineProperty(credentials, 'get', {
        configurable: false,
        writable: false,
        value: blockedGet,
      });
    } catch (_) {
      try {
        credentials.get = blockedGet;
      } catch (_) {
        // ignore
      }
    }
  }

  function injectGooglePromptStyles() {
    if (document.getElementById(GOOGLE_PROMPT_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = GOOGLE_PROMPT_STYLE_ID;
    style.textContent = `
      #credential_picker_container,
      iframe[src*="accounts.google.com/gsi/iframe/select"],
      iframe[src*="accounts.google.com/gsi/iframe/intermediate"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    (document.head || document.documentElement)?.appendChild(style);
  }

  function injectSidebarLoginPaneStyles() {
    if (document.getElementById(SIDEBAR_LOGIN_PANE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = SIDEBAR_LOGIN_PANE_STYLE_ID;
    style.textContent = `
      [class*="sidebar-login-pane-bg"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    (document.head || document.documentElement)?.appendChild(style);
  }

  function injectSignupButtonStyles() {
    if (document.getElementById(SIGNUP_BUTTON_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = SIGNUP_BUTTON_STYLE_ID;
    style.textContent = `
      ${SIGNUP_BUTTON_SELECTOR} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    (document.head || document.documentElement)?.appendChild(style);
  }

  function safeClick(el) {
    try {
      el.click?.();
      // Some frameworks listen for real mouse events
      el.dispatchEvent?.(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    } catch (_) {
      // ignore
    }
  }

  function isGoogleSignInPrompt(el) {
    const txt = (el.textContent || '');
    return TEXT_GOOGLE_SIGN_IN_PROMPT.test(txt) && TEXT_CONTINUE_AS.test(txt);
  }

  function removeGoogleSignInPrompt(root = document) {
    injectGooglePromptStyles();

    const prompts = new Set();
    if (root instanceof Element && root.matches(GOOGLE_PROMPT_SELECTOR)) {
      prompts.add(root);
    }

    const matchingPrompts = root.querySelectorAll?.(GOOGLE_PROMPT_SELECTOR) || [];
    for (const prompt of matchingPrompts) {
      prompts.add(prompt);
    }

    for (const prompt of prompts) {
      const container = prompt.closest?.('#credential_picker_container') || prompt;
      container.remove();
    }

    const dialogs = root.querySelectorAll?.('[role="dialog"], [aria-modal="true"]') || [];
    for (const dialog of dialogs) {
      if (isGoogleSignInPrompt(dialog)) {
        const closeButton = dialog.querySelector('button[aria-label*="Close" i], [role="button"][aria-label*="Close" i]');
        if (closeButton) {
          safeClick(closeButton);
        } else {
          dialog.remove();
        }
      }
    }

    if (root instanceof Element && isGoogleSignInPrompt(root)) {
      root.remove();
    }
  }

  function focusPromptTextarea() {
    setTimeout(() => {
      const textarea = document.querySelector('#prompt-textarea');
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  function findStayLoggedOut(root = document) {
    const candidates = root.querySelectorAll('a, button, [role="button"], [data-testid], [class]');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (TEXT_STAY_LOGGED_OUT.test(txt)) return el;
    }
    return null;
  }

  function removeThanksDialog(root = document) {
    // Fallback: if we can't click the link, hide/remove the dialog itself
    const dialogs = root.querySelectorAll('[role="dialog"], [id^="radix-"]');
    for (const d of dialogs) {
      const txt = (d.textContent || '').toLowerCase();
      if (TEXT_THANKS_DIALOG.test(txt)) {
        d.remove();
      }
    }
  }

  function findMaybeLater(root = document) {
    const candidates = root.querySelectorAll('button, [role="button"]');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (TEXT_MAYBE_LATER.test(txt)) return el;
    }
    return null;
  }

  function isGoPopup(el) {
    const txt = (el.textContent || '');
    return TEXT_TRY_GO_FREE.test(txt);
  }

  function removeGoPopup(root = document) {
    // Fallback: if we can't click "Maybe later", hide/remove the dialog itself
    const dialogs = root.querySelectorAll('[role="dialog"], [id^="radix-"]');
    for (const d of dialogs) {
      if (isGoPopup(d)) {
        d.remove();
      }
    }
  }

  function tryHandleGoPopup(root = document) {
    if (handledGoPopup) return false;
    // Only proceed if this looks like the Go popup
    const dialogs = root.querySelectorAll('[role="dialog"], [id^="radix-"]');
    let foundGoDialog = false;
    for (const d of dialogs) {
      if (isGoPopup(d)) {
        foundGoDialog = true;
        break;
      }
    }
    if (!foundGoDialog && root !== document && !isGoPopup(root)) return false;
    
    const btn = findMaybeLater(root);
    if (btn) {
      handledGoPopup = true;
      safeClick(btn);
      focusPromptTextarea();
      return true;
    }
    // As a last resort, remove the dialog if present
    removeGoPopup(root);
    return false;
  }

  function findRejectCookies(root = document) {
    const candidates = root.querySelectorAll('button, [role="button"]');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (TEXT_REJECT_COOKIES.test(txt)) return el;
    }
    return null;
  }

  function isCookieDialog(el) {
    const txt = (el.textContent || '');
    return TEXT_COOKIE_DIALOG.test(txt);
  }

  function removeCookieDialog(root = document) {
    // Fallback: if we can't click "Reject non-essential", hide/remove the dialog itself
    const dialogs = root.querySelectorAll('[role="dialog"]');
    for (const d of dialogs) {
      if (isCookieDialog(d)) {
        d.remove();
      }
    }
  }

  function tryHandleCookies(root = document) {
    if (handledCookies) return false;
    // Only proceed if this looks like the cookie dialog
    const dialogs = root.querySelectorAll('[role="dialog"]');
    let foundCookieDialog = false;
    for (const d of dialogs) {
      if (isCookieDialog(d)) {
        foundCookieDialog = true;
        break;
      }
    }
    if (!foundCookieDialog && root !== document && !isCookieDialog(root)) return false;
    
    const btn = findRejectCookies(root);
    if (btn) {
      handledCookies = true;
      safeClick(btn);
      focusPromptTextarea();
      return true;
    }
    // As a last resort, remove the dialog if present
    removeCookieDialog(root);
    return false;
  }

  function isPromoCard(el) {
    const txt = (el.textContent || '');
    return TEXT_PROMO_CARD.test(txt);
  }

  function isSidebarLoginPane(el) {
    const txt = (el.textContent || '');
    return TEXT_SIDEBAR_LOGIN_PANE.test(txt);
  }

  function removeSidebarLoginPane(root = document) {
    injectSidebarLoginPaneStyles();

    const panes = new Set();
    const ancestor = root instanceof Element ? root.closest(SIDEBAR_LOGIN_PANE_SELECTOR) : null;
    if (ancestor) {
      panes.add(ancestor);
    }

    if (root instanceof Element && root.matches(SIDEBAR_LOGIN_PANE_SELECTOR)) {
      panes.add(root);
    }

    const candidates = root.querySelectorAll?.(SIDEBAR_LOGIN_PANE_SELECTOR) || [];
    for (const candidate of candidates) {
      panes.add(candidate);
    }

    for (const pane of panes) {
      if (isSidebarLoginPane(pane)) {
        pane.remove();
      }
    }
  }

  function removeSignupButton(root = document) {
    injectSignupButtonStyles();

    if (root instanceof Element && root.matches(SIGNUP_BUTTON_SELECTOR)) {
      root.remove();
    }

    const buttons = root.querySelectorAll?.(SIGNUP_BUTTON_SELECTOR) || [];
    for (const button of buttons) {
      button.remove();
    }
  }

  function removePromoCard(root = document) {
    // Remove the "Get smarter responses" promotional card above input
    const asides = root.querySelectorAll('aside');
    for (const aside of asides) {
      if (isPromoCard(aside)) {
        // Remove the parent container that holds the aside
        const container = aside.closest('.absolute.bottom-full');
        if (container) {
          container.remove();
        } else {
          aside.remove();
        }
      }
    }
    // Also check if root itself is an aside or container
    if (root.tagName === 'ASIDE' && isPromoCard(root)) {
      root.remove();
    }
  }

  function tryHandle(root = document) {
    if (handledOnce) return false;
    const link = findStayLoggedOut(root);
    if (link) {
      handledOnce = true;
      safeClick(link);
      focusPromptTextarea();
      return true;
    }
    // As a last resort, remove the dialog if present
    removeThanksDialog(root);
    return false;
  }

  // Initial attempt after the page becomes idle
  blockGoogleFedCmPrompt();
  injectGooglePromptStyles();
  injectSidebarLoginPaneStyles();
  injectSignupButtonStyles();
  tryHandle();
  tryHandleGoPopup();
  tryHandleCookies();
  removeGoogleSignInPrompt();
  removePromoCard();
  removeSidebarLoginPane();
  removeSignupButton();

  // Observe DOM for dynamically inserted popups
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Check added nodes quickly
      for (const n of m.addedNodes) {
        const nodeRoot = n instanceof Element ? n : n.parentElement;
        if (!nodeRoot) continue;
        if (!handledOnce) tryHandle(nodeRoot);
        if (!handledGoPopup) tryHandleGoPopup(nodeRoot);
        if (!handledCookies) tryHandleCookies(nodeRoot);
        removeGoogleSignInPrompt(nodeRoot);
        // Promo card can reappear, always check
        removePromoCard(nodeRoot);
        removeSidebarLoginPane(nodeRoot);
        removeSignupButton(nodeRoot);
      }
    }
  });

  function startObserver() {
    if (!document.documentElement) {
      setTimeout(startObserver, 0);
      return;
    }

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  startObserver();

  // Light fallback polling for the first few seconds to reduce flicker
  const start = Date.now();
  const interval = setInterval(() => {
    if (Date.now() - start > 8000) {
      clearInterval(interval);
      return;
    }
    if (!handledOnce) tryHandle();
    if (!handledGoPopup) tryHandleGoPopup();
    if (!handledCookies) tryHandleCookies();
    removeGoogleSignInPrompt();
    removePromoCard();
    removeSidebarLoginPane();
    removeSignupButton();
  }, 250);
})();
