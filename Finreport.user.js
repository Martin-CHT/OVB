// ==UserScript==
// @name         Finreport
// @namespace    https://github.com/Martin-CHT/OVB
// @version      1.1.0
// @description  Auto-sbalování + Formuláře + Datum + Přesměrování (Clean verze)
// @author       Martin
// @copyright    2026, Martin
// @license      Proprietary - internal use only
// @homepageURL  https://github.com/Martin-CHT/OVB
// @website      https://www.finreport.cz
// @source       https://raw.githubusercontent.com/Martin-CHT/OVB/master/Finreport.user.js
// @supportURL   https://github.com/Martin-CHT/OVB/issues
// @icon         https://upload.wikimedia.org/wikipedia/commons/5/50/Logo_OVB_Holding_AG.svg
// @icon64       https://upload.wikimedia.org/wikipedia/commons/5/50/Logo_OVB_Holding_AG.svg
// @updateURL    https://raw.githubusercontent.com/Martin-CHT/OVB/master/Finreport.user.js
// @downloadURL  https://raw.githubusercontent.com/Martin-CHT/OVB/master/Finreport.user.js
// @match        https://www.finreport.cz/*
// @run-at       document-end
// @tag          Práce
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    // === 0. PŘESMĚROVÁNÍ (NOVÉ) ===
    // Pokud je uživatel na "čistém" dashboardu (finreport/), přesměruj na OVB.
    if (window.location.pathname === '/finreport/' && window.location.search === '') {
        window.location.replace('https://www.finreport.cz/finreport/index.php?app=ovb');
        return; // Ukončíme skript, stránka se reloadne
    }

    // === KONFIGURACE ===
    const HEARTBEAT_RATE = 1000; // Interval kontroly (ms)
    const FOLD_DELAY = 15000;     // Čas do sbalení (ms)
    const MISTO_TEXT = "v Litoměřicích";

    // === POMOCNÉ FUNKCE PRO FORMULÁŘE ===

    // Funkce pro zaškrtnutí Radio/Checkboxu
    function forceCheck(selector) {
        var $el = $(selector);
        if ($el.length > 0 && !$el.is(':checked')) {
            $el.prop('checked', true);
            $el.trigger('change');
            // console.log(`Finreport: Zaškrtnuto -> ${selector}`);
        }
    }

    // Funkce pro vyplnění textového pole
    function forceValue(selector, value) {
        var $el = $(selector);
        // Vyplníme pouze pokud je pole prázdné nebo má jinou hodnotu
        if ($el.length > 0 && $el.val() !== value) {
            $el.val(value);
            $el.trigger('change');
            $el.trigger('input'); // Pro jistotu triggerujeme input event
            // console.log(`Finreport: Vyplněno -> ${value}`);
        }
    }

    // === MODUL 1: AUTO-FOLDER (Sbalování boxů) ===
    function maintainSideboxes() {
        $('.sidebox-box-home').each(function() {
            var $wrapper = $(this);
            var $header = $wrapper.find('.sidebox-color');
            var $content = $wrapper.children('div[id^="output-home-"]');

            if ($content.length === 0 || $header.length === 0) return;

            var fullId = $content.attr('id');
            var shortName = fullId.replace('output-home-', '');
            var $btn = $header.find('.home-show');

            if ($btn.length === 0) {
                var btnHtml = `<a href="#" class="home-show imagebutton bi bi-fold-white" style="float: right; margin: -4px" data-show-name="${shortName}" data-show="1"></a>`;
                $header.append(btnHtml);
                $btn = $header.find('.home-show');
            }

            var isOpen = $btn.hasClass('bi-fold-white');
            if (isOpen) {
                var timerRunning = $btn.data('auto-fold-timer-running');
                if (!timerRunning) {
                    var isInitialized = $btn.data('script-init-done');
                    if (!isInitialized) {
                        $btn.trigger('click');
                        $btn.data('script-init-done', true);
                    } else {
                        $btn.data('auto-fold-timer-running', true);
                        setTimeout(function() {
                            var $currentBtn = $header.find('.home-show');
                            if ($currentBtn.hasClass('bi-fold-white')) {
                                $currentBtn.trigger('click');
                            }
                            $currentBtn.data('auto-fold-timer-running', false);
                        }, FOLD_DELAY);
                    }
                }
            } else {
                if (!$btn.data('script-init-done')) {
                    $btn.data('script-init-done', true);
                }
                $btn.data('auto-fold-timer-running', false);
            }
        });
    }

    // === MODUL 2: FORM FILLER (Vyplňování formulářů) ===
    function autoFillForms() {
        // 1. AML B1 - Vlastní účet (Ano)
        forceCheck('input[name="b1_potvrzeni2"][value="1"]');

        // 2. AML B2 - Vlastní účet (Ano)
        forceCheck('input[name="b2_potvrzeni2"][value="1"]');

        // 3. Výhled finanční situace - Pozitivní (value="1"]');
        forceCheck('input[name="b8_financni_situace"][value="1"]');

        // 4. Hlavní živitel
        // Klient (B1) -> Ano (value="1")
        forceCheck('input[name="b8_b1_zivitel"][value="1"]');
        // Další osoba (B2) -> Ne (value="0")
        forceCheck('input[name="b8_b2_zivitel"][value="0"]');

        // 5. Původ prostředků - Ze závislé činnosti (checkbox)
        forceCheck('input[name="b8_puvod1"]');

        // 6. Místo podpisu
        forceValue('input[name="misto"]', MISTO_TEXT);
    }

    // === MODUL 3: DATE CALCULATOR (Výpočet data) ===
    function calculateAndFillDate() {
        // Kontrola, zda pole pro datum na stránce existují
        var $den = $('input[name="datum_before_den"]');
        var $mesic = $('input[name="datum_before_mesic"]');
        var $rok = $('input[name="datum_before_rok"]');

        if ($den.length === 0 || $mesic.length === 0 || $rok.length === 0) return;

        // Abychom nepřepisovali datum pořád dokola (pokud si ho uživatel změní),
        // zkontrolujeme, zda už jsme ho vyplnili, nebo zda je prázdné/defaultní.
        // Pro jednoduchost a robustnost: Pokud se datum v polích neshoduje s naším vypočítaným, opravíme ho.

        // 1. Výpočet data
        // Dnešní datum
        var date = new Date();
        // Odečteme 21 dní
        date.setDate(date.getDate() - 21);

        // Hledáme nejbližší starší úterý (hledáme dozadu)
        // 0 = Ne, 1 = Po, 2 = Út ...
        while (date.getDay() !== 2) {
            date.setDate(date.getDate() - 1);
        }

        var targetDay = date.getDate();
        var targetMonth = date.getMonth() + 1; // JS měsíce jsou 0-11
        var targetYear = date.getFullYear();

        // 2. Aplikace do polí
        // Používáme == místo === kvůli konverzi string/number
        if ($den.val() != targetDay) {
            $den.val(targetDay).trigger('change');
        }
        if ($mesic.val() != targetMonth) {
            $mesic.val(targetMonth).trigger('change');
        }
        if ($rok.val() != targetYear) {
            $rok.val(targetYear).trigger('change');
        }
    }

    // === HLAVNÍ SMYČKA (HEARTBEAT) ===
    function heartbeat() {
        maintainSideboxes();    // Sbalování boxů
        autoFillForms();        // Vyplňování checkboxů a textů
        calculateAndFillDate(); // Vyplňování data
    }

    // === START SKRIPTU ===
    var waitJq = setInterval(function() {
        if (window.jQuery) {
            clearInterval(waitJq);
            console.log('Finreport Script v1.6.0: Startuji Heartbeat...');
            // Spouštíme smyčku
            setInterval(heartbeat, HEARTBEAT_RATE);
            heartbeat(); // První spuštění ihned
        }
    }, 100);

})();
