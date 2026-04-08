// ==UserScript==
// @name           OVB elearning – auto potvrzení videa
// @namespace      https://github.com/Martin-CHT/OVB
// @version        3.1.0
// @description    Automaticky potvrzuje výzvy k bdělosti a postupně přepíná mezi segmenty videa.
// @author         Martin
// @copyright      2025-2026, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/OVB
// @source         https://github.com/Martin-CHT/OVB
// @supportURL     https://github.com/Martin-CHT/OVB/issues
// @icon           https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @icon64         https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning-video.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning-video.user.js
// @match          https://iczv.vsfs.cz/auth/dipon/*
// @noframes
// @run-at         document-start
// @tag            OVB
// @tag            VSFS
// @tag            vzdelavani
// @grant          none
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_ID = 'iczv-video';
  const DEBUG = true;
  const NEXT_SEGMENT_DELAY = 5; // sekundy čekání před přepnutím
  const log = (...args) => DEBUG && console.log(`[${SCRIPT_ID}]`, ...args);

  /* ===== Utility: čekání na DOM ===== */
  const whenReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  /* ===== Koordinace s Elearning.user.js ===== */
  if (!window.__iczv) window.__iczv = {};
  window.__iczv.confirmHandled = true;

  /* ===== Toast notifikace ===== */
  let toastContainer = null;

  const getToastContainer = () => {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.createElement('div');
    Object.assign(toastContainer.style, {
      position: 'fixed', bottom: '16px', right: '16px', zIndex: '999999',
      display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none'
    });
    document.body.appendChild(toastContainer);
    return toastContainer;
  };

  const createToastEl = (titleText, titleColor, bodyText) => {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      background: 'rgba(30, 30, 30, 0.92)', color: '#fff',
      padding: '12px 20px', borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px', lineHeight: '1.4', maxWidth: '360px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      opacity: '0', transform: 'translateY(12px)', pointerEvents: 'auto'
    });
    const title = document.createElement('div');
    title.textContent = titleText;
    Object.assign(title.style, { fontWeight: '600', marginBottom: '4px', fontSize: '13px', color: titleColor });
    const body = document.createElement('div');
    body.textContent = bodyText;
    Object.assign(body.style, { opacity: '0.8', fontSize: '13px' });
    toast.appendChild(title);
    toast.appendChild(body);
    return { toast, title, body };
  };

  const showToast = (msg, duration = 4000) => {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => showToast(msg, duration), { once: true });
      return;
    }
    const { toast } = createToastEl('✔ Automaticky potvrzeno', '#6eff8e', msg || '(confirm)');
    const container = getToastContainer();
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(12px)';
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) { container.remove(); toastContainer = null; }
      }, 300);
    }, duration);
  };

  /* ===== Přepsání window.confirm() ===== */
  const origConfirm = window.confirm.bind(window);
  window.confirm = function (msg) {
    log('Zachycen confirm():', msg);
    showToast(msg);
    return true;
  };

  /* ===== Zabránění spánku obrazovky / OS ===== */
  // Sdílené přes window.__iczv.wakeLock – pokud už lock drží
  // Elearning.user.js, tento skript ho nezíská znovu.
  const initWakeLock = () => {
    if (window.__iczv.wakeLock) {
      log('Wake Lock již aktivní (z druhého skriptu)');
      return;
    }

    // Strategie 1: Screen Wake Lock API (Chrome 84+, Edge 84+, FF 126+)
    if ('wakeLock' in navigator) {
      const requestLock = async () => {
        try {
          const lock = await navigator.wakeLock.request('screen');
          window.__iczv.wakeLock = lock;
          log('Screen Wake Lock aktivován');
          lock.addEventListener('release', () => {
            log('Wake Lock uvolněn');
            window.__iczv.wakeLock = null;
          });
        } catch (e) {
          log('Wake Lock selhal:', e.message, '– fallback na video');
          createVideoFallback();
        }
      };

      requestLock();

      // Re-acquire po návratu na tab (prohlížeč uvolňuje lock při odchodu)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !window.__iczv.wakeLock) {
          requestLock();
        }
      });
    } else {
      // Strategie 2: Fallback – neviditelné smyčkované video
      log('Wake Lock API nedostupné – fallback na video');
      createVideoFallback();
    }
  };

  // Fallback: přehrávání neviditelného mikrovidea brání spánku
  const createVideoFallback = () => {
    if (window.__iczv.wakeLock) return;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.loop = true;
    Object.assign(video.style, {
      position: 'fixed', top: '-1px', left: '-1px',
      width: '1px', height: '1px', opacity: '0.01',
      pointerEvents: 'none', zIndex: '-1'
    });

    // Minimální base64 WEBM (1×1 černý pixel, ~200B)
    // Prohlížeč považuje přehrávání videa za aktivní použití → neuspí
    video.src = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJC'
      + 'h4ECQoWBAhhTgGcBAAAAAAABFUmpZlVC53BBAEAAAAAAAAVRtU2mhBI2mhkG2Y5MH8gAAA'
      + 'AAAAKZBAAAAAAAAVaYAEAvABNDGsXbo0CcQAAAAAAABMUfGnAdSCAAAAAAAARmiIhAAIGNga'
      + 'MggEBa8IBIOBAAAAAAABR';

    document.body.appendChild(video);
    video.play().catch(() => { });
    window.__iczv.wakeLock = 'video-fallback';
    log('Video fallback pro wake lock aktivován');
  };

  whenReady(initWakeLock);

  /* ===== Automatická navigace mezi segmenty videa ===== */

  const parseHHMMSS = (str) => {
    const m = str.match(/(\d{2}):(\d{2}):(\d{2})/);
    return m ? parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) : null;
  };

  const parseMMSS = (str) => {
    const m = str.match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
  };

  /* --- Najít další segment k přehrání --- */
  // Platforma používá Bootstrap třídy:
  //   btn-warning = právě přehrávané (žlutá)
  //   btn-info    = další k přehrání (cyan #0DCAF0)
  //   btn-light + opacity:.5 = zamčené (šedá)
  //   btn-* bez zvýraznění = dokončené
  const findNextSegment = (segments) => {
    // 1) Segment s btn-info (cyan) = server říká "přehraj toto"
    let target = document.querySelector('a.videocasti.btn-info');
    if (target) { log('Nalezen segment s btn-info'); return target; }

    // 2) Hledat podle background-color #0DCAF0 = rgb(13, 202, 240)
    for (const seg of segments) {
      if (seg.tagName !== 'A') continue;
      const bg = getComputedStyle(seg).backgroundColor;
      if (bg.includes('13, 202, 240')) {
        log('Nalezen segment podle barvy #0DCAF0');
        return seg;
      }
    }

    // 3) Poslední <a>.videocasti (nejnověji odemčený), ale ne btn-warning
    const links = Array.from(segments).filter(
      el => el.tagName === 'A' && !el.classList.contains('btn-warning')
    );
    if (links.length > 0 && links.length < segments.length) {
      log('Fallback: poslední odemčený <a> segment');
      return links[links.length - 1];
    }

    return null; // vše hotovo nebo nic nenalezeno
  };

  /* --- Spustit odpočet a kliknout --- */
  const clickWithCountdown = (target) => {
    const name = target.querySelector('span')?.textContent || '?';
    const href = target.getAttribute('href');
    log(`Další segment: ${name} (${href}), přepnu za ${NEXT_SEGMENT_DELAY}s`);

    if (!document.body) return;
    const { toast, body: toastBody } = createToastEl(
      `⏭ Další: ${name}`, '#4ca0ff', `Přepínám za ${NEXT_SEGMENT_DELAY}s…`
    );
    const container = getToastContainer();
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });

    let remaining = NEXT_SEGMENT_DELAY;
    const timer = setInterval(() => {
      remaining--;
      toastBody.textContent = `Přepínám za ${remaining}s…`;
      if (remaining <= 0) {
        clearInterval(timer);
        log(`Navigace na ${name}`);
        target.click();
      }
    }, 1000);
  };

  /* --- Hlavní inicializace --- */
  const initVideoNavigation = () => {
    const segments = document.querySelectorAll('.videocasti');
    if (segments.length === 0) return;

    log(`Nalezeno ${segments.length} segmentů videa na stránce`);
    log('URL:', window.location.href);

    // Logovat stav všech segmentů
    segments.forEach((seg, i) => {
      const tag = seg.tagName;
      const classes = seg.className;
      const text = seg.textContent.trim().replace(/\n/g, ' ');
      log(`  Segment ${i + 1}: <${tag}> class="${classes}" → "${text}"`);
    });

    const timeEl = document.getElementById('time');
    const iframe = document.getElementById('youtube-video');
    const isPlaying = !!(iframe && timeEl);

    if (isPlaying) {
      // === SEGMENT PAGE: video hraje ===
      const active = document.querySelector('a.videocasti.btn-warning')
        || document.querySelector('a.videocasti.btn-info');
      const segName = active?.querySelector('span')?.textContent || '?';
      log(`Segment page – přehrávám: ${segName}`);
      showToast(`🎬 Přehrávám: ${segName}`, 5000);

      // Zjistit celkový čas z textu "05:32/17:21" → 17:21
      if (active) {
        const totalMatch = active.textContent.match(/\/(\d{1,2}:\d{2})/);
        const totalTimeSec = totalMatch ? parseMMSS(totalMatch[1]) : null;

        if (totalTimeSec) {
          log(`Celkový čas segmentu: ${totalMatch[1]} (${totalTimeSec}s)`);

          // Sledovat timer – po dosažení celkového času
          // nativní skript provede redirect na overview.
          // Safety net: pokud redirect nenastane do 5 s, najdeme další sami.
          const observer = new MutationObserver(() => {
            const current = parseHHMMSS(timeEl.textContent);
            if (current !== null && current >= totalTimeSec) {
              observer.disconnect();
              log(`Čas dosažen! Čekám na nativní redirect…`);
              setTimeout(() => {
                log('Redirect nenastal, hledám další segment');
                const next = findNextSegment(segments);
                if (next) clickWithCountdown(next);
              }, 5000);
            }
          });
          observer.observe(timeEl, { childList: true, characterData: true, subtree: true });
        }
      }
    } else {
      // === OVERVIEW PAGE: najít a kliknout na další segment ===
      log('Overview page – hledám další segment');
      const next = findNextSegment(segments);
      if (next) {
        clickWithCountdown(next);
      } else {
        log('Všechny segmenty dokončeny ✅');
        showToast('🎉 Všechny části videa dokončeny!', 8000);
      }
    }
  };

  /* ===== Start ===== */
  whenReady(initVideoNavigation);

  log('ICZV video helper v3.1 inicializován');
})();