// ==UserScript==
// @name           OVB elearning – bdělost
// @namespace      https://github.com/Martin-CHT/OVB
// @version        2.1.0
// @description    Odstraní nepotřebné prvky, simuluje aktivitu a automaticky potvrzuje okna
// @author         Martin
// @copyright      2025-2026, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/OVB
// @source         https://github.com/Martin-CHT/OVB
// @website        https://iczv.vsfs.cz
// @supportURL     https://github.com/Martin-CHT/OVB/issues
// @icon           https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @icon64         https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning.user.js
// @match          https://iczv.vsfs.cz/auth/dipon/?a=elearning*
// @match          https://iczv.vsfs.cz/auth/dipon/?a=interaktivni
// @noframes
// @run-at         document-end
// @tag            OVB
// @tag            VSFS
// @tag            vzdelavani
// @grant          none
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = true;           // přepnout na true pro ladění
    const REFRESH_INTERVAL = 5;    // obnovit stránku každých N minut (0 = vypnuto)
    const log = (...args) => DEBUG && console.log('[OVB]', ...args);

    /* ===== Koordinace s Elearning-video.user.js ===== */
    // Sdílený objekt na window pro vzájemnou detekci skriptů.
    // Oba skripty mohou běžet nezávisle i společně bez kolizí.
    if (!window.__iczv) window.__iczv = {};
    window.__iczv.modalHandled = true; // signalizuje, že HTML modály jsou hlídány

    /* ===== 1. Odstranění nepotřebných prvků ===== */
    const REMOVE_SELECTOR = [
        'div.dropdown.position-absolute',
        'div.float-end',
        '.navbar',
        '.navbar-expand-lg',
        '.navbar-light',
        '.bg-vsfs',
        '.fixed-top',
        '.navigation'
    ].join(', ');

    const removeElements = () => {
        const elements = document.querySelectorAll(REMOVE_SELECTOR);
        if (elements.length === 0) return;
        log(`Odstraňuji ${elements.length} prvků`);
        elements.forEach(el => el.remove());
    };

    removeElements();

    const cleanupObserver = new MutationObserver(() => {
        cleanupObserver.disconnect();
        removeElements();
        cleanupObserver.observe(document.body, { childList: true, subtree: true });
    });
    cleanupObserver.observe(document.body, { childList: true, subtree: true });

    /* ===== 2. Spolehlivý timer (i na pozadí) ===== */
    // Prohlížeče silně throttlují setTimeout/setInterval na neaktivních
    // tabech (Chrome: min 1 s, Firefox: min 1 s, po 5 min: min 60 s).
    // Web Worker běží ve vlastním vlákně a NENÍ throttlován.
    const createWorkerTimer = (callback, intervalMs) => {
        const blob = new Blob([
            `let id; onmessage = e => { clearInterval(id); id = setInterval(() => postMessage('tick'), e.data); };`
        ], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = () => callback();
        worker.postMessage(intervalMs);
        return worker;
    };

    /* ===== 3. Simulace aktivity ===== */
    // Běží VŽDY – i na pozadí / minimalizovaném prohlížeči.
    const simulateActivity = () => {
        // Pohyb myši
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: Math.random() * window.innerWidth,
            clientY: Math.random() * window.innerHeight,
            bubbles: true
        }));

        // Kliknutí
        document.body.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window
        }));

        // Stisk klávesy (Shift – neviditelný, ale spouští listenery)
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Shift', code: 'ShiftLeft', bubbles: true
        }));

        log('Simulována aktivita');
    };

    // Interval 5 s – Worker zajistí přesné spouštění i na pozadí
    createWorkerTimer(simulateActivity, 5000);

    /* ===== Zabránění spánku obrazovky / OS ===== */
    // Sdílené přes window.__iczv.wakeLock – pokud už lock drží
    // Elearning-video.user.js, tento skript ho nezíská znovu.
    const initWakeLock = () => {
        if (window.__iczv.wakeLock) {
            log('Wake Lock již aktivní (z druhého skriptu)');
            return;
        }

        // Strategie 1: Screen Wake Lock API
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

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !window.__iczv.wakeLock) {
                    requestLock();
                }
            });
        } else {
            log('Wake Lock API nedostupné – fallback na video');
            createVideoFallback();
        }
    };

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

        video.src = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJC'
            + 'h4ECQoWBAhhTgGcBAAAAAAABFUmpZlVC53BBAEAAAAAAAAVRtU2mhBI2mhkG2Y5MH8gAAA'
            + 'AAAAKZBAAAAAAAAVaYAEAvABNDGsXbo0CcQAAAAAAABMUfGnAdSCAAAAAAAARmiIhAAIGNga'
            + 'MggEBa8IBIOBAAAAAAABR';

        document.body.appendChild(video);
        video.play().catch(() => {});
        window.__iczv.wakeLock = 'video-fallback';
        log('Video fallback pro wake lock aktivován');
    };

    initWakeLock();

    /* ===== Selektory pro popup detekci ===== */
    const CONFIRM_SELECTORS = [
        'button.btn-primary',
        'button.confirm',
        'button.ok',
        '.swal2-confirm'
    ].join(', ');

    const POPUP_SELECTOR = '.modal.show, .swal2-popup';
    // ↑ Odstraněn příliš obecný '.popup' – přidat zpět,
    //   pokud popup skutečně tuto třídu používá.

    /* ===== 4. Periodické obnovení stránky ===== */
    // Časomíra na serveru se aktualizuje pouze při reloadu.
    if (REFRESH_INTERVAL > 0) {
        const refreshMs = REFRESH_INTERVAL * 60 * 1000;
        log(`Stránka se obnoví každých ${REFRESH_INTERVAL} min`);

        createWorkerTimer(() => {
            // Neobnovovat, pokud právě potvrzujeme popup
            const popup = document.querySelector(POPUP_SELECTOR);
            if (popup && popup.dataset.autoConfirmed) {
                log('Popup aktivní – odkládám refresh o 15 s');
                setTimeout(() => location.reload(), 15000);
                return;
            }
            log('Obnovuji stránku…');
            location.reload();
        }, refreshMs);
    }

    /* ===== 5. Automatické potvrzení popupu o nečinnosti ===== */

    const tryConfirmPopup = (popup) => {
        if (popup.dataset.autoConfirmed) return;
        popup.dataset.autoConfirmed = '1';

        log('Detekováno okno, potvrzuji za 2–4 s…');

        const delay = 2000 + Math.random() * 2000;
        setTimeout(() => {
            const btn = popup.querySelector(CONFIRM_SELECTORS);
            if (btn) {
                btn.click();
                log('Okno potvrzeno.');
            } else {
                log('Potvrzovací tlačítko nenalezeno.');
                popup.removeAttribute('data-auto-confirmed'); // umožnit opakovaný pokus
            }
        }, delay);
    };

    // MutationObserver pro detekci popupů (místo setInterval)
    const popupObserver = new MutationObserver(() => {
        const popup = document.querySelector(POPUP_SELECTOR);
        if (popup) tryConfirmPopup(popup);
    });
    popupObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

    // Záložní kontrola při startu
    const initialPopup = document.querySelector(POPUP_SELECTOR);
    if (initialPopup) tryConfirmPopup(initialPopup);

    /* ===== 6. Odpočet do cíle (3 hodiny) ===== */
    const TARGET_SECONDS = 3 * 60 * 60; // 3:00:00

    const parseTime = (str) => {
        const m = str.match(/(\d{2}):(\d{2}):(\d{2})/);
        if (!m) return null;
        return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
    };

    const formatTime = (totalSec) => {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const initCountdown = () => {
        // Najít element s „Započtený čas"
        const slideP = document.querySelector('div.slide > p');
        if (!slideP || !slideP.textContent.includes('Započtený čas')) {
            log('Časovač nenalezen – sekce 6 přeskočena');
            return;
        }

        const elapsedSpan = slideP.querySelector('span.fw-bold');
        if (!elapsedSpan) return;

        // Vytvořit element pro odpočet
        const countdownEl = document.createElement('span');
        countdownEl.className = 'fw-bold fs-5';
        countdownEl.style.marginLeft = '6px';

        const label = document.createTextNode(' | Zbývá:');
        slideP.appendChild(label);
        slideP.appendChild(countdownEl);

        const updateCountdown = () => {
            const elapsed = parseTime(elapsedSpan.textContent);
            if (elapsed === null) return;

            const remaining = Math.max(0, TARGET_SECONDS - elapsed);
            countdownEl.textContent = formatTime(remaining);

            // Barevné kódování
            if (remaining === 0) {
                countdownEl.style.color = '#22c55e';
                countdownEl.textContent = '✅ Splněno!';
            } else if (remaining <= 600) {
                countdownEl.style.color = '#6ee7b7'; // zelená – pod 10 min
            } else if (remaining <= 1800) {
                countdownEl.style.color = '#f59e0b'; // oranžová – pod 30 min
            } else {
                countdownEl.style.color = '#ef4444'; // červená
            }
        };

        // První aktualizace okamžitě
        updateCountdown();

        // Aktualizovat každou sekundu (Worker – spolehlivé i na pozadí)
        createWorkerTimer(updateCountdown, 1000);

        /* --- Předpokládaný čas splnění --- */
        const etaEl = document.createElement('span');
        etaEl.className = 'fw-bold fs-5';
        etaEl.style.marginLeft = '6px';

        const etaLabel = document.createTextNode(' | Hotovo přibližně v:');
        slideP.appendChild(etaLabel);
        slideP.appendChild(etaEl);

        // Offset mezi serverovým (Praha) a lokálním časem
        let pragueOffsetMs = 0;
        let lastApiSync = 0;

        const syncPragueTime = async () => {
            try {
                const res = await fetch(
                    'https://timeapi.io/api/time/current/zone?timeZone=Europe/Prague'
                );
                if (!res.ok) throw new Error(res.status);
                const data = await res.json();
                // API vrací { hour, minute, seconds, ... }
                const pragueNow = new Date();
                pragueNow.setHours(data.hour, data.minute, data.seconds, 0);
                pragueOffsetMs = pragueNow.getTime() - Date.now();
                lastApiSync = Date.now();
                log('Praha sync OK, offset:', pragueOffsetMs, 'ms');
            } catch (e) {
                log('Praha API nedostupné, fallback na lokální čas:', e.message);
                pragueOffsetMs = 0; // fallback – použije systémový čas
            }
        };

        const updateETA = () => {
            const elapsed = parseTime(elapsedSpan.textContent);
            if (elapsed === null) return;

            const remainingSec = Math.max(0, TARGET_SECONDS - elapsed);
            if (remainingSec === 0) {
                etaEl.textContent = '✅';
                etaEl.style.color = '#22c55e';
                return;
            }

            // Aktuální pražský čas + zbývající sekundy
            const pragueNowMs = Date.now() + pragueOffsetMs;
            const etaDate = new Date(pragueNowMs + remainingSec * 1000);
            const hh = String(etaDate.getHours()).padStart(2, '0');
            const mm = String(etaDate.getMinutes()).padStart(2, '0');
            etaEl.textContent = `${hh}:${mm}`;
            etaEl.style.color = '#4ca0ffff'; // světle modrá
        };

        // Jednorázový výpočet při načtení (fixní do dalšího refreshe)
        syncPragueTime().then(updateETA);

        log('Odpočet do 3 h + ETA inicializován');
    };

    initCountdown();

})();