/**
 * keyboard-input.js
 * -----------------
 * Frosted-glass poem input bar + QR-code panel for Entropy Babel.
 *
 * Exported API
 * ------------
 *   initKeyboardInput(options)
 *     options.apiBase   – e.g. '  // ─────────────────────────────────────────────────────────────────
  // Simple language hint (drives `language` field in submission)
  // ─────────────────────────────────────────────────────────────────'
 *     options.onSubmit  – optional callback(lines[]) after successful send
 *     options.qrDataUrl – optional pre-generated QR PNG data-URL
 */

export function initKeyboardInput({ apiBase = '', onSubmit } = {}) {
  const FONT = '"Sitka", serif';
  const Z = 10001;

  let active = false;

  // ─────────────────────────────────────────────────────────────────
  // Root wrapper (fixed, bottom of screen, full width)
  // ─────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    zIndex: Z,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',       // children opt-in
    fontFamily: FONT,
  });
  document.body.appendChild(root);

  // ─────────────────────────────────────────────────────────────────
  // Input bar
  // ─────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: '760px',
    margin: '0 auto 28px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    padding: '0 24px',
    boxSizing: 'border-box',
  });
  root.appendChild(bar);

  // ── Textarea wrapper (frosted glass shell) ──
  const shell = document.createElement('div');
  Object.assign(shell.style, {
    flex: '1',
    position: 'relative',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.35)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(0,0,0,0.12)',
    boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
    transition: 'background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
    overflow: 'hidden',
    cursor: 'text',
  });
  bar.appendChild(shell);

  // Placeholder text (sits behind textarea, disappears on focus)
  const placeholder = document.createElement('div');
  Object.assign(placeholder.style, {
    position: 'absolute',
    top: '14px',
    left: '16px',
    right: '16px',
    fontFamily: FONT,
    fontSize: '14px',
    color: 'rgba(0,0,0,0.30)',
    pointerEvents: 'none',
    lineHeight: '1.6',
    transition: 'opacity 0.2s',
    userSelect: 'none',
  });
  placeholder.textContent = 'Write a verse… click to begin';
  shell.appendChild(placeholder);

  // Actual textarea (transparent, sits on top of placeholder)
  const ta = document.createElement('textarea');
  Object.assign(ta.style, {
    display: 'block',
    width: '100%',
    minHeight: '52px',
    maxHeight: '180px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    padding: '14px 16px',
    boxSizing: 'border-box',
    fontFamily: FONT,
    fontSize: '14px',
    color: '#111',
    lineHeight: '1.6',
    overflowY: 'auto',
    caretColor: '#333',
  });
  ta.setAttribute('autocomplete', 'off');
  ta.setAttribute('spellcheck', 'false');
  ta.setAttribute('rows', '1');
  shell.appendChild(ta);

  // Auto-grow
  function autoGrow() {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }
  ta.addEventListener('input', () => {
    autoGrow();
    placeholder.style.opacity = ta.value.length ? '0' : '1';
  });

  // ── Hint line (Shift+Enter = new line), shown inside shell when active ──
  const hint = document.createElement('div');
  Object.assign(hint.style, {
    position: 'absolute',
    bottom: '6px',
    right: '12px',
    fontFamily: FONT,
    fontSize: '10px',
    color: 'rgba(0,0,0,0.25)',
    pointerEvents: 'none',
    userSelect: 'none',
    transition: 'opacity 0.25s',
    opacity: '0',
  });
  hint.textContent = 'Shift + Enter  ↵  new line';
  shell.appendChild(hint);

  // Activate / deactivate
  function setActive(val) {
    active = val;
    hint.style.opacity = val ? '1' : '0';
    if (val) {
      shell.style.background = 'rgba(255,255,255,0.90)';
      shell.style.backdropFilter = 'blur(2px)';
      shell.style.WebkitBackdropFilter = 'blur(2px)';
      shell.style.boxShadow = '0 4px 32px rgba(0,0,0,0.13)';
      shell.style.borderColor = 'rgba(0,0,0,0.22)';
      placeholder.style.opacity = ta.value.length ? '0' : '1';
    } else {
      shell.style.background = 'rgba(255,255,255,0.35)';
      shell.style.backdropFilter = 'blur(18px)';
      shell.style.WebkitBackdropFilter = 'blur(18px)';
      shell.style.boxShadow = '0 2px 24px rgba(0,0,0,0.07)';
      shell.style.borderColor = 'rgba(0,0,0,0.12)';
    }
  }

  shell.addEventListener('click', () => {
    setActive(true);
    ta.focus();
  });
  ta.addEventListener('focus', () => setActive(true));
  ta.addEventListener('blur', () => {
    if (!ta.value.trim()) setActive(false);
  });

  // Prevent Enter from submitting (use Shift+Enter for newlines, bare Enter to send)
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ── Send button ──
  const sendBtn = document.createElement('button');
  Object.assign(sendBtn.style, {
    flexShrink: '0',
    height: '44px',
    padding: '0 20px',
    background: 'rgba(0,0,0,0.82)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontFamily: FONT,
    fontSize: '13px',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'background 0.2s ease, opacity 0.2s',
    marginBottom: '4px',
    userSelect: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  });
  sendBtn.textContent = 'Send';
  sendBtn.addEventListener('mouseenter', () => { sendBtn.style.background = 'rgba(0,0,0,1)'; });
  sendBtn.addEventListener('mouseleave', () => { sendBtn.style.background = 'rgba(0,0,0,0.82)'; });
  sendBtn.addEventListener('click', handleSend);
  bar.appendChild(sendBtn);

  // ─────────────────────────────────────────────────────────────────
  // Status toast
  // ─────────────────────────────────────────────────────────────────
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '108px',
    left: '50%',
    transform: 'translateX(-50%) translateY(8px)',
    background: 'rgba(0,0,0,0.78)',
    color: '#fff',
    fontFamily: FONT,
    fontSize: '13px',
    padding: '8px 20px',
    borderRadius: '20px',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    zIndex: Z + 1,
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(toast);

  let toastTimer = null;
  function showToast(msg, durationMs = 2800) {
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(8px)';
    }, durationMs);
  }

  // ─────────────────────────────────────────────────────────────────
  // QR toggle
  // ─────────────────────────────────────────────────────────────────
  function toggleQR() {
    qrVisible = !qrVisible;
    if (qrVisible) {
      qrPanel.style.display = 'flex';
      requestAnimationFrame(() => { qrPanel.style.opacity = '1'; });
      qrIcon.style.color = '#333';
    } else {
      qrPanel.style.opacity = '0';
      setTimeout(() => { qrPanel.style.display = 'none'; }, 300);
      qrIcon.style.color = '#999';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Send logic
  // ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    const raw = ta.value.trim();
    if (!raw) {
      showToast('Please write something first ✦');
      return;
    }

    // Split on newlines; filter blanks
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    // Optimistic UI
    ta.value = '';
    ta.style.height = 'auto';
    placeholder.style.opacity = '1';
    setActive(false);
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    showToast('Sending…');

    const endpoint = apiBase
      ? `${apiBase.replace(/\/$/, '')}/submit-poem`
      : '/.netlify/functions/submit-poem';

    try {
      const payload = {
        author: 'Anonymous',
        lines,
        source: 'keyboard',
        language: detectLang(raw),
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => res.status);
        throw new Error(String(msg));
      }

      showToast('Verse received — thank you ✦', 3200);
      if (typeof onSubmit === 'function') onSubmit(lines);

    } catch (err) {
      console.error('[keyboard-input] submit error:', err);
      // Restore text so user doesn't lose their poem
      ta.value = raw;
      autoGrow();
      placeholder.style.opacity = '0';
      setActive(true);
      ta.focus();
      showToast('Could not send — please try again', 3200);
    } finally {
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Simple language hint (drives `language` field in submission)
  // ─────────────────────────────────────────────────────────────────
  function detectLang(text) {
    const cjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
    const arabic = /[\u0600-\u06ff]/;
    if (cjk.test(text)) return 'zh';
    if (arabic.test(text)) return 'ar';
    return 'en';
  }

  // ─────────────────────────────────────────────────────────────────
  // Dismiss when clicking outside (only when active)
  // ─────────────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!active) return;
    if (!root.contains(e.target)) {
      if (!ta.value.trim()) setActive(false);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // Escape key dismisses
  // ─────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) {
      ta.blur();
      if (!ta.value.trim()) setActive(false);
    }
  });

  return { root, bar, ta };
}
