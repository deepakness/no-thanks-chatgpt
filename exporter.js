// No Thanks, ChatGPT - local conversation exporter
// Reads the rendered conversation only. No network calls, storage, or extra permissions.

(() => {
  const HOST_ID = 'no-thanks-chatgpt-exporter';
  const ROOT_KEY = '__noThanksChatGPTExporter';
  const DEFAULT_FORMAT = 'markdown';
  const SCROLL_HINT = 'Scroll up to load older messages before exporting.';
  const root = window[ROOT_KEY] || (window[ROOT_KEY] = {});
  const ROLE_LABELS = {
    assistant: 'Assistant',
    system: 'System',
    tool: 'Tool',
    user: 'User',
  };
  const FORMATS = {
    markdown: {
      extension: 'md',
      label: 'MD',
      mime: 'text/markdown;charset=utf-8',
      title: 'Markdown',
    },
    json: {
      extension: 'json',
      label: 'JSON',
      mime: 'application/json;charset=utf-8',
      title: 'JSON',
    },
    html: {
      extension: 'html',
      label: 'HTML',
      mime: 'text/html;charset=utf-8',
      title: 'HTML',
    },
    text: {
      extension: 'txt',
      label: 'TXT',
      mime: 'text/plain;charset=utf-8',
      title: 'Plain text',
    },
  };
  const INTERACTIVE_SELECTOR = [
    'button',
    'input',
    'select',
    'textarea',
    'form',
    'menu',
    'nav',
    'svg',
    'canvas',
    '[role="button"]',
    '[contenteditable="true"]',
    '[aria-hidden="true"]',
    '[data-testid*="copy" i]',
    '[data-testid*="feedback" i]',
    '[data-testid*="composer" i]',
    '[data-testid*="voice" i]',
  ].join(',');
  const THINKING_SELECTOR = [
    '[class*="reasoning" i]',
    '[class*="thought" i]',
    '[data-testid*="thought" i]',
    '[data-testid*="reasoning" i]',
  ].join(',');
  const BLOCK_TAGS = new Set([
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DD',
    'DETAILS',
    'DIV',
    'DL',
    'DT',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HR',
    'LI',
    'MAIN',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'UL',
  ]);
  const ALLOWED_HTML_TAGS = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'EM',
    'I',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'LI',
    'OL',
    'P',
    'PRE',
    'STRONG',
    'TABLE',
    'TBODY',
    'TD',
    'TH',
    'THEAD',
    'TR',
    'UL',
  ]);

  const state = {
    format: DEFAULT_FORMAT,
    includeMetadata: true,
    includeSources: true,
    open: false,
  };

  let host;
  let shadow;
  let els = {};

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
      return;
    }
    fn();
  }

  function ensureUi() {
    if (typeof document === 'undefined' || !document.documentElement) return;

    const existing = document.getElementById(HOST_ID);
    if (existing?.isConnected && existing.shadowRoot) {
      host = existing;
      shadow = existing.shadowRoot;
      applyHostStyles(existing);
      attachElsFromShadow();
      return;
    }

    existing?.remove();
    init();
  }

  function init() {
    const parent = document.body || document.documentElement;
    if (!parent || document.getElementById(HOST_ID)) return;

    host = document.createElement('div');
    host.id = HOST_ID;
    applyHostStyles(host);
    parent.appendChild(host);

    shadow = host.attachShadow({ mode: 'open' });
    const ui = createUi();
    shadow.append(ui.style, ui.panel);
    els = ui.els;

    bindUi();
    refreshUiState();
    setInitialStatus();
  }

  function hasConversationShell() {
    return getConversationTurnElements().length > 0 || document.querySelectorAll('[data-message-author-role]').length > 0;
  }

  function setInitialStatus() {
    if (hasConversationShell()) {
      setStatus(
        { hint: SCROLL_HINT, main: 'Ready to export. Opens with an automatic scan.' },
        'info',
      );
      updateActionStates(true);
      return;
    }

    updateStatusFromConversation();
  }

  function applyHostStyles(element) {
    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('right', '16px', 'important');
    element.style.setProperty('top', '72px', 'important');
    element.style.setProperty('z-index', '2147483646', 'important');
    element.style.setProperty('display', 'block', 'important');
    element.style.setProperty('visibility', 'visible', 'important');
    element.style.setProperty('opacity', '1', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  }

  function attachElsFromShadow() {
    if (!shadow) return;

    els.trigger = shadow.querySelector('.ntcg-trigger');
    els.menu = shadow.querySelector('.ntcg-menu');
    els.copyButton = shadow.querySelector('[data-action="copy"]');
    els.exportButton = shadow.querySelector('[data-action="export"]');
    els.formatButtons = Array.from(shadow.querySelectorAll('.ntcg-format'));
    els.includeMetadata = shadow.querySelector('[data-option="includeMetadata"]');
    els.includeSources = shadow.querySelector('[data-option="includeSources"]');
    els.statusMain = shadow.querySelector('.ntcg-status-main');
    els.statusHint = shadow.querySelector('.ntcg-status-hint');
    els.statusFooter = shadow.querySelector('.ntcg-status-footer');
    els.closeButton = shadow.querySelector('.ntcg-close');
  }

  function startResilience() {
    root.resilienceObserver?.disconnect();
    if (root.resilienceInterval) {
      clearInterval(root.resilienceInterval);
      root.resilienceInterval = null;
    }

    root.resilienceObserver = new MutationObserver(() => {
      if (typeof document === 'undefined' || !document.documentElement) return;

      if (!document.getElementById(HOST_ID)?.isConnected) {
        ensureUi();
      }
    });

    const observe = () => {
      const target = document.body || document.documentElement;
      if (!target) {
        setTimeout(observe, 250);
        return;
      }

      root.resilienceObserver.observe(target, {
        childList: true,
        subtree: true,
      });
    };

    observe();
    root.resilienceInterval = setInterval(ensureUi, 1500);
  }

  function unbindUi() {
    if (!root.uiBindings?.length) return;

    for (const binding of root.uiBindings) {
      binding.target.removeEventListener(binding.type, binding.handler, binding.options);
    }

    root.uiBindings = [];
  }

  function bindUiListener(target, type, handler, options) {
    if (!target || typeof handler !== 'function') return;

    target.addEventListener(type, handler, options);
    root.uiBindings = root.uiBindings || [];
    root.uiBindings.push({ handler, options, target, type });
  }

  function bindDocumentEvents() {
    if (root.docClickHandler) {
      document.removeEventListener('click', root.docClickHandler);
    }
    if (root.docKeyHandler) {
      document.removeEventListener('keydown', root.docKeyHandler);
    }

    root.docClickHandler = (event) => {
      if (!state.open || !host) return;
      if (!event.composedPath().includes(host)) setOpen(false);
    };

    root.docKeyHandler = (event) => {
      if (event.key === 'Escape' && state.open) {
        setOpen(false);
        els.trigger?.focus();
      }
    };

    document.addEventListener('click', root.docClickHandler);
    document.addEventListener('keydown', root.docKeyHandler);

    if (root.resizeHandler) {
      window.removeEventListener('resize', root.resizeHandler);
    }
    root.resizeHandler = () => {
      if (state.open) positionMenu();
    };
    window.addEventListener('resize', root.resizeHandler);
  }

  function bindUi() {
    if (!els.trigger || !els.exportButton || !els.copyButton) return;

    unbindUi();

    bindUiListener(els.trigger, 'click', () => setOpen(!state.open));
    if (els.closeButton) {
      bindUiListener(els.closeButton, 'click', () => setOpen(false));
    }
    bindUiListener(els.exportButton, 'click', () => exportConversation());
    bindUiListener(els.copyButton, 'click', () => copyConversation());
    if (els.includeMetadata) {
      bindUiListener(els.includeMetadata, 'change', () => {
        state.includeMetadata = els.includeMetadata.checked;
      });
    }
    if (els.includeSources) {
      bindUiListener(els.includeSources, 'change', () => {
        state.includeSources = els.includeSources.checked;
      });
    }

    for (const button of els.formatButtons) {
      bindUiListener(button, 'click', () => {
        state.format = button.dataset.format || DEFAULT_FORMAT;
        refreshUiState();
      });
    }

    bindDocumentEvents();
  }

  function setOpen(open) {
    state.open = open;
    if (!els.menu || !els.trigger || !host) return;

    els.menu.hidden = !open;
    els.trigger.setAttribute('aria-expanded', `${open}`);
    host.toggleAttribute('data-open', open);

    if (open) {
      updateStatusFromConversation(null, { prepare: true });
      requestAnimationFrame(() => {
        positionMenu();
        const selected = els.formatButtons.find((button) => button.dataset.format === state.format);
        (selected || els.exportButton)?.focus();
      });
    }
  }

  function refreshUiState() {
    for (const button of els.formatButtons || []) {
      const selected = button.dataset.format === state.format;
      button.setAttribute('aria-pressed', `${selected}`);
      button.classList.toggle('is-selected', selected);
    }
    if (els.includeMetadata) els.includeMetadata.checked = state.includeMetadata;
    if (els.includeSources) els.includeSources.checked = state.includeSources;
  }

  function truncateTitle(title, max = 40) {
    const clean = `${title || ''}`.trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1)}…`;
  }

  function formatStatusParts(data, extra) {
    if (extra) return { hint: '', main: extra };
    if (!data.messageCount) {
      return { hint: '', main: 'No conversation messages found on this page yet.' };
    }

    const titlePart = data.title ? truncateTitle(data.title) : 'Conversation';
    const main = `${titlePart} · ${data.messageCount} message${data.messageCount === 1 ? '' : 's'}`;
    const hint = data.mayBeIncomplete
      ? `May be incomplete (${data.messageCount} of ~${data.domTurnCount} visible turns). ${SCROLL_HINT}`
      : SCROLL_HINT;

    return { hint, main };
  }

  function formatSuccessParts(prefix, data) {
    const main = `${prefix} ${data.messageCount} message${data.messageCount === 1 ? '' : 's'}.`;
    const hint = data.mayBeIncomplete
      ? `May be incomplete (${data.messageCount} of ~${data.domTurnCount} visible turns).`
      : '';
    return { hint, main };
  }

  function updateActionStates(count) {
    if (!els.copyButton || !els.exportButton) return;

    const disabled = count === 0;
    for (const button of [els.copyButton, els.exportButton]) {
      button.disabled = disabled;
      button.setAttribute('aria-disabled', `${disabled}`);
    }
  }

  async function updateStatusFromConversation(extra, options = {}) {
    if (options.prepare) {
      setStatus({ hint: SCROLL_HINT, main: 'Loading conversation messages…' }, 'info');
      await prepareConversationDom();
    }

    const data = collectConversation();
    updateActionStates(data.messageCount);

    if (!data.messageCount) {
      setStatus(extra || { hint: '', main: 'No conversation messages found on this page yet.' }, 'warn');
      return;
    }

    setStatus(extra || formatStatusParts(data), data.mayBeIncomplete ? 'warn' : 'info');
    positionMenu();
  }

  function setStatus(message, tone = 'info') {
    const parts = typeof message === 'string' ? { hint: '', main: message } : message;
    if (els.statusMain) els.statusMain.textContent = parts.main || '';
    if (els.statusHint) {
      els.statusHint.textContent = parts.hint || '';
      els.statusHint.hidden = !parts.hint;
    }
    if (els.statusFooter) {
      els.statusFooter.dataset.tone = tone;
      els.statusFooter.hidden = !parts.hint;
    }
    if (els.statusMain) els.statusMain.dataset.tone = tone;
    positionMenu();
  }

  function positionMenu() {
    const panel = shadow?.querySelector('.ntcg-panel');
    if (!panel || !els.menu || !els.trigger || els.menu.hidden) return;

    const menuHeight = els.menu.offsetHeight;
    if (!menuHeight) return;

    const triggerRect = els.trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - 16;
    const spaceAbove = triggerRect.top - 16;
    panel.classList.toggle('ntcg-flip', spaceBelow < menuHeight && spaceAbove > spaceBelow);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function prepareConversationDom() {
    const turns = getConversationTurnElements();
    if (!turns.length) return;

    const savedY = window.scrollY;

    // Mount virtualized early turns before walking the full thread.
    turns[0]?.scrollIntoView({ block: 'start', behavior: 'auto' });
    await delay(80);

    for (const turn of turns) {
      turn.scrollIntoView({ block: 'center', behavior: 'auto' });
      await delay(70);
    }

    for (const turn of turns) {
      const role = normalizeRole(turn.getAttribute('data-turn')) || roleFromTurn(turn);
      const hasContent = Boolean(turn.querySelector('[data-message-author-role]')) || Boolean(normalizePlainText(turn.textContent || ''));
      if (!hasContent && role) {
        turn.scrollIntoView({ block: 'start', behavior: 'auto' });
        await delay(150);
      }
    }

    window.scrollTo(0, savedY);
    await delay(40);
  }

  function getConversationTurnElements() {
    const testidTurns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]')).filter((element) => {
      return !element.parentElement?.closest('[data-testid^="conversation-turn-"]');
    });
    if (testidTurns.length) return testidTurns;

    return Array.from(document.querySelectorAll('[data-turn]')).filter((element) => {
      return !element.parentElement?.closest('[data-testid^="conversation-turn-"], [data-turn]');
    });
  }

  function estimateDomTurnCount() {
    const turns = getConversationTurnElements();
    if (turns.length) return turns.length;

    return document.querySelectorAll('[data-message-author-role]').length;
  }

  function finalizeMessages(messages) {
    return dedupeMessages(messages).map((message, index) => ({
      ...message,
      index: index + 1,
    }));
  }

  function collectConversation() {
    const exportedAt = new Date().toISOString();
    const title = getConversationTitle();
    const domTurnCount = estimateDomTurnCount();
    const turnElements = getConversationTurnElements();
    let best = { extractionMethod: 'none', messages: [] };

    // Prefer one message per conversation turn. Role-node scraping splits assistant
    // "thinking" status blocks into separate messages when it wins by raw count.
    if (turnElements.length) {
      const turnMessages = finalizeMessages(collectTurnMessages());
      if (turnMessages.length) {
        best = { extractionMethod: 'turn', messages: turnMessages };
      }
    }

    if (!best.messages.length) {
      const candidates = [
        { extractionMethod: 'shared', messages: collectSharedPageMessages() },
        { extractionMethod: 'role', messages: collectGroupedRoleMessages() },
        { extractionMethod: 'article', messages: collectArticleMessages() },
        { extractionMethod: 'turn', messages: collectTurnMessages() },
      ];

      for (const candidate of candidates) {
        const finalized = finalizeMessages(candidate.messages);
        if (finalized.length > best.messages.length) {
          best = { extractionMethod: candidate.extractionMethod, messages: finalized };
        }
      }
    }

    const messageCount = best.messages.length;
    const mayBeIncomplete = domTurnCount > 0 && messageCount < domTurnCount;

    return {
      domTurnCount,
      exportedAt,
      extractionMethod: best.extractionMethod,
      mayBeIncomplete,
      messageCount,
      messages: best.messages,
      title,
      url: location.href,
    };
  }

  function collectTurnMessages() {
    const messages = [];

    for (const turn of getConversationTurnElements()) {
      const role = normalizeRole(turn.getAttribute('data-turn')) || roleFromTurn(turn);
      if (!role) continue;

      const contentNode = findTurnContentRoot(turn, role);
      const message = buildMessage(role, contentNode, turn);
      if (message) messages.push(message);
    }

    return messages;
  }

  function collectGroupedRoleMessages() {
    const turns = getConversationTurnElements();
    if (turns.length) return collectTurnMessages();

    const nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
    const messages = [];

    for (const node of nodes) {
      const role = normalizeRole(node.getAttribute('data-message-author-role'));
      if (!role) continue;

      const contentNode = findContentRoot(node, role);
      const message = buildMessage(role, contentNode, node);
      if (message) messages.push(message);
    }

    return messages;
  }

  function collectSharedPageMessages() {
    const pageRoot = document.querySelector('main') || document.body;
    if (!pageRoot) return [];

    const headings = Array.from(pageRoot.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter((heading) => {
      return Boolean(roleFromHeading(heading));
    });
    const messages = [];

    for (const heading of headings) {
      const role = roleFromHeading(heading);
      const holder = document.createElement('div');
      let current = heading.nextElementSibling;

      while (current && !roleFromHeading(current)) {
        if (!isPageChromeNode(current)) {
          holder.appendChild(current.cloneNode(true));
        }
        current = current.nextElementSibling;
      }

      const message = buildMessage(role, holder, heading);
      if (message) messages.push(message);
    }

    return messages;
  }

  function collectArticleMessages() {
    const articles = Array.from(document.querySelectorAll('main article'));
    const messages = [];

    for (const article of articles) {
      const roleNode = article.querySelector('[data-message-author-role]');
      const role = normalizeRole(roleNode?.getAttribute('data-message-author-role')) || roleFromText(article);
      if (!role) continue;

      const contentNode = roleNode ? findContentRoot(roleNode, role) : article;
      const message = buildMessage(role, contentNode, article);
      if (message) messages.push(message);
    }

    return messages;
  }

  function buildMessage(role, sourceNode, metadataNode) {
    const cleaned = cleanContentClone(sourceNode);
    let markdown = normalizeMarkdown(domToMarkdown(cleaned));
    const text = normalizeReadableText(cleaned.innerText || domToText(cleaned) || cleaned.textContent || '');
    if (text.includes('\n') && !markdown.includes('\n')) {
      markdown = text;
    }
    if (!markdown && !text) return null;

    return {
      contentHtml: sanitizeHtml(cleaned),
      contentMarkdown: markdown || text,
      contentText: text,
      links: collectLinks(cleaned),
      role,
      timestamp: findTimestamp(metadataNode),
    };
  }

  function removeThinkingChrome(root) {
    if (!(root instanceof Element)) return;

    for (const element of Array.from(root.querySelectorAll(THINKING_SELECTOR))) {
      element.remove();
    }

    for (const element of Array.from(root.querySelectorAll('button, summary, [role="button"]'))) {
      const text = normalizePlainText(element.textContent || '');
      if (/^thought for\b/i.test(text)) {
        const wrapper = element.parentElement;
        if (wrapper instanceof Element && wrapper !== root && normalizePlainText(wrapper.textContent || '') === text) {
          wrapper.remove();
        } else {
          element.remove();
        }
      }
    }
  }

  function findTurnContentRoot(turn, role) {
    const content = document.createElement('div');
    const candidates = getTurnContentCandidates(turn, role);

    for (const candidate of candidates) {
      const clone = candidate.cloneNode(true);
      removeThinkingChrome(clone);
      content.appendChild(clone);
    }

    if (content.childNodes.length) {
      removeThinkingChrome(content);
      return content;
    }

    return turn;
  }

  function isThinkingNode(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches?.(THINKING_SELECTOR)) return true;
    if (node.querySelector?.(THINKING_SELECTOR)) return true;
    const text = normalizePlainText(node.textContent || '');
    return /^thought for\b/i.test(text);
  }

  function selectTurnRoleNodes(nodes) {
    const filtered = nodes.filter((node) => !isThinkingNode(node));
    return filtered.length ? filtered : nodes;
  }

  function getTurnRoleNodes(turn, role) {
    const nodes = Array.from(turn.querySelectorAll(`[data-message-author-role="${role}"]`));
    if (nodes.length) return nodes;

    const expectedRole = normalizeRole(turn.getAttribute('data-turn')) || roleFromTurn(turn);
    if (expectedRole !== role) return [];

    const holder = turn.querySelector('[data-conversation-screenshot-content], [class*="turn-messages"]');
    if (holder && normalizePlainText(holder.textContent || '')) return [holder];

    const heading = Array.from(turn.querySelectorAll('h1,h2,h3,h4,h5,h6')).find((node) => roleFromHeading(node) === role);
    if (heading) {
      const container = heading.closest('[data-conversation-screenshot-content], [class*="turn-messages"]') || heading.parentElement;
      return container ? [container] : [heading];
    }

    return [];
  }

  function getTurnContentCandidates(turn, role) {
    const roleNodes = selectTurnRoleNodes(getTurnRoleNodes(turn, role));
    const wrappers = [];

    for (const node of roleNodes) {
      const wrapper = node.closest('.text-base, [class*="text-base"], [class*="message"], [class*="markdown"], [class*="prose"]') || node;
      if (!wrappers.some((existing) => existing === wrapper || existing.contains(wrapper))) {
        wrappers.push(wrapper);
      }
    }

    if (wrappers.length) return wrappers;

    const heading = Array.from(turn.querySelectorAll('h1,h2,h3,h4,h5,h6')).find((node) => roleFromHeading(node) === role);
    if (heading) {
      const siblings = [];
      let current = heading.nextElementSibling;
      while (current && !roleFromHeading(current)) {
        if (!isPageChromeNode(current)) siblings.push(current);
        current = current.nextElementSibling;
      }
      if (siblings.length) return siblings;
    }

    return Array.from(turn.children).filter((child) => {
      if (isRoleHeadingNode(child)) return false;
      return !isPageChromeNode(child);
    });
  }

  function findContentRoot(node, role) {
    if (role === 'assistant') {
      const markdown = node.querySelector('.markdown, [class*="markdown"], .prose, [class*="prose"]');
      if (markdown) return markdown;
    }

    const nested = node.querySelector('[data-message-id] .markdown, [data-message-id] [class*="markdown"]');
    if (nested) return nested;

    return node;
  }

  function cleanContentClone(node) {
    const clone = node.cloneNode(true);
    const walkerRoot = clone.nodeType === Node.ELEMENT_NODE ? clone : clone.parentElement;
    if (!walkerRoot) return clone;

    for (const element of Array.from(walkerRoot.querySelectorAll(INTERACTIVE_SELECTOR))) {
      element.remove();
    }

    for (const element of Array.from(walkerRoot.querySelectorAll('script,style,noscript,template,footer,[role="contentinfo"]'))) {
      element.remove();
    }

    removeThinkingChrome(walkerRoot);

    for (const element of Array.from(walkerRoot.querySelectorAll('*'))) {
      const text = normalizePlainText(element.textContent || '');
      if (isRoleHeadingNode(element) || /^(Voice|ChatGPT is AI and can make mistakes\.?|ChatGPT can make mistakes\.?)$/i.test(text)) {
        element.remove();
      }
    }

    return clone;
  }

  function dedupeMessages(messages) {
    const unique = [];
    let previousKey = '';

    for (const message of messages) {
      const key = `${message.role}:${normalizePlainText(message.contentText).slice(0, 300)}`;
      if (key === previousKey) continue;
      previousKey = key;
      unique.push(message);
    }

    return unique;
  }

  function roleFromHeading(node) {
    const text = normalizePlainText(node.textContent || '').replace(/:$/, '');
    if (/^You said$/i.test(text)) return 'user';
    if (/^ChatGPT said$/i.test(text)) return 'assistant';
    return '';
  }

  function roleFromText(node) {
    const text = normalizePlainText(node.textContent || '');
    if (/^You said:/i.test(text)) return 'user';
    if (/^ChatGPT said:/i.test(text)) return 'assistant';
    return '';
  }

  function roleFromTurn(turn) {
    const heading = Array.from(turn.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(roleFromHeading);
    if (heading) return roleFromHeading(heading);

    const roleNode = turn.querySelector('[data-message-author-role]');
    const role = normalizeRole(roleNode?.getAttribute('data-message-author-role'));
    if (role) return role;

    return roleFromText(turn);
  }

  function isRoleHeadingNode(node) {
    return Boolean(roleFromHeading(node));
  }

  function normalizeRole(role) {
    const clean = `${role || ''}`.toLowerCase().trim();
    if (clean === 'assistant' || clean === 'user' || clean === 'system' || clean === 'tool') return clean;
    return '';
  }

  function isPageChromeNode(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches('form,footer,nav,[role="contentinfo"],[data-testid*="composer" i]')) return true;

    const text = normalizePlainText(node.textContent || '');
    return /^(Voice|ChatGPT is AI and can make mistakes\.?|ChatGPT can make mistakes\.?)$/i.test(text);
  }

  function findTimestamp(node) {
    const container = node?.closest?.('article,[data-testid*="conversation-turn" i]') || node;
    const time = container?.querySelector?.('time[datetime]');
    return time?.getAttribute('datetime') || '';
  }

  function collectLinks(node) {
    const links = [];
    const seen = new Set();

    for (const anchor of Array.from(node.querySelectorAll?.('a[href]') || [])) {
      const href = sanitizeUrl(anchor.getAttribute('href') || '');
      const text = normalizePlainText(anchor.textContent || href);
      if (!href || seen.has(href)) continue;
      seen.add(href);
      links.push({ href, text: text || href });
    }

    return links;
  }

  function domToMarkdown(node, context = {}) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return normalizeInlineText(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';

    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return renderBlockChildren(node, context);
    }

    const tag = node.tagName;
    if (!tag) return renderBlockChildren(node, context);

    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      return `${'#'.repeat(level)} ${renderInlineChildren(node).trim()}\n\n`;
    }

    if (tag === 'P') return `${renderInlineChildren(node).trim()}\n\n`;
    if (tag === 'BR') return '\n';
    if (tag === 'HR') return '---\n\n';
    if (tag === 'PRE') return renderCodeBlock(node);
    if (tag === 'CODE') return renderInlineCode(node.textContent || '');
    if (tag === 'BLOCKQUOTE') return renderBlockquote(node);
    if (tag === 'UL' || tag === 'OL') return renderList(node, tag === 'OL');
    if (tag === 'TABLE') return renderTable(node);
    if (tag === 'A') return renderLink(node);
    if (tag === 'STRONG' || tag === 'B') return wrapInline('**', renderInlineChildren(node));
    if (tag === 'EM' || tag === 'I') return wrapInline('*', renderInlineChildren(node));
    if (tag === 'LI') return renderBlockChildren(node, context).trim();

    if (hasBlockChildren(node)) return renderBlockChildren(node, context);
    return renderInlineChildren(node);
  }

  function renderInlineChildren(node) {
    return Array.from(node.childNodes).map((child) => {
      if (child.nodeType === Node.TEXT_NODE) return normalizeInlineText(child.textContent || '');
      if (child.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = child.tagName;
      if (tag === 'BR') return '\n';
      if (tag === 'CODE') return renderInlineCode(child.textContent || '');
      if (tag === 'A') return renderLink(child);
      if (tag === 'STRONG' || tag === 'B') return wrapInline('**', renderInlineChildren(child));
      if (tag === 'EM' || tag === 'I') return wrapInline('*', renderInlineChildren(child));
      return renderInlineChildren(child);
    }).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  function renderBlockChildren(node, context = {}) {
    let output = '';

    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = normalizeInlineText(child.textContent || '');
        if (text) output += text;
        continue;
      }

      output += domToMarkdown(child, context);
      if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(child.tagName) && !output.endsWith('\n\n')) {
        output += '\n\n';
      }
    }

    return output;
  }

  function renderCodeBlock(node) {
    const code = node.querySelector('code') || node;
    const raw = (code.textContent || '').replace(/\n+$/g, '');
    const language = getCodeLanguage(code);
    const fence = raw.includes('```') ? '````' : '```';
    return `${fence}${language}\n${raw}\n${fence}\n\n`;
  }

  function getCodeLanguage(codeNode) {
    const className = codeNode.getAttribute?.('class') || '';
    const match = className.match(/language-([a-z0-9_-]+)/i);
    return match ? match[1] : '';
  }

  function renderInlineCode(text) {
    const tickCount = Math.max(1, ...Array.from(text.matchAll(/`+/g)).map((match) => match[0].length + 1));
    const ticks = '`'.repeat(tickCount);
    const padding = text.startsWith(' ') || text.endsWith(' ') ? ' ' : '';
    return `${ticks}${padding}${text}${padding}${ticks}`;
  }

  function renderBlockquote(node) {
    const content = normalizeMarkdown(renderBlockChildren(node));
    if (!content) return '';
    return `${content.split('\n').map((line) => line ? `> ${line}` : '>').join('\n')}\n\n`;
  }

  function renderList(node, ordered) {
    const items = Array.from(node.children).filter((child) => child.tagName === 'LI');
    return `${items.map((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const content = normalizeMarkdown(domToMarkdown(item));
      const lines = content.split('\n');
      const first = lines.shift() || '';
      const rest = lines.map((line) => line ? `  ${line}` : '').join('\n');
      return rest ? `${marker} ${first}\n${rest}` : `${marker} ${first}`;
    }).join('\n')}\n\n`;
  }

  function renderTable(node) {
    const rows = Array.from(node.querySelectorAll('tr')).map((row) => {
      return Array.from(row.children).filter((cell) => cell.matches('th,td')).map((cell) => {
        return normalizePlainText(cell.textContent || '').replace(/\|/g, '\\|');
      });
    }).filter((row) => row.length);

    if (!rows.length) return '';

    const width = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => {
      while (row.length < width) row.push('');
      return row;
    });
    const header = normalizedRows[0];
    const separator = header.map(() => '---');
    const body = normalizedRows.slice(1);
    const lines = [header, separator, ...body].map((row) => `| ${row.join(' | ')} |`);
    return `${lines.join('\n')}\n\n`;
  }

  function renderLink(node) {
    const href = sanitizeUrl(node.getAttribute('href') || '');
    const label = renderInlineChildren(node).trim() || normalizePlainText(node.textContent || '') || href;
    if (!href) return label;
    return `[${label.replace(/\]/g, '\\]')}](${href.replace(/\)/g, '%29')})`;
  }

  function domToText(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';

    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return Array.from(node.childNodes).map((child) => domToText(child)).join('');
    }

    const tag = node.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'PRE') return `${node.textContent || ''}\n\n`;
    if (tag === 'TABLE') {
      return `${Array.from(node.querySelectorAll('tr')).map((row) => {
        return Array.from(row.children).filter((cell) => cell.matches('th,td')).map((cell) => normalizePlainText(cell.textContent || '')).join('\t');
      }).filter(Boolean).join('\n')}\n\n`;
    }

    const text = Array.from(node.childNodes).map((child) => domToText(child)).join('');
    return BLOCK_TAGS.has(tag) ? `${text}\n\n` : text;
  }

  function wrapInline(marker, content) {
    const clean = content.trim();
    return clean ? `${marker}${clean}${marker}` : '';
  }

  function hasBlockChildren(node) {
    return Array.from(node.children || []).some((child) => BLOCK_TAGS.has(child.tagName));
  }

  function sanitizeHtml(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return Array.from(node.childNodes).map((child) => sanitizeHtml(child)).join('');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName;
    if (tag === 'PRE') {
      const code = node.querySelector('code') || node;
      return `<pre><code>${escapeHtml(code.textContent || '')}</code></pre>`;
    }
    if (tag === 'BR') return '<br>';

    const children = Array.from(node.childNodes).map((child) => sanitizeHtml(child)).join('');
    if (!ALLOWED_HTML_TAGS.has(tag)) return children;

    if (tag === 'A') {
      const href = sanitizeUrl(node.getAttribute('href') || '');
      return href ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener">${children}</a>` : children;
    }

    return `<${tag.toLowerCase()}>${children}</${tag.toLowerCase()}>`;
  }

  function formatExport(data, format, options) {
    if (format === 'json') return formatJson(data, options);
    if (format === 'html') return formatHtml(data, options);
    if (format === 'text') return formatText(data, options);
    return formatMarkdown(data, options);
  }

  function formatMarkdown(data, options) {
    const lines = [`# ${data.title}`, ''];
    if (options.includeMetadata) {
      lines.push(`Source: ${data.url}`);
      lines.push(`Exported: ${data.exportedAt}`);
      lines.push(`Messages: ${data.messageCount}`);
      lines.push('');
    }

    for (const message of data.messages) {
      const label = ROLE_LABELS[message.role] || message.role;
      const timestamp = options.includeMetadata && message.timestamp ? ` - ${message.timestamp}` : '';
      lines.push(`## ${label}${timestamp}`);
      lines.push('');
      lines.push(message.contentMarkdown || message.contentText);
      lines.push('');
      appendSources(lines, message, options);
    }

    return `${lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()}\n`;
  }

  function formatText(data, options) {
    const lines = [data.title, '='.repeat(data.title.length), ''];
    if (options.includeMetadata) {
      lines.push(`Source: ${data.url}`);
      lines.push(`Exported: ${data.exportedAt}`);
      lines.push(`Messages: ${data.messageCount}`);
      lines.push('');
    }

    for (const message of data.messages) {
      const label = ROLE_LABELS[message.role] || message.role;
      const timestamp = options.includeMetadata && message.timestamp ? ` - ${message.timestamp}` : '';
      lines.push(`${label}${timestamp}:`);
      lines.push(message.contentText || message.contentMarkdown);
      lines.push('');
      appendSources(lines, message, options);
    }

    return `${lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()}\n`;
  }

  function formatJson(data, options) {
    const payload = {
      exportedAt: data.exportedAt,
      messageCount: data.messageCount,
      messages: data.messages.map((message) => {
        const item = {
          contentMarkdown: message.contentMarkdown,
          contentText: message.contentText,
          index: message.index,
          role: message.role,
        };
        if (options.includeMetadata && message.timestamp) item.timestamp = message.timestamp;
        if (options.includeSources) item.links = message.links;
        return item;
      }),
      schema: 'no-thanks-chatgpt.export.v1',
      title: data.title,
    };

    if (options.includeMetadata) payload.url = data.url;
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  function formatHtml(data, options) {
    const metadata = options.includeMetadata ? `
      <p><strong>Source:</strong> <a href="${escapeHtml(data.url)}" rel="noreferrer noopener">${escapeHtml(data.url)}</a></p>
      <p><strong>Exported:</strong> ${escapeHtml(data.exportedAt)}</p>
      <p><strong>Messages:</strong> ${data.messageCount}</p>
    ` : '';
    const messages = data.messages.map((message) => {
      const label = ROLE_LABELS[message.role] || message.role;
      const timestamp = options.includeMetadata && message.timestamp ? `<span>${escapeHtml(message.timestamp)}</span>` : '';
      const sources = options.includeSources && message.links.length ? `
        <details class="sources">
          <summary>Sources</summary>
          <ol>
            ${message.links.map((link) => `<li><a href="${escapeHtml(link.href)}" rel="noreferrer noopener">${escapeHtml(link.text || link.href)}</a></li>`).join('')}
          </ol>
        </details>
      ` : '';
      return `
        <article class="message ${escapeHtml(message.role)}">
          <header><strong>${escapeHtml(label)}</strong>${timestamp}</header>
          <div class="content">${message.contentHtml || `<p>${escapeHtml(message.contentText)}</p>`}</div>
          ${sources}
        </article>
      `;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; margin: 0; color: #17201b; background: #f6f8f7; }
    main { max-width: 860px; margin: 0 auto; padding: 40px 18px 72px; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 16px; }
    .meta { color: #4d5b54; font-size: 14px; margin-bottom: 28px; }
    .meta p { margin: 4px 0; }
    .message { background: #fff; border: 1px solid #dbe4df; border-radius: 8px; margin: 18px 0; padding: 18px; }
    .message header { align-items: center; color: #0b7a45; display: flex; gap: 10px; margin-bottom: 12px; }
    .message.user header { color: #145ec5; }
    .message header span { color: #66736d; font-size: 12px; font-weight: 400; }
    pre { background: #111815; border-radius: 8px; color: #f4faf7; overflow: auto; padding: 14px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    table { border-collapse: collapse; display: block; overflow-x: auto; width: max-content; max-width: 100%; }
    th, td { border: 1px solid #d3ddd8; padding: 6px 8px; }
    blockquote { border-left: 3px solid #88a096; margin-left: 0; padding-left: 14px; color: #405047; }
    a { color: #1166cc; }
    @media (prefers-color-scheme: dark) {
      body { color: #e7edea; background: #101412; }
      .meta { color: #a6b5ae; }
      .message { background: #171d1a; border-color: #2c3832; }
      th, td { border-color: #33413a; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(data.title)}</h1>
    <section class="meta">${metadata}</section>
    ${messages}
  </main>
</body>
</html>
`;
  }

  function appendSources(lines, message, options) {
    if (!options.includeSources || !message.links.length) return;
    lines.push('Sources:');
    for (const link of message.links) {
      lines.push(`- ${link.text || link.href}: ${link.href}`);
    }
    lines.push('');
  }

  async function copyConversation() {
    if (els.copyButton?.disabled) return;

    const result = await getCurrentExport();
    if (!result) return;

    try {
      await writeClipboard(result.content);
      setStatus(
        formatSuccessParts(`Copied ${result.format.title} export for`, result.data),
        result.data.mayBeIncomplete ? 'warn' : 'success',
      );
    } catch (_) {
      setStatus({ hint: '', main: 'Copy failed. Use Export to save a local file instead.' }, 'warn');
    }
  }

  async function exportConversation() {
    if (els.exportButton?.disabled) return;

    const result = await getCurrentExport();
    if (!result) return;

    downloadContent(result);
    setStatus(
      formatSuccessParts(`Exported ${result.format.title} for`, result.data),
      result.data.mayBeIncomplete ? 'warn' : 'success',
    );
  }

  function downloadContent(result) {
    const blob = new Blob([result.content], { type: result.format.mime });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = result.filename;
    anchor.style.display = 'none';
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }

  async function getCurrentExport() {
    setStatus({ hint: SCROLL_HINT, main: 'Preparing export…' }, 'info');
    updateActionStates(false);
    await prepareConversationDom();

    const result = createExport(state.format, {
      includeMetadata: state.includeMetadata,
      includeSources: state.includeSources,
    });

    const messageCount = result?.data?.messageCount || collectConversation().messageCount;
    updateActionStates(messageCount);

    if (!result) {
      setStatus({ hint: '', main: 'No conversation messages found to export.' }, 'warn');
    }

    return result;
  }

  function createExport(formatName, options) {
    const data = collectConversation();
    if (!data.messages.length) {
      return null;
    }

    const selectedFormat = FORMATS[formatName] ? formatName : DEFAULT_FORMAT;
    const format = FORMATS[selectedFormat];
    const content = formatExport(data, selectedFormat, options);
    const filename = getFileName(data.title, format.extension);
    return { content, data, filename, format };
  }

  function buildExportOptions(message) {
    return {
      includeMetadata: message.includeMetadata !== false,
      includeSources: message.includeSources !== false,
    };
  }

  function buildStatusResponse(data) {
    return {
      domTurnCount: data.domTurnCount,
      mayBeIncomplete: data.mayBeIncomplete,
      messageCount: data.messageCount,
      ok: true,
      scrollHint: SCROLL_HINT,
      title: data.title,
    };
  }

  function bindRuntimeMessages() {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    if (root.messageListener) {
      try {
        chrome.runtime.onMessage.removeListener(root.messageListener);
      } catch (_) {
        // ignore stale listener cleanup failures
      }
    }

    root.messageListener = (message, _sender, sendResponse) => {
      if (message?.source !== 'no-thanks-chatgpt-popup') return false;

      ensureUi();

      if (message.type === 'status') {
        prepareConversationDom()
          .then(() => {
            sendResponse(buildStatusResponse(collectConversation()));
          })
          .catch(() => {
            sendResponse({
              error: 'Could not load conversation messages on this page.',
              ok: false,
            });
          });
        return true;
      }

      if (message.type === 'export-download') {
        prepareConversationDom()
          .then(() => {
            const result = createExport(message.format, buildExportOptions(message));

            if (!result) {
              sendResponse({
                error: 'No conversation messages found on this page yet.',
                ok: false,
              });
              return;
            }

            downloadContent(result);
            sendResponse({
              domTurnCount: result.data.domTurnCount,
              filename: result.filename,
              mayBeIncomplete: result.data.mayBeIncomplete,
              messageCount: result.data.messageCount,
              ok: true,
              title: result.data.title,
            });
          })
          .catch(() => {
            sendResponse({
              error: 'Export failed. Reload the ChatGPT tab, then try again.',
              ok: false,
            });
          });
        return true;
      }

      if (message.type === 'export-copy') {
        prepareConversationDom()
          .then(async () => {
            const result = createExport(message.format, buildExportOptions(message));

            if (!result) {
              sendResponse({
                error: 'No conversation messages found on this page yet.',
                ok: false,
              });
              return;
            }

            await writeClipboard(result.content);
            sendResponse({
              domTurnCount: result.data.domTurnCount,
              mayBeIncomplete: result.data.mayBeIncomplete,
              messageCount: result.data.messageCount,
              ok: true,
              title: result.data.title,
            });
          })
          .catch(() => {
            sendResponse({
              error: 'Copy failed. Use the in-page Export button instead.',
              ok: false,
            });
          });
        return true;
      }

      return false;
    };

    chrome.runtime.onMessage.addListener(root.messageListener);
  }

  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.documentElement.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (!ok) throw new Error('Copy command failed');
  }

  function getConversationTitle() {
    const documentTitle = normalizePlainText(document.title || '').replace(/^ChatGPT\s*[-|:]\s*/i, '').replace(/\s*[-|:]\s*ChatGPT$/i, '');
    if (documentTitle && !/^ChatGPT$/i.test(documentTitle)) return documentTitle;

    const titleNode = document.querySelector('main h1, header h1, [data-testid*="conversation-title" i]');
    const title = normalizePlainText(titleNode?.textContent || '');
    return title || 'ChatGPT Conversation';
  }

  function getFileName(title, extension) {
    const slug = (title || 'chatgpt-conversation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'chatgpt-conversation';
    const date = new Date().toISOString().slice(0, 10);
    return `${slug}-${date}.${extension}`;
  }

  function sanitizeUrl(href) {
    try {
      const url = new URL(href, location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
        return url.href;
      }
    } catch (_) {
      // ignore invalid links
    }
    return '';
  }

  function normalizeInlineText(text) {
    return text.replace(/\s+/g, ' ');
  }

  function normalizePlainText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function normalizeReadableText(text) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeMarkdown(text) {
    return text
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '');
  }

  function escapeHtml(value) {
    return `${value}`.replace(/[&<>"']/g, (char) => {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '"') return '&quot;';
      return '&#39;';
    });
  }

  function createUi() {
    const style = document.createElement('style');
    style.textContent = `
        :host {
          color-scheme: light dark;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          pointer-events: none;
          position: fixed;
          right: 16px;
          top: max(72px, calc(env(safe-area-inset-top) + 72px));
          z-index: 2147483646;
        }

        * {
          box-sizing: border-box;
        }

        .ntcg-panel {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: calc(100dvh - 88px);
          pointer-events: auto;
        }

        .ntcg-panel.ntcg-flip {
          flex-direction: column-reverse;
        }

        .ntcg-trigger {
          align-items: center;
          background: color-mix(in srgb, Canvas 96%, transparent);
          border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
          border-radius: 10px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
          color: CanvasText;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          gap: 8px;
          height: 38px;
          justify-content: center;
          padding: 0 13px;
          transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
          width: auto;
        }

        .ntcg-trigger-label {
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
        }

        .ntcg-trigger:hover,
        .ntcg-trigger:focus-visible {
          background: color-mix(in srgb, Canvas 86%, #0b7a45 14%);
          border-color: #0b7a45;
          outline: none;
        }

        .ntcg-trigger:active {
          transform: translateY(1px);
        }

        .ntcg-menu {
          background: color-mix(in srgb, Canvas 98%, transparent);
          border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
          color: CanvasText;
          display: flex;
          flex: 0 1 auto;
          flex-direction: column;
          max-height: min(480px, calc(100dvh - 120px));
          min-height: 0;
          min-width: 300px;
          width: min(300px, calc(100vw - 32px));
        }

        .ntcg-menu[hidden] {
          display: none;
        }

        .ntcg-menu-header {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          gap: 10px;
          justify-content: space-between;
          padding: 14px 14px 10px;
        }

        .ntcg-title-wrap {
          min-width: 0;
        }

        .ntcg-title {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
          margin: 0;
        }

        .ntcg-subtitle {
          color: color-mix(in srgb, CanvasText 62%, transparent);
          font-size: 11.5px;
          line-height: 1.35;
          margin: 3px 0 0;
        }

        .ntcg-close {
          align-items: center;
          background: transparent;
          border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
          border-radius: 8px;
          color: CanvasText;
          cursor: pointer;
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 18px;
          height: 30px;
          justify-content: center;
          line-height: 1;
          padding: 0;
          width: 30px;
        }

        .ntcg-close:hover,
        .ntcg-close:focus-visible {
          background: color-mix(in srgb, CanvasText 8%, transparent);
          outline: none;
        }

        .ntcg-status-main {
          background: color-mix(in srgb, #0b7a45 8%, Canvas);
          border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
          border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
          flex: 0 0 auto;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.4;
          padding: 9px 14px;
          word-break: break-word;
        }

        .ntcg-menu-body {
          display: grid;
          flex: 1 1 auto;
          gap: 12px;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 12px 14px 14px;
        }

        .ntcg-format-grid {
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .ntcg-format {
          background: transparent;
          border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
          border-radius: 8px;
          color: CanvasText;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          min-height: 34px;
        }

        .ntcg-format:hover,
        .ntcg-format:focus-visible {
          border-color: #1267c4;
          outline: none;
        }

        .ntcg-format.is-selected {
          background: #1267c4;
          border-color: #1267c4;
          color: #fff;
        }

        .ntcg-options {
          display: grid;
          gap: 8px;
        }

        .ntcg-check {
          align-items: center;
          display: flex;
          gap: 9px;
          font-size: 13px;
          line-height: 1.2;
        }

        .ntcg-check input {
          accent-color: #0b7a45;
          height: 16px;
          margin: 0;
          width: 16px;
        }

        .ntcg-actions {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1.25fr;
        }

        .ntcg-action {
          align-items: center;
          border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          gap: 8px;
          justify-content: center;
          min-height: 38px;
          padding: 0 12px;
        }

        .ntcg-copy {
          background: transparent;
          color: CanvasText;
        }

        .ntcg-export {
          background: #0b7a45;
          border-color: #0b7a45;
          color: #fff;
        }

        .ntcg-action:hover,
        .ntcg-action:focus-visible {
          filter: brightness(1.04);
          outline: 2px solid color-mix(in srgb, #1267c4 44%, transparent);
          outline-offset: 2px;
        }

        .ntcg-action:disabled {
          cursor: not-allowed;
          filter: none;
          opacity: 0.45;
          pointer-events: none;
        }

        .ntcg-status-footer {
          border-top: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
          flex: 0 0 auto;
          padding: 10px 14px 12px;
        }

        .ntcg-status-footer[hidden] {
          display: none;
        }

        .ntcg-status-hint {
          color: color-mix(in srgb, CanvasText 68%, transparent);
          font-size: 11.5px;
          line-height: 1.45;
          margin: 0;
          word-break: break-word;
        }

        .ntcg-status-hint[hidden] {
          display: none;
        }

        .ntcg-status-main[data-tone="success"] {
          background: color-mix(in srgb, #0b7a45 12%, Canvas);
          color: #0b7a45;
        }

        .ntcg-status-main[data-tone="warn"] {
          background: color-mix(in srgb, #a05b00 10%, Canvas);
          color: #8a4d00;
        }

        .ntcg-status-footer[data-tone="success"] .ntcg-status-hint {
          color: #0b7a45;
        }

        .ntcg-status-footer[data-tone="warn"] .ntcg-status-hint {
          color: #a05b00;
        }

        svg {
          flex: 0 0 auto;
        }

        @media (max-width: 640px) {
          :host {
            right: 12px;
            top: max(64px, calc(env(safe-area-inset-top) + 64px));
          }

          .ntcg-menu {
            min-width: min(300px, calc(100vw - 24px));
            width: min(300px, calc(100vw - 24px));
          }

          .ntcg-trigger {
            height: 38px;
            padding: 0;
            width: 38px;
          }

          .ntcg-trigger-label {
            display: none;
          }
        }

        @media (prefers-color-scheme: dark) {
          .ntcg-trigger,
          .ntcg-menu {
            background: #1f2320;
            border-color: #4a524d;
            color: #f4f7f5;
          }

          .ntcg-trigger:hover,
          .ntcg-trigger:focus-visible {
            background: #183527;
          }

          .ntcg-status-main {
            background: #183527;
          }

          .ntcg-subtitle,
          .ntcg-status-hint {
            color: #bbc8c1;
          }

          .ntcg-format,
          .ntcg-action,
          .ntcg-close {
            border-color: #4a524d;
          }
        }
    `;

    const panel = createElement('div', { className: 'ntcg-panel' });
    const trigger = createElement('button', {
      attributes: {
        'aria-expanded': 'false',
        'aria-haspopup': 'dialog',
        'aria-label': 'Export conversation',
        title: 'Export conversation',
        type: 'button',
      },
      className: 'ntcg-trigger',
      children: [
        createIcon('download'),
        createElement('span', {
          className: 'ntcg-trigger-label',
          text: 'Export',
        }),
      ],
    });

    const menu = createElement('section', {
      attributes: {
        'aria-labelledby': 'ntcg-export-title',
        role: 'dialog',
      },
      className: 'ntcg-menu',
    });
    menu.hidden = true;

    const closeButton = createElement('button', {
      attributes: {
        'aria-label': 'Close export menu',
        type: 'button',
      },
      className: 'ntcg-close',
      text: '×',
    });

    const titleWrap = createElement('div', {
      className: 'ntcg-title-wrap',
      children: [
        createElement('h2', {
          attributes: { id: 'ntcg-export-title' },
          className: 'ntcg-title',
          text: 'Export conversation',
        }),
        createElement('p', {
          className: 'ntcg-subtitle',
          text: 'Loaded messages only',
        }),
      ],
    });

    const menuHeader = createElement('header', {
      className: 'ntcg-menu-header',
      children: [titleWrap, closeButton],
    });

    const statusMain = createElement('p', {
      attributes: {
        'aria-live': 'polite',
        role: 'status',
      },
      className: 'ntcg-status-main',
      text: 'Checking conversation…',
    });

    const menuBody = createElement('div', { className: 'ntcg-menu-body' });

    const formatGrid = createElement('div', {
      attributes: { 'aria-label': 'Export format' },
      className: 'ntcg-format-grid',
    });
    const formatButtons = Object.entries(FORMATS).map(([key, format]) => {
      const button = createElement('button', {
        attributes: {
          'aria-pressed': 'false',
          'data-format': key,
          title: format.title,
          type: 'button',
        },
        className: 'ntcg-format',
        text: format.label,
      });
      formatGrid.appendChild(button);
      return button;
    });

    const includeSources = createElement('input', {
      attributes: {
        'data-option': 'includeSources',
        type: 'checkbox',
      },
    });
    includeSources.checked = true;
    const includeMetadata = createElement('input', {
      attributes: {
        'data-option': 'includeMetadata',
        type: 'checkbox',
      },
    });
    includeMetadata.checked = true;

    const options = createElement('div', {
      className: 'ntcg-options',
      children: [
        createElement('label', {
          className: 'ntcg-check',
          children: [includeSources, document.createTextNode(' Include sources')],
        }),
        createElement('label', {
          className: 'ntcg-check',
          children: [includeMetadata, document.createTextNode(' Include metadata')],
        }),
      ],
    });

    const copyButton = createElement('button', {
      attributes: {
        'data-action': 'copy',
        type: 'button',
      },
      className: 'ntcg-action ntcg-copy',
      children: [createIcon('copy'), document.createTextNode(' Copy')],
    });
    const exportButton = createElement('button', {
      attributes: {
        'data-action': 'export',
        type: 'button',
      },
      className: 'ntcg-action ntcg-export',
      children: [createIcon('downloadSmall'), document.createTextNode(' Export')],
    });
    const actions = createElement('div', {
      className: 'ntcg-actions',
      children: [copyButton, exportButton],
    });

    const statusHint = createElement('p', {
      className: 'ntcg-status-hint',
      text: SCROLL_HINT,
    });
    const statusFooter = createElement('footer', {
      attributes: { role: 'status' },
      className: 'ntcg-status-footer',
      children: [statusHint],
    });

    menuBody.append(formatGrid, options, actions);
    menu.append(menuHeader, statusMain, menuBody, statusFooter);
    panel.append(trigger, menu);

    return {
      els: {
        closeButton,
        copyButton,
        exportButton,
        formatButtons,
        includeMetadata,
        includeSources,
        menu,
        statusFooter,
        statusHint,
        statusMain,
        trigger,
      },
      panel,
      style,
    };
  }

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    for (const [name, value] of Object.entries(options.attributes || {})) {
      element.setAttribute(name, value);
    }
    for (const child of options.children || []) {
      element.appendChild(child);
    }
    return element;
  }

  function createIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    const paths = [];
    if (name === 'copy') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '9');
      rect.setAttribute('y', '9');
      rect.setAttribute('width', '13');
      rect.setAttribute('height', '13');
      rect.setAttribute('rx', '2');
      svg.appendChild(rect);
      paths.push('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
    } else {
      paths.push('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
      paths.push('M7 10l5 5 5-5');
      paths.push('M12 15V3');
    }

    for (const pathData of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      svg.appendChild(path);
    }

    return svg;
  }

  bindRuntimeMessages();
  ready(() => {
    // Replace any prior host on reinject so shadow UI, styles, and handlers stay in sync.
    document.getElementById(HOST_ID)?.remove();
    init();
    startResilience();
  });
})();
