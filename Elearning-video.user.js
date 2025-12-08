// ==UserScript==
// @name           ICZV helper – auto potvrzení s viditelným oknem
// @namespace      https://github.com/Martin-CHT/OVB
// @version        1.2.5
// @description    Zobrazí potvrzovací okno a automaticky jej potvrdí po chvíli.
// @author         Martin
// @copyright      2025, Martin
// @license        Proprietary - internal use only
// @homepageURL    https://github.com/Martin-CHT/OVB
// @website        https://iczv.vsfs.cz
// @source         https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning-video.user.js
// @supportURL     https://github.com/Martin-CHT/OVB/issues
// @icon           https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @icon64         https://www.vaskonzultant.cz/dataWeb/img/logos/certificate--vsfs.png
// @updateURL      https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning-video.user.js
// @downloadURL    https://raw.githubusercontent.com/Martin-CHT/OVB/master/Elearning-video.user.js
// @match          https://iczv.vsfs.cz/auth/dipon/*
// @noframes
// @run-at         document-end
// @tag            OVB
// @tag            VSFS
// @tag            vzdelavani
// @grant          none
// ==/UserScript==



(function () {
  'use strict';

  function customConfirm(msg) {
    return new Promise((resolve) => {
      // vytvoří overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.4);
        z-index: 999999; display: flex; align-items: center; justify-content: center;
      `;
      const box = document.createElement('div');
      box.style.cssText = `
        background: white; padding: 20px 30px; border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,.3); font-family: system-ui; text-align: center;
        max-width: 400px;
      `;
      box.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: 600;">Potvrzení</div>
        <div style="margin-bottom: 20px;">${msg || ''}</div>
        <button id="okBtn">OK (auto za 2 s)</button>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const okBtn = box.querySelector('#okBtn');
      let timer = setTimeout(() => {
        okBtn.click();
      }, 2000);

      okBtn.addEventListener('click', () => {
        clearTimeout(timer);
        overlay.remove();
        resolve(true);
      });
    });
  }

  // Přepíše pouze confirm (alert může zůstat jako banner)
  window.confirm = function (msg) {
    console.log('Automaticky potvrzuji:', msg);
    return true; // staré skripty očekávají synchronní návrat, ale UI zobrazíme async
  };

  // Ale přidáme skutečné zobrazení async okna
  document.addEventListener('DOMContentLoaded', () => {
    // Hook na případné výskyty confirm
    const origConfirm = window.confirm;
    window.confirm = function (msg) {
      customConfirm(msg); // zobrazí vizuální box
      return true;        // okamžitě potvrzeno
    };
  });

})();
