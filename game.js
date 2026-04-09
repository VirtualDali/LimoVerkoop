// ===== AFAS KC — Limonade Verkoopspel =====

(function () {
    'use strict';

    const CONFIG = {
        startGeld: 10,
        totaleDagen: 14,
        kostenPerGlas: 0.50,
        maxGlazen: 100,
        minPrijs: 0.10,
        maxPrijs: 5.00,
    };

    const WEER = [
        { type:'zonnig',      icon:'☀️',  desc:'Zonnig',       factor:1.3,  advice:'Ideaal weer voor limonade!' },
        { type:'halfbewolkt', icon:'⛅',   desc:'Half bewolkt', factor:1.0,  advice:'Redelijk weer, gemiddelde verkoop verwacht.' },
        { type:'bewolkt',     icon:'☁️',  desc:'Bewolkt',      factor:0.7,  advice:'Minder vraag verwacht door bewolking.' },
        { type:'regenachtig', icon:'🌧️', desc:'Regenachtig',  factor:0.4,  advice:'Weinig klanten verwacht door regen.' },
        { type:'onweer',      icon:'⛈️',  desc:'Onweer',       factor:0.2,  advice:'Bijna niemand zal limonade kopen.' },
        { type:'heet',        icon:'🔥',   desc:'Heet',         factor:1.6,  advice:'Extreem warm! Enorme vraag verwacht!' },
    ];

    // ---- State ----
    let S = resetState();

    function resetState() {
        return {
            dag: 1,
            saldo: CONFIG.startGeld,
            resultaten: [],
            weerMorgen: null,
            totVerkocht: 0,
            totVerspild: 0,
            totOmzet: 0,
            totKosten: 0,
            gameOver: false,
        };
    }

    // ---- Helpers ----
    const $ = id => document.getElementById(id);
    const euro = n => '€ ' + n.toFixed(2).replace('.', ',');
    const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const randF = (a, b) => Math.random() * (b - a) + a;

    // ---- Weer ----
    function genWeer() {
        const kans = [0.25, 0.25, 0.20, 0.15, 0.05, 0.10];
        let r = Math.random(), c = 0, idx = 0;
        for (let i = 0; i < kans.length; i++) { c += kans[i]; if (r <= c) { idx = i; break; } }
        const w = WEER[idx];
        const temps = { heet:[30,38], zonnig:[22,32], halfbewolkt:[18,26], bewolkt:[14,22], regenachtig:[10,20], onweer:[12,22] };
        const [lo, hi] = temps[w.type] || [15, 25];
        return { ...w, temp: randInt(lo, hi) };
    }

    function werkelijkWeer(voorspelling) {
        const t = voorspelling.temp + randInt(-2, 2);
        if (Math.random() < 0.15) { const nw = genWeer(); return { ...nw, temp: t }; }
        return { ...voorspelling, temp: t };
    }

    // ---- Vraag ----
    function berekenVraag(weer, prijs) {
        const basis = randF(20, 40);
        const wF = weer.factor;
        const tF = Math.max(0.3, (weer.temp - 10) / 20);
        const pF = Math.max(0.1, 1.5 - prijs * 0.5);
        const ruis = randF(0.8, 1.2);
        return Math.max(0, Math.round(basis * wF * tF * pF * ruis));
    }

    // ---- View switching ----
    function showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        const view = $('view' + name.charAt(0).toUpperCase() + name.slice(1));
        if (view) view.classList.add('active');
        const tab = document.querySelector(`.tab[data-view="${name}"]`);
        if (tab) tab.classList.add('active');
    }

    // ---- UI Update ----
    function updateAll() {
        const winst = S.saldo - CONFIG.startGeld;
        const pct = ((S.dag - 1) / CONFIG.totaleDagen * 100);

        // Topbar
        $('topbarPeriod').innerHTML = `Dag <strong>${S.dag}</strong> van <strong>${CONFIG.totaleDagen}</strong>`;

        // Sidebar
        $('sbDag').textContent = S.dag;
        $('sbVerkocht').textContent = S.totVerkocht;
        $('sbVerspild').textContent = S.totVerspild;

        if (S.weerMorgen) {
            $('sbWeerIcon').textContent = S.weerMorgen.icon;
            $('sbWeerTemp').textContent = S.weerMorgen.temp + '°C';
            $('sbWeerDesc').textContent = S.weerMorgen.desc;
            $('sbWeerAdvice').textContent = S.weerMorgen.advice;
        }

        // Dashboard
        $('dStartKapitaal').textContent = euro(CONFIG.startGeld);
        $('dWinstBedrag').textContent = euro(Math.abs(winst));
        $('dOp').textContent = winst >= 0 ? '+' : '−';
        $('dSaldo').textContent = euro(S.saldo);
        $('dSaldo').className = 'fv fv-big' + (winst < 0 ? ' negative' : '');

        $('dOmzet').textContent = euro(S.totOmzet);
        $('dKosten').textContent = euro(S.totKosten);
        $('dNetto').textContent = euro(Math.abs(winst));
        $('dNetto').className = 'fv fv-big' + (winst < 0 ? ' negative' : '');

        if (S.weerMorgen) {
            $('dWeerEmoji').textContent = S.weerMorgen.icon;
            $('dWeerTemp').textContent = S.weerMorgen.temp + '°C';
            $('dWeerDesc').textContent = S.weerMorgen.desc;
        }

        $('dDag').textContent = 'Dag ' + S.dag;
        $('dProgress').style.width = pct + '%';

        // Verkoop
        if (S.weerMorgen) {
            $('vWeerIcon').textContent = S.weerMorgen.icon;
            $('vWeerTemp').textContent = S.weerMorgen.temp + '°C';
            $('vWeerDesc').textContent = S.weerMorgen.desc;
            $('vWeerAdvice').textContent = S.weerMorgen.advice;
        }
        $('vDag').textContent = S.dag;

        updateKosten();
        updateResultaten();
        updateCharts();
    }

    function updateKosten() {
        const glazen = parseInt($('inputGlazen').value) || 0;
        const prijs = parseFloat($('inputPrijs').value) || 0;
        const kosten = glazen * CONFIG.kostenPerGlas;
        const rest = S.saldo - kosten;

        $('pvKosten').textContent = euro(kosten);
        $('pvSaldo').textContent = euro(S.saldo);
        $('pvRest').textContent = euro(rest);
        $('pvRest').className = 'fv fv-big' + (rest < 0 ? ' negative' : '');
        $('pvMaxOmzet').textContent = euro(glazen * prijs);
    }

    function updateResultaten() {
        const tbody = $('resultsBody');
        const tfoot = $('resultsFoot');

        if (S.resultaten.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="11">Nog geen resultaten. Begin met verkopen!</td></tr>';
            tfoot.style.display = 'none';
            return;
        }

        tbody.innerHTML = S.resultaten.map(r => {
            const cls = r.winst >= 0 ? 'pos-val' : 'neg-val';
            return `<tr>
                <td>${r.dag}</td><td>${r.wIcon} ${r.wDesc}</td><td>${r.temp}°C</td>
                <td>${r.gemaakt}</td><td>${r.verkocht}</td><td>${r.verspild}</td>
                <td>${euro(r.prijs)}</td><td>${euro(r.omzet)}</td><td>${euro(r.kosten)}</td>
                <td class="${cls}">${euro(r.winst)}</td><td>${euro(r.saldoNa)}</td>
            </tr>`;
        }).join('');

        const totW = S.totOmzet - S.totKosten;
        $('footOmzet').textContent = euro(S.totOmzet);
        $('footKosten').textContent = euro(S.totKosten);
        $('footWinst').textContent = euro(totW);
        $('footWinst').className = totW >= 0 ? 'pos-val' : 'neg-val';
        $('footSaldo').textContent = euro(S.saldo);
        tfoot.style.display = '';
    }

    function updateCharts() {
        // Winst chart
        const cW = $('chartWinst');
        const cS = $('chartSaldo');

        if (S.resultaten.length === 0) {
            cW.innerHTML = '<div class="chart-empty">Start het spel om de grafiek te zien</div>';
            cS.innerHTML = '<div class="chart-empty">Start het spel om de grafiek te zien</div>';
            $('chartLegend').style.display = 'none';
            $('chartSaldoLegend').style.display = 'none';
            return;
        }

        $('chartLegend').style.display = 'flex';
        $('chartSaldoLegend').style.display = 'flex';

        // --- Winst bar chart (negatief = naar beneden) ---
        const winsten = S.resultaten.map(r => r.winst);
        const maxAbs = Math.max(...winsten.map(Math.abs), 1);
        const hasNeg = winsten.some(w => w < 0);
        const halfH = 65; // half of chart height

        if (hasNeg) {
            // Split layout: top half for positive, bottom half for negative
            cW.innerHTML = '<div class="chart-split">' + S.resultaten.map(r => {
                const h = Math.max((Math.abs(r.winst) / maxAbs) * halfH, 2);
                if (r.winst >= 0) {
                    return `<div class="chart-col"><span class="chart-bar-val">${euro(r.winst)}</span><div class="chart-half-top"><div class="chart-bar pos" style="height:${h}px"></div></div><div class="chart-half-bot"></div><span class="chart-bar-lbl">D${r.dag}</span></div>`;
                } else {
                    return `<div class="chart-col"><div class="chart-half-top"></div><div class="chart-half-bot"><div class="chart-bar neg bar-down" style="height:${h}px"></div></div><span class="chart-bar-val neg-val">${euro(r.winst)}</span><span class="chart-bar-lbl">D${r.dag}</span></div>`;
                }
            }).join('') + '</div>';
        } else {
            cW.innerHTML = S.resultaten.map(r => {
                const h = Math.max((r.winst / maxAbs) * 130, 3);
                return `<div class="chart-bar-wrap"><span class="chart-bar-val">${euro(r.winst)}</span><div class="chart-bar pos" style="height:${h}px"></div><span class="chart-bar-lbl">D${r.dag}</span></div>`;
            }).join('');
        }

        // --- Saldo line chart (SVG) ---
        const saldi = [CONFIG.startGeld, ...S.resultaten.map(r => r.saldoNa)];
        const minS = Math.min(...saldi) * 0.9;
        const maxS = Math.max(...saldi) * 1.1 || 1;
        const svgW = cS.clientWidth - 40 || 400;
        const svgH = 140;
        const padL = 0, padR = 0, padT = 20, padB = 20;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const points = saldi.map((s, i) => {
            const x = padL + (i / (saldi.length - 1 || 1)) * plotW;
            const y = padT + plotH - ((s - minS) / (maxS - minS || 1)) * plotH;
            return { x, y, val: s, label: i === 0 ? 'Start' : 'D' + i };
        });

        const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
        const startLine = `M${padL},${padT + plotH - ((CONFIG.startGeld - minS) / (maxS - minS || 1)) * plotH} L${padL + plotW},${padT + plotH - ((CONFIG.startGeld - minS) / (maxS - minS || 1)) * plotH}`;

        let svg = `<svg width="100%" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" class="saldo-svg">`;
        svg += `<line x1="${padL}" y1="${padT + plotH - ((CONFIG.startGeld - minS) / (maxS - minS || 1)) * plotH}" x2="${padL + plotW}" y2="${padT + plotH - ((CONFIG.startGeld - minS) / (maxS - minS || 1)) * plotH}" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,3"/>`;
        svg += `<polyline points="${points.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" fill="none" stroke="#5bb5a2" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
        points.forEach(p => {
            svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#5bb5a2" stroke="#fff" stroke-width="2"/>`;
            svg += `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1) - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#374151">${euro(p.val)}</text>`;
            svg += `<text x="${p.x.toFixed(1)}" y="${svgH - 2}" text-anchor="middle" font-size="10" fill="#9ca3af">${p.label}</text>`;
        });
        svg += '</svg>';
        cS.innerHTML = svg;
    }

    // ---- Acties ----
    let dagBezig = false;

    function startDag() {
        if (dagBezig) return;
        dagBezig = true;

        const glazen = parseInt($('inputGlazen').value) || 0;
        const prijs = parseFloat($('inputPrijs').value) || 0;
        const kosten = glazen * CONFIG.kostenPerGlas;
        const err = $('formError');

        if (glazen < 0 || glazen > CONFIG.maxGlazen) {
            err.textContent = `Aantal moet tussen 0 en ${CONFIG.maxGlazen} liggen.`;
            err.style.display = 'block'; dagBezig = false; return;
        }
        if (prijs < CONFIG.minPrijs || prijs > CONFIG.maxPrijs) {
            err.textContent = `Prijs moet tussen ${euro(CONFIG.minPrijs)} en ${euro(CONFIG.maxPrijs)} liggen.`;
            err.style.display = 'block'; dagBezig = false; return;
        }
        if (kosten > S.saldo) {
            err.textContent = `Onvoldoende saldo! Beschikbaar: ${euro(S.saldo)}, kosten: ${euro(kosten)}.`;
            err.style.display = 'block'; dagBezig = false; return;
        }
        err.style.display = 'none';

        const wWeer = werkelijkWeer(S.weerMorgen);
        const vraag = berekenVraag(wWeer, prijs);
        const verkocht = Math.min(glazen, vraag);
        const verspild = glazen - verkocht;
        const omzet = verkocht * prijs;
        const dagWinst = omzet - kosten;

        S.saldo = S.saldo - kosten + omzet;
        S.totVerkocht += verkocht;
        S.totVerspild += verspild;
        S.totOmzet += omzet;
        S.totKosten += kosten;

        const res = {
            dag: S.dag, wIcon: wWeer.icon, wDesc: wWeer.desc, temp: wWeer.temp,
            gemaakt: glazen, verkocht, verspild, prijs, omzet, kosten, winst: dagWinst,
            saldoNa: S.saldo,
        };
        S.resultaten.push(res);

        toonResultaat(res, wWeer);
    }

    function toonResultaat(r, weer) {
        $('modalTitle').textContent = 'Resultaat Dag ' + r.dag;
        $('resWeerIcon').textContent = weer.icon;
        $('resWeerText').textContent = `Het was ${weer.desc.toLowerCase()} en ${weer.temp}°C`;
        $('resGemaakt').textContent = r.gemaakt;
        $('resVerkocht').textContent = r.verkocht;
        $('resVerspild').textContent = r.verspild;
        $('resOmzet').textContent = euro(r.omzet);
        $('resKosten').textContent = euro(r.kosten);
        $('resWinst').textContent = euro(r.winst);
        $('resNieuwSaldo').textContent = euro(S.saldo);

        const hl = document.querySelector('.res-hl');
        hl.classList.toggle('loss', r.winst < 0);

        $('dagResultaat').style.display = 'flex';
        $('btnVolgendeDag').textContent = S.dag >= CONFIG.totaleDagen ? '🏆 Bekijk Eindresultaat' : 'Volgende Dag →';
    }

    function volgendeDag() {
        dagBezig = false;
        $('dagResultaat').style.display = 'none';

        if (S.dag >= CONFIG.totaleDagen || S.saldo < CONFIG.kostenPerGlas) {
            eindeSpel(); return;
        }

        S.dag++;
        S.weerMorgen = genWeer();
        updateAll();
        showView('dashboard');
    }

    function eindeSpel() {
        S.gameOver = true;
        const winst = S.saldo - CONFIG.startGeld;

        $('eindSaldo').textContent = euro(S.saldo);
        $('eindSaldo').className = 'fv fv-big' + (winst < 0 ? ' negative' : '');
        $('eindWinstF').textContent = euro(Math.abs(winst));
        $('eindOp').textContent = winst >= 0 ? '+' : '−';
        $('eindWinst').textContent = euro(winst);
        $('eindVerkocht').textContent = S.totVerkocht + ' glazen';
        $('eindVerspild').textContent = S.totVerspild + ' glazen';

        // Beoordeling
        let b;
        if (winst >= 50) b = '🌟 Fantastisch! Je bent een ware limonade-magnaat!';
        else if (winst >= 30) b = '🎉 Uitstekend! Geweldige winst behaald!';
        else if (winst >= 15) b = '👍 Goed gedaan! Een mooie winst.';
        else if (winst >= 5)  b = '😊 Niet slecht! Er is nog ruimte voor verbetering.';
        else if (winst >= 0)  b = '😐 Quitte gespeeld. Speel beter in op het weer!';
        else if (winst >= -5) b = '😟 Klein verlies. Let beter op je kosten!';
        else b = '😞 Dat ging niet goed... Tip: pas productie aan op het weer!';
        $('eindBeoordeling').textContent = b;

        updateResultaten();
        updateCharts();
        showView('einde');
    }

    function nieuwSpel() {
        S = resetState();
        S.weerMorgen = genWeer();
        $('inputGlazen').value = 10;
        $('inputPrijs').value = '1.00';
        $('formError').style.display = 'none';
        $('dagResultaat').style.display = 'none';
        updateAll();
        showView('dashboard');
    }

    // ---- Events ----
    function bindEvents() {
        document.querySelectorAll('.tab').forEach(t => {
            t.addEventListener('click', () => { if (!S.gameOver) showView(t.dataset.view); });
        });

        $('btnGaNaarVerkoop').addEventListener('click', () => showView('verkoop'));
        $('inputGlazen').addEventListener('input', updateKosten);
        $('inputPrijs').addEventListener('input', updateKosten);
        $('btnStartDag').addEventListener('click', startDag);
        $('btnVolgendeDag').addEventListener('click', volgendeDag);

        $('btnNieuwSpel').addEventListener('click', () => {
            if (confirm('Weet je zeker dat je een nieuw spel wilt starten?')) nieuwSpel();
        });
        $('btnOpnieuw').addEventListener('click', nieuwSpel);
        $('btnBekijkResultaten').addEventListener('click', () => {
            S.gameOver = false; showView('resultaten'); S.gameOver = true;
        });

        [$('inputGlazen'), $('inputPrijs')].forEach(el => {
            el.addEventListener('keydown', e => { if (e.key === 'Enter') startDag(); });
        });
    }

    // ---- Init ----
    function init() {
        S.weerMorgen = genWeer();
        updateAll();
        bindEvents();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
