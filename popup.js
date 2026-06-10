(() => {
  const FORMATS = {
    html: { extension: 'html', label: 'HTML' },
    json: { extension: 'json', label: 'JSON' },
    markdown: { extension: 'md', label: 'Markdown' },
    text: { extension: 'txt', label: 'TXT' },
  };

  const SCROLL_HINT = 'Scroll up to load older messages before exporting.';

  const state = {
    format: 'markdown',
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', () => {
    els.copy = document.querySelector('[data-action="copy"]');
    els.export = document.querySelector('[data-action="export"]');
    els.formatButtons = Array.from(document.querySelectorAll('[data-format]'));
    els.includeMetadata = document.querySelector('[data-option="includeMetadata"]');
    els.includeSources = document.querySelector('[data-option="includeSources"]');
    els.status = document.querySelector('[data-status]');

    for (const button of els.formatButtons) {
      button.addEventListener('click', () => {
        state.format = button.dataset.format || 'markdown';
        refreshFormats();
      });
    }

    els.copy.addEventListener('click', () => copyExport());
    els.export.addEventListener('click', () => downloadExport());
    refreshFormats();
    refreshStatus();
  });

  function refreshFormats() {
    for (const button of els.formatButtons) {
      const selected = button.dataset.format === state.format;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', `${selected}`);
    }
  }

  function updateActionStates(enabled) {
    for (const button of [els.copy, els.export]) {
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', `${!enabled}`);
    }
  }

  function truncateTitle(title, max = 40) {
    const clean = `${title || ''}`.trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1)}…`;
  }

  function formatStatusMessage(response) {
    const count = response.messageCount || 0;
    if (!count) return 'No loaded conversation messages found on this tab.';

    const titlePart = response.title ? `"${truncateTitle(response.title)}" — ` : '';
    const countPart = `${count} message${count === 1 ? '' : 's'}`;

    if (response.mayBeIncomplete) {
      const domTurnCount = response.domTurnCount || count;
      return `${titlePart}${countPart}. May be incomplete (${count} of ~${domTurnCount} visible turns). ${response.scrollHint || SCROLL_HINT}`;
    }

    return `${titlePart}${countPart}. ${response.scrollHint || SCROLL_HINT}`;
  }

  function formatSuccessStatus(prefix, response) {
    let message = `${prefix} ${response.messageCount} message${response.messageCount === 1 ? '' : 's'}.`;
    if (response.mayBeIncomplete) {
      const domTurnCount = response.domTurnCount || response.messageCount;
      message += ` May be incomplete (${response.messageCount} of ~${domTurnCount} visible turns).`;
    }
    return message;
  }

  async function refreshStatus() {
    const response = await sendToActiveTab({ type: 'status' });
    if (!response?.ok) {
      updateActionStates(false);
      setStatus(response?.error || 'Could not read the active tab.', 'warn');
      return;
    }

    const count = response.messageCount || 0;
    updateActionStates(count > 0);
    setStatus(formatStatusMessage(response), response.mayBeIncomplete ? 'warn' : 'info');
  }

  async function copyExport() {
    if (els.copy?.disabled) return;

    setStatus('Preparing copy…', 'info');
    const response = await sendToActiveTab({
      format: state.format,
      includeMetadata: els.includeMetadata.checked,
      includeSources: els.includeSources.checked,
      type: 'export-content',
    });

    if (!response?.ok) {
      setStatus(response?.error || 'Copy failed. Use Export to save a local file instead.', 'warn');
      return;
    }

    try {
      await writeClipboard(response.content);
    } catch (_) {
      setStatus('Copy failed. Use Export to save a local file instead.', 'warn');
      return;
    }

    setStatus(
      formatSuccessStatus(`Copied ${FORMATS[state.format].label} for`, response),
      response.mayBeIncomplete ? 'warn' : 'success',
    );
  }

  async function downloadExport() {
    if (els.export?.disabled) return;

    const response = await sendToActiveTab({
      format: state.format,
      includeMetadata: els.includeMetadata.checked,
      includeSources: els.includeSources.checked,
      type: 'export-download',
    });

    if (!response?.ok) {
      setStatus(response?.error || 'Export failed. Try again.', 'warn');
      return;
    }

    setStatus(
      formatSuccessStatus(`Exported ${FORMATS[state.format].label} for`, response),
      response.mayBeIncomplete ? 'warn' : 'success',
    );
  }

  async function writeClipboard(text) {
    if (!text) throw new Error('No content to copy');

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (!ok) throw new Error('Copy command failed');
  }

  function isChatGptUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'chatgpt.com' || host.endsWith('.chatgpt.com') || host === 'chat.openai.com';
    } catch (_) {
      return false;
    }
  }

  async function sendToActiveTab(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return { error: 'No active tab found.', ok: false };
      }

      if (!tab.url || !isChatGptUrl(tab.url)) {
        return { error: 'Open a ChatGPT conversation tab first.', ok: false };
      }

      return await chrome.tabs.sendMessage(tab.id, {
        ...message,
        source: 'no-thanks-chatgpt-popup',
      });
    } catch (_) {
      return {
        error: 'Reload the ChatGPT tab, then try again.',
        ok: false,
      };
    }
  }

  function setStatus(message, tone = 'info') {
    els.status.textContent = message;
    els.status.dataset.tone = tone;
  }
})();
