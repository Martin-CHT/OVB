// ==UserScript==
// @name         Finreport
// @namespace    https://github.com/Martin-CHT/OVB
// @version      1.2.0
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

    // Funkce pro zaškrtnutí Radio/Checkboxu s opravou přepisování
    function forceCheck(selector) {
        var $el = $(selector);
        if ($el.length > 0 && !$el.is(':checked')) {
            // Pokud jde o radio button, musíme manuálně odškrtnout ostatní se stejným jménem
            if ($el.attr('type') === 'radio' && $el.attr('name')) {
                $('input[name="' + $el.attr('name') + '"]').prop('checked', false).trigger('change');
            }
            // Zaškrtneme požadovaný element
            $el.prop('checked', true).trigger('change');
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
            
            // Původní tlačítko schováme, aby auto-sbalování neukládalo stav na server
            var $nativeBtn = $header.find('.home-show');
            if ($nativeBtn.length > 0) {
                $nativeBtn.hide();
            }

            var $btn = $header.find('.finreport-fold-btn');

            if ($btn.length === 0) {
                var isHidden = $content.is(':hidden');
                var iconClass = isHidden ? 'bi-unfold-white' : 'bi-fold-white';
                var btnHtml = `<a href="#" class="finreport-fold-btn imagebutton bi ${iconClass}" style="float: right; margin: -4px" data-show-name="${shortName}"></a>`;
                $header.append(btnHtml);
                $btn = $header.find('.finreport-fold-btn');

                $btn.on('click', function(e) {
                    e.preventDefault();
                    if ($btn.hasClass('bi-fold-white')) {
                        $btn.removeClass('bi-fold-white').addClass('bi-unfold-white');
                        $content.slideUp(200);
                    } else {
                        $btn.removeClass('bi-unfold-white').addClass('bi-fold-white');
                        $content.slideDown(200);
                    }
                });
            }

            var isOpen = $btn.hasClass('bi-fold-white');
            if (isOpen) {
                var timerRunning = $btn.data('auto-fold-timer-running');
                if (!timerRunning) {
                    var isInitialized = $btn.data('script-init-done');
                    if (!isInitialized) {
                        $btn.data('script-init-done', true);
                    } else {
                        $btn.data('auto-fold-timer-running', true);
                        setTimeout(function() {
                            var $currentBtn = $header.find('.finreport-fold-btn');
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

    // === MODUL 4: ESD INVESTICE (Tlačítka) ===
    function addInvestmentButtons() {
        // Tlačítka chceme zobrazit pouze, pokud jsme skutečně na esd
        if (window.location.href.includes('app=esd')) {
            var $header = $('#sidebox-header.sidebox-header');
            if ($header.length > 0 && $header.find('.finreport-esd-btns').length === 0) {
                var btnHtml = `
                    <div class="finreport-esd-btns" style="float: right; margin-top: -2px; margin-right: 10px;">
                        <button type="button" class="btn-esd-zakladni" style="margin-right: 5px; background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Základní</button>
                        <button type="button" class="btn-esd-informovany" style="margin-right: 5px; background: #ffc107; color: black; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Informovaný</button>
                        <button type="button" class="btn-esd-pokrocily" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Pokročilý</button>
                    </div>
                `;
                $header.append(btnHtml);

                $header.find('.btn-esd-zakladni').on('click', function(e) {
                    e.preventDefault();
                    fillESD('zakladni');
                });
                $header.find('.btn-esd-informovany').on('click', function(e) {
                    e.preventDefault();
                    fillESD('informovany');
                });
                $header.find('.btn-esd-pokrocily').on('click', function(e) {
                    e.preventDefault();
                    fillESD('pokrocily');
                });
            }
        }
    }

    function fillESD(type) {
        // Znalosti a zkušenosti (1-5)
        forceCheck('input[name="id_1"][value="2"]'); // Vyšší výnos = vyšší riziko
        forceCheck('input[name="id_2"][value="1"]'); // Diverzifikace...
        forceCheck('input[name="id_3"][value="3"]'); // Akcie = podíl na zisku
        forceCheck('input[name="id_4"][value="2"]'); // České státní dluhopisy
        forceCheck('input[name="id_5"][value="4"]'); // U fondů není garantována výplata

        // Vzdělání a profese (6-7)
        forceCheck('input[name="id_6"][value="1"]'); // Ne
        forceCheck('input[name="id_7"][value="1"]'); // Ne

        // Inteligentní předpoklad finanční situace (část 8 - Rozpočet)
        if (type === 'zakladni') {
            forceValue('input[name="b8_prijmy_mesicne"]', '30000');
            forceValue('input[name="b8_vydaje_mesicne"]', '20000');
            forceValue('input[name="b8_rezerva"]', '50000');
            forceValue('input[name="b8_pravidelne_investice"]', '1000');
        } else if (type === 'informovany') {
            forceValue('input[name="b8_prijmy_mesicne"]', '50000');
            forceValue('input[name="b8_vydaje_mesicne"]', '30000');
            forceValue('input[name="b8_rezerva"]', '150000');
            forceValue('input[name="b8_pravidelne_investice"]', '3000');
        } else if (type === 'pokrocily') {
            forceValue('input[name="b8_prijmy_mesicne"]', '80000');
            forceValue('input[name="b8_vydaje_mesicne"]', '40000');
            forceValue('input[name="b8_rezerva"]', '300000');
            forceValue('input[name="b8_pravidelne_investice"]', '10000');
        }

        // Část 8 (Zkušenosti) - odškrtnutí všech doplňujících otázek
        $('input[name^="id_8_"][type="checkbox"]').prop('checked', false).trigger('change');

        if (type === 'zakladni') {
            forceCheck('input[name="id_8_a_1"][value="1"]'); // Peněžní/dluhopisové: nikdy
            forceCheck('input[name="id_8_b_1"][value="1"]'); // Smíšené/akciové: nikdy
            forceCheck('input[name="id_8_c_1"][value="1"]'); // Akcie/certifikáty: nikdy
            forceCheck('input[name="id_8_d_1"][value="1"]'); // Pákové: nikdy
        } else if (type === 'informovany') {
            forceCheck('input[name="id_8_a_1"][value="2"]'); // Peněžní: ano
            forceCheck('input[name="id_8_a_2"]');            // Pravidelně peněžní
            forceCheck('input[name="id_8_b_1"][value="2"]'); // Smíšené: ano
            forceCheck('input[name="id_8_b_2"]');            // Pravidelně smíšené
            forceCheck('input[name="id_8_c_1"][value="1"]'); // Akcie: nikdy
            forceCheck('input[name="id_8_d_1"][value="1"]'); // Pákové: nikdy
        } else if (type === 'pokrocily') {
            forceCheck('input[name="id_8_a_1"][value="2"]'); // Peněžní: ano
            forceCheck('input[name="id_8_a_2"]');            // Pravidelně
            forceCheck('input[name="id_8_a_3"]');            // Objem nad 100k
            forceCheck('input[name="id_8_b_1"][value="2"]'); // Smíšené: ano
            forceCheck('input[name="id_8_b_2"]');            // Pravidelně
            forceCheck('input[name="id_8_b_3"]');            // Objem nad 100k
            forceCheck('input[name="id_8_c_1"][value="1"]'); // Akcie: nikdy (dle předlohy Pokročilý)
            forceCheck('input[name="id_8_d_1"][value="1"]'); // Pákové: nikdy
        }

        // Část 9 (ESG)
        // Striktní nastavení podle předlohy: Pokročilý má Ano, ostatní mají Ne.
        var wantsESG = (type === 'pokrocily');

        if (wantsESG) {
            // Uživatel chce zohlednit ESG (Pokročilý profil)
            forceCheck('input[name="id_9"][value="1"]');   // Ano
            forceCheck('input[name="id_10"][value="-2"]'); // Ano, není podstatné do jaké míry
            forceCheck('input[name="id_11"][value="-2"]'); // Ano, není podstatné do jaké míry
            forceCheck('input[name="id_12"][value="1"]');  // Ano
        } else {
            // Výchozí stav - bez ESG (Základní, Informovaný)
            forceCheck('input[name="id_9"][value="2"]'); // Ne
            forceCheck('input[name="id_10"][value="-1"]'); // Ne
            forceCheck('input[name="id_11"][value="-1"]'); // Ne
            forceCheck('input[name="id_12"][value="2"]'); // Ne
        }
    }

    // === HLAVNÍ SMYČKA (HEARTBEAT) ===
    function heartbeat() {
        maintainSideboxes();    // Sbalování boxů
        autoFillForms();        // Vyplňování checkboxů a textů
        calculateAndFillDate(); // Vyplňování data
        addInvestmentButtons(); // Přidání tlačítek do ESD
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
