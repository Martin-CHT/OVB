// ==UserScript==
// @name           OVB elearning – videa
// @namespace      https://github.com/Kamdar-Wolf/Skripty
// @version        1.2.4
// @description    Odstraní nepotřebné prvky, simuluje aktivitu a automaticky potvrzuje okna
// @author         Martin
// @copyright      2025, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/OVB/tree/main/OVB
// @website        https://iczv.vsfs.cz
// @source         https://raw.githubusercontent.com/Martin-CHT/OVB/master/OVB/Elearning.user.js
// @supportURL     https://github.com/Kamdar-Wolf/Skripty/issues
// @icon           https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @icon64         https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/OVB/master/OVB/Elearning.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/OVB/master/OVB/Elearning.user.js
// @match          https://iczv.vsfs.cz/auth/dipon/*
// @noframes
// @run-at         document-end
// @tag            OVB
// @tag            VSFS
// @tag            vzdelavani
// @grant          none
// ==/UserScript==

(function() {
    'use strict';

    /* ===== 1. Odstranění prvků ===== */
    const remove = () => {
        document.querySelectorAll('div.dropdown.position-absolute, div.float-end, .navbar, .navbar-expand-lg, .navbar-light, .bg-vsfs, .fixed-top, .navigation')
            .forEach(el => el.remove());
    };
    remove();

    const obs = new MutationObserver(remove);
    obs.observe(document.body, { childList: true, subtree: true });

    /* ===== 2. Simulace aktivity (kliknutí) ===== */
    const simulateActivity = () => {
        const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        document.body.dispatchEvent(evt);
        console.log('[OVB skript] Simulován klik');
    };
    setInterval(simulateActivity, 1500 + Math.random() * 500); // 1,5–2 s

    /* ===== 3. Automatické potvrzení vyskakovacího okna ===== */
    const checkPopup = () => {
        // zde uprav selector podle skutečného HTML popupu
        const popup = document.querySelector('.modal.show, .popup, .swal2-popup');
        if (popup && !popup.dataset.autoConfirmStarted) {
            popup.dataset.autoConfirmStarted = '1';
            console.log('[OVB skript] Detekováno okno, čekám 10s...');
            setTimeout(() => {
                const confirmBtn = popup.querySelector('button.btn-primary, button.confirm, button.ok, .swal2-confirm');
                if (confirmBtn) {
                    confirmBtn.click();
                    console.log('[OVB skript] Okno potvrzeno.');
                } else {
                    console.log('[OVB skript] Potvrzovací tlačítko nenalezeno.');
                }
            }, 10000); // 10 sekund
        }
    };
    setInterval(checkPopup, 1000);

})();
