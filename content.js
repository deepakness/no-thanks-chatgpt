// No Thanks, ChatGPT — content script
// Goal: Never show the “Thanks for trying ChatGPT” dialog when browsing logged out.

(() => {
  const TEXT_STAY_LOGGED_OUT = /\bstay\s+logged\s+out\b/i;
  const TEXT_THANKS_DIALOG = /\bthanks\s+for\s+trying\s+chatgpt\b/i;

  let handledOnce = false;

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
    // Fallback: if we can’t click the link, hide/remove the dialog itself
    const dialogs = root.querySelectorAll('[role="dialog"], [id^="radix-"]');
    for (const d of dialogs) {
      const txt = (d.textContent || '').toLowerCase();
      if (TEXT_THANKS_DIALOG.test(txt)) {
        d.remove();
      }
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

  // Observe DOM for dynamically inserted popups
  const observer = new MutationObserver((mutations) => {
    if (handledOnce) return;
    for (const m of mutations) {
      // Check added nodes quickly
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (tryHandle(n)) {
          observer.disconnect();
          return;
        }
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
    if (handledOnce || Date.now() - start > 8000) {
      clearInterval(interval);
      return;
    }
    tryHandle();
  }, 250);
})();
