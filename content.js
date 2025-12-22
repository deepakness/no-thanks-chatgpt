// No Thanks, ChatGPT — content script
// Goal: Never show the "Thanks for trying ChatGPT" dialog, "Try Go, Free" popup, cookie notice, or promo cards when browsing logged out.

(() => {
  const TEXT_STAY_LOGGED_OUT = /\bstay\s+logged\s+out\b/i;
  const TEXT_THANKS_DIALOG = /\bthanks\s+for\s+trying\s+chatgpt\b/i;
  const TEXT_MAYBE_LATER = /\bmaybe\s+later\b/i;
  const TEXT_TRY_GO_FREE = /\btry\s+go,?\s+free\b/i;
  const TEXT_REJECT_COOKIES = /\breject\s+non-essential\b/i;
  const TEXT_COOKIE_DIALOG = /\bwe\s+use\s+cookies\b/i;
  const TEXT_PROMO_CARD = /\bget\s+smarter\s+responses,?\s+upload\s+files\b/i;

  let handledOnce = false;
  let handledGoPopup = false;
  let handledCookies = false;

  function safeClick(el) {
    try {
      el.click?.();
      // Some frameworks listen for real mouse events
      el.dispatchEvent?.(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    } catch (_) {
      // ignore
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
  tryHandle();
  tryHandleGoPopup();
  tryHandleCookies();
  removePromoCard();

  // Observe DOM for dynamically inserted popups
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Check added nodes quickly
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (!handledOnce) tryHandle(n);
        if (!handledGoPopup) tryHandleGoPopup(n);
        if (!handledCookies) tryHandleCookies(n);
        // Promo card can reappear, always check
        removePromoCard(n);
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

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
    removePromoCard();
  }, 250);
})();
