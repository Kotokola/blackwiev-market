(() => {
    'use strict';

    /* ===== Utilities ===== */
    const $ = id => document.getElementById(id);
    const $$ = sel => Array.from(document.querySelectorAll(sel));
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (v, c) => (Number(v) || 0).toFixed(2) + ' ' + (c || '');
    const FEE = 0.05;
    const MONEY_MINS = { USDT: 0.01, STARS: 50, TON: 0.5 };

    const tgApp = () => { try { return window.Telegram?.WebApp || null } catch { return null } };
    const tgSend = data => { const a = tgApp(); if (!a) return; try { a.sendData(typeof data === 'string' ? data : JSON.stringify(data)) } catch { } };

    /* ===== State ===== */
    let sellNft = null, sellCurrency = null;
    let idVisible = true;
    let marketItems = [];
    const balances = { usdt: 0, stars: 0, ton: 0 };

    /* ===== Helpers ===== */
    const show = id => {
        $$('.screen').forEach(s => s.classList.remove('active'));
        const el = $(id); if (el) el.classList.add('active');
        window.scrollTo(0, 0);
    };

    const toast = (text, type = 'info') => {
        if (!text) return;
        const container = $('#toastContainer');
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = text;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 350); }, 2600);
    };

    const msg = (id, text, type) => {
        const el = $(id); if (!el) return;
        el.textContent = text || '';
        el.className = 'msg ' + (type || '');
        el.hidden = !text;
    };

    const fillProfile = (name, username, id, photoUrl) => {
        $('#profName').textContent = name || 'Неизвестно';
        $('#profUser').textContent = username ? '@' + username : '—';
        $('#profId').textContent = String(id ?? '—');
        const avatar = $('#avatar');
        avatar.innerHTML = '';
        if (photoUrl) {
            const img = document.createElement('img');
            img.src = photoUrl;
            avatar.appendChild(img);
        } else {
            avatar.textContent = (name || '?')[0].toUpperCase();
        }
    };

    const initNav = () => {
        $$('[data-go]').forEach(b => {
            b.onclick = () => {
                const g = b.dataset.go;
                show('scr' + g[0].toUpperCase() + g.slice(1));
                if (g === 'sell') { resetSell(); loadMyNfts(); }
                if (g === 'buy') loadMarket();
                if (g === 'profile') { loadProfile(); tgSend({ action: 'get_balance' }); loadMyNfts(); }
            };
        });
        $$('[data-back]').forEach(b => {
            b.onclick = () => show('scr' + b.dataset.back[0].toUpperCase() + b.dataset.back.slice(1));
        });
    };

    const initTabs = () => {
        $$('.tab').forEach(t => {
            t.onclick = () => {
                $$('.tab').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
                $$('.tab-panel').forEach(x => x.classList.add('hidden'));
                t.classList.add('active');
                t.setAttribute('aria-selected', 'true');
                const panel = $('.tab-panel[data-tab="' + t.dataset.tab + '"]');
                if (panel) panel.classList.remove('hidden');
                if (t.dataset.tab === 'inv') loadMyNfts();
                if (t.dataset.tab === 'tx') tgSend({ action: 'get_transactions' });
                if (t.dataset.tab === 'wd') tgSend({ action: 'get_balance' });
            };
        });
    };

    /* ===== Rules ===== */
    const initRules = () => {
        const cb = $('#cbRules'), btn = $('#btnEnter');
        if (!cb || !btn) return;
        btn.disabled = !cb.checked;
        cb.onchange = () => { btn.disabled = !cb.checked; };
        btn.onclick = () => {
            try { localStorage.setItem('bb_rules', '1'); } catch { }
            show('scrMenu');
            tgSend({ action: 'accept_rules' });
        };
        try { if (localStorage.getItem('bb_rules') === '1') show('scrMenu'); } catch { }
    };

    /* ===== Data loading ===== */
    const fetchJSON = async (url) => {
        const r = await fetch(url + (url.includes('?') ? '&' : '?') + Date.now());
        if (!r.ok) throw new Error('no data');
        return r.json();
    };

    const currentUid = () => {
        const a = tgApp();
        const u = a?.initDataUnsafe?.user || new URLSearchParams(location.search).get('uid');
        return Number(u) || 0;
    };

    /* ---------- Inventory ---------- */
    const renderInventory = items => {
        const el = $('#invGrid'), empty = $('#invEmpty'), count = $('#invCount');
        el.innerHTML = '';
        empty.hidden = items.length > 0;
        count.textContent = items.length;
        items.forEach(n => {
            const attrs = n.attributes || {};
            const card = document.createElement('div');
            card.className = 'nft-item' + (n.is_listed ? ' selected' : '');
            card.setAttribute('role', 'listitem');
            card.innerHTML = `
                <img class="nft-img" src="${esc(n.image_url || '')}" alt="" onerror="this.style.display='none'">
                <div class="nft-meta">
                    <span class="nft-name">${esc(n.name || 'NFT')}${attrs.number ? ' #' + esc(attrs.number) : ''}</span>
                    <span class="nft-status ${n.is_listed ? 'listed' : ''}">${n.is_listed ? '• На продаже' : '• В инвентаре'}</span>
                </div>`;
            el.appendChild(card);
        });
    };

    const loadMyNfts = async () => {
        try {
            const sp = new URLSearchParams(location.search);
            const param = sp.get('nfts');
            if (param) {
                try { const items = JSON.parse(param); if (Array.isArray(items) && items.length) return renderInventory(items); } catch { }
            }
            const data = await fetchJSON('./api.json');
            renderInventory(data[String(currentUid())] || []);
        } catch {
            try { tgSend({ action: 'get_my_nfts' }); } catch { }
        }
    };

    /* ---------- Market ---------- */
    const loadMarket = async () => {
        try {
            const sp = new URLSearchParams(location.search);
            const param = sp.get('market');
            if (param) {
                try { const items = JSON.parse(param); if (Array.isArray(items)) marketItems = items; } catch { }
            } else {
                const data = await fetchJSON('./api.json');
                marketItems = Object.values(data).flat().filter(x => x.is_listed);
            }
            marketItems.forEach(it => { if (!it.seller_name) it.seller_name = 'ID: ' + (it.owner_id || ''); });
            renderMarket(sortMarket(marketItems, $('#sortSelect')?.value || 'new'));
            updateMarketControls();
        } catch {
            try { tgSend({ action: 'get_market' }); } catch { }
        }
    };

    const sortMarket = (items, mode) => {
        const sorted = [...items];
        if (mode === 'price-asc') sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        else if (mode === 'price-desc') sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        return sorted;
    };

    const updateMarketControls = () => {
        const sortSel = $('#sortSelect'), curSel = $('#curFilter');
        if (!sortSel || !curSel) return;
        sortSel.addEventListener('change', () => renderMarket(sortMarket(marketItems, sortSel.value)));
        curSel.addEventListener('change', () => {
            const filter = curSel.value;
            renderMarket(filter ? marketItems.filter(n => n.currency === filter) : marketItems);
        });
    };

    const renderMarket = items => {
        const el = $('#marketGrid'), empty = $('#marketEmpty');
        el.innerHTML = '';
        empty.hidden = items.length > 0;
        items.forEach(n => {
            const card = document.createElement('div');
            card.className = 'market-item';
            card.setAttribute('role', 'listitem');
            card.innerHTML = `
                <img class="market-img" src="${esc(n.image_url || '')}" alt="" onerror="this.style.display='none'">
                <div class="market-info">
                    <div class="market-name">${esc(n.name || 'NFT')}${n.attributes?.number ? ' #' + esc(n.attributes.number) : ''}</div>
                    ${fmtAttrsHtml(n.attributes)}
                    <div class="market-footer">
                        <span class="market-price">${fmt(n.price, n.currency)}</span>
                        <span class="market-seller">${esc(n.seller_name || 'ID: ' + n.owner_id)}</span>
                    </div>
                </div>`;
            card.onclick = () => openModal(n);
            $('#marketGrid').appendChild(card);
        });
    };

    /* ---------- Sell flow ---------- */
    const resetSell = () => {
        sellNft = null; sellCurrency = null;
        updateStepUI();
        $('#sellGrid').innerHTML = '';
        $('#sellEmpty').hidden = false;
        $('#sellPrice').value = '';
        $('#btnList').disabled = true;
        msg('sellMsg', '');
        initSellCurrencyGrid();
    };

    const stepOf = () => {
        if (!sellNft) return 1;
        if (!sellCurrency) return 2;
        return 3;
    };

    const updateStepUI = () => {
        const step = stepOf();
        $$('.step-dot').forEach(d => d.classList.toggle('active', Number(d.dataset.step) <= step));
        $$('.step-panel').forEach(p => p.classList.toggle('hidden', Number(p.dataset.step) !== step));
        $$('.step-line').forEach(l => l.classList.toggle('active', l.dataset.done < step));
    };

    const renderSellGrid = items => {
        const el = $('#sellGrid'), em = $('#sellEmpty');
        el.innerHTML = '';
        em.hidden = items.length > 0;
        items.forEach(n => {
            const attrs = n.attributes || {};
            const btn = document.createElement('button');
            btn.className = 'nft-item' + (n.is_listed ? ' selected' : '');
            btn.type = 'button';
            btn.setAttribute('role', 'listitem');
            btn.setAttribute('aria-label', n.name);
            btn.innerHTML = `
                <img class="nft-img" src="${esc(n.image_url || '')}" alt="" onerror="this.style.display='none'">
                <div class="nft-meta">
                    <span class="nft-name">${esc(n.name || 'NFT')}${attrs.number ? ' #' + esc(attrs.number) : ''}</span>
                    <span class="nft-status ${n.is_listed ? 'listed' : ''}">${n.is_listed ? '• На продаже' : '• В инвентаре'}</span>
                </div>`;
            btn.onclick = () => selectNft(n, btn);
            el.appendChild(btn);
        });
    };

    const selectNft = (nft, btn) => {
        $$('#sellGrid .nft-item').forEach(b => b.classList.remove('selected'));
        if (btn) btn.classList.add('selected');
        sellNft = nft;
        updateStepUI();
    };

    const initSellCurrencyGrid = () => {
        const el = $('#sellCurrencyGrid');
        if (!el) return;
        el.innerHTML = '';
        ['USDT', 'STARS', 'TON'].forEach(cur => {
            const btn = document.createElement('button');
            btn.className = 'currency-btn' + (sellCurrency === cur ? ' selected' : '');
            btn.type = 'button';
            btn.setAttribute('role', 'radio');
            btn.dataset.cur = cur;
            const icons = { USDT: 'fa-dollar-sign', STARS: 'fa-star', TON: 'fa-cube' };
            btn.innerHTML = '<i class="fa-solid ' + icons[cur] + '"></i><span>' + cur + '</span>';
            btn.onclick = () => selectCurrency(cur);
            el.appendChild(btn);
        });
    };

    const selectCurrency = (cur) => {
        $$('#sellCurrencyGrid .currency-btn').forEach(b => b.classList.remove('selected'));
        const btn = $('.currency-btn[data-cur="' + cur + '"]');
        if (btn) btn.classList.add('selected');
        sellCurrency = cur;
        if (sellNft) {
            $('#sellPreviewImg').src = sellNft.image_url || '';
            $('#sellPreviewName').textContent = sellNft.name || 'NFT';
            $('#sellPreviewCur').textContent = cur;
            $('#sellPreview').hidden = false;
        }
        updateStepUI();
    };

    const initSell = () => {
        $('#btnList').onclick = () => {
            if (!sellNft || !sellCurrency) { msg('sellMsg', 'Выберите NFT и валюту', 'warning'); return; }
            const price = Number($('#sellPrice').value);
            if (!price || price < 0.01) { msg('sellMsg', 'Укажите корректную цену (мин. 0.01)', 'warning'); return; }
            tgSend({ action: 'list_nft', nft_id: sellNft.id, price, currency: sellCurrency });
            msg('sellMsg', 'NFT выставлен на продажу!', 'ok');
            setTimeout(resetSell, 1500);
        };
    };

    /* ---------- Profile / Withdraw / Transactions ---------- */
    const loadProfile = () => {
        const a = tgApp();
        const u = a?.initDataUnsafe?.user || null;
        if (u) { fillProfile([u.first_name, u.last_name].filter(Boolean).join(' '), u.username, u.id, u.photo_url); return; }
        const sp = new URLSearchParams(location.search);
        const uid = Number(sp.get('uid'));
        if (uid) { fillProfile(sp.get('fn') || 'Неизвестно', sp.get('un') || '', uid); return; }
        fillProfile('Неизвестно', '', 0);
        tgSend({ action: 'get_balance' });
    };

    const toggleId = () => {
        idVisible = !idVisible;
        $('#profId').classList.toggle('show', idVisible);
    };

    const initWithdraw = () => {
        const amt = $('#wdAmt'), cur = $('#wdCur');
        const update = () => {
            const a = Number(amt.value || 0);
            if (a <= 0) { $('#wdReceive').textContent = '—'; return; }
            $('#wdReceive').textContent = (a * (1 - FEE)).toFixed(2);
        };
        amt.oninput = update;
        cur.onchange = update;

        $('#wdForm').addEventListener('submit', e => {
            e.preventDefault();
            const a = Number($('#wdAmt').value || 0);
            const w = $('#wdTo').value.trim();
            const c = $('#wdCur').value;
            if (a <= 0) { msg('wdMsg', 'Укажите сумму', 'warning'); return; }
            if (!w) { msg('wdMsg', 'Укажите @username или кошелёк', 'warning'); return; }
            const min = MONEY_MINS[c] || 0.01;
            if (a < min) { msg('wdMsg', 'Минимум: ' + min + ' ' + c, 'warning'); return; }
            if (c === 'USDT' && a > balances.usdt) { msg('wdMsg', 'Недостаточно. Баланс: ' + balances.usdt.toFixed(2) + ' USDT', 'warning'); return; }
            tgSend({ action: 'create_withdraw', amount: a, currency: c, wallet_address: w });
            msg('wdMsg', 'Заявка на вывод отправлена! Менеджер свяжется.', 'ok');
        });
    };

    const renderTx = items => {
        const el = $('#txList'), empty = $('#txEmpty');
        el.innerHTML = '';
        empty.hidden = items.length > 0;
        items.forEach(tx => {
            const a = Number(tx.amount) || 0;
            const div = document.createElement('div');
            div.className = 'tx-item';
            div.innerHTML = `
                <div class="tx-main">
                    <span class="tx-type">${esc(tx.type || '—')}</span>
                    <span class="tx-details">${esc(tx.details || tx.created_at || '')}</span>
                </div>
                <span class="tx-amount ${a >= 0 ? 'positive' : 'negative'}">${a >= 0 ? '+' : ''}${fmt(tx.amount, tx.currency)}</span>`;
            el.appendChild(div);
        });
    };

    /* ---------- Modal ---------- */
    const openModal = nft => {
        const attrs = nft.attributes || {};
        $('#modalImg').src = nft.image_url || '';
        $('#modalBadge').textContent = nft.is_listed ? 'НА ПРОДАЖЕ' : 'В ИНВЕНТАРЕ';
        $('#modalTitle').textContent = nft.name || 'NFT';
        $('#modalPrice').textContent = fmt(nft.price, nft.currency);
        $('#modalSeller').innerHTML = 'Продавец: <strong>' + esc(nft.seller_name || 'ID: ' + nft.owner_id) + '</strong>';
        $('#modalLink').href = nft.token_link || '#';
        $('#modalLink').textContent = nft.token_link ? 'Открыть в Telegram' : 'Ссылка недоступна';
        $('#modalAttrs').innerHTML = fmtAttrsHtml(attrs) || '<span class="tx-details">Атрибутов нет</span>';
        $('#modalBuy').disabled = !nft.is_listed;
        $('#modalBuy').textContent = nft.is_listed ? 'Купить' : 'Не в продаже';
        $('#modalPrice').dataset.nft = JSON.stringify(nft);
        msg('modalMsg', '');
        $('#modal').hidden = false;
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        $('#modal').hidden = true;
        document.body.style.overflow = '';
    };

    const initModal = () => {
        $('#modalClose').onclick = closeModal;
        $('#modalCancel').onclick = closeModal;
        $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
        $('#modalBuy').addEventListener('click', () => {
            const nft = $('#modalPrice').dataset.nft ? JSON.parse($('#modalPrice').dataset.nft) : null;
            if (!nft || !nft.is_listed) return;
            tgSend({ action: 'create_purchase_request', nft_id: nft.id, offer_price: Number(nft.price), currency: nft.currency || 'USDT' });
            msg('modalMsg', 'Заявка на покупку отправлена!', 'ok');
            setTimeout(closeModal, 1200);
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
    };

    /* ---------- Attributes formatting ---------- */
    const fmtAttrsHtml = a => {
        if (!a || typeof a !== 'object') return '';
        let h = '';
        if (a.model) h += '<div><span class="tx-details">Model:</span> <span>' + esc(a.model) + '</span></div>';
        if (a.backdrop) h += '<div><span class="tx-details">Backdrop:</span> <span>' + esc(a.backdrop) + '</span></div>';
        if (a.symbol) h += '<div><span class="tx-details">Symbol:</span> <span>' + esc(a.symbol) + '</span></div>';
        if (a.pattern) h += '<div><span class="tx-details">Pattern:</span> <span>' + esc(a.pattern) + '</span></div>';
        if (a.background) h += '<div><span class="tx-details">Background:</span> <span>' + esc(a.background) + '</span></div>';
        if (a.number) h += '<div><span class="tx-details">#:</span> <span>' + esc(a.number) + '</span></div>';
        return h;
    };

    /* ---------- WebApp data handlers ---------- */
    const renderBalance = m => {
        balances.usdt = Number(m.balance) || 0;
        balances.stars = Number(m.stars) || 0;
        balances.ton = Number(m.ton) || 0;
        $('#balUsdt').textContent = balances.usdt.toFixed(2);
        $('#balStars').textContent = String(Math.round(balances.stars));
        $('#balTon').textContent = balances.ton.toFixed(2);
        if (m.user_id) fillProfile(m.first_name || 'Неизвестно', m.username || '', m.user_id);
    };

    const onData = m => {
        const a = m?.action;
        if (a === 'get_balance') renderBalance(m);
        else if (a === 'get_market') { marketItems = (m.items || []).filter(n => n.is_listed); loadMarket(); }
        else if (a === 'get_my_nfts') loadMyNfts();
        else if (a === 'get_transactions') renderTx(m.items || []);
        else if (a === 'accept_rules') show('scrMenu');
    };

    /* ---------- Background ---------- */
    const initBg = () => {
        const c = $('#bgCanvas'); if (!c) return;
        const ctx = c.getContext('2d');
        const pts = [];
        const resize = () => { c.width = innerWidth; c.height = innerHeight; };
        const init = () => {
            pts.length = 0;
            const n = Math.floor(c.width * c.height / 20000);
            for (let i = 0; i < n; i++) {
                pts.push({
                    x: Math.random() * c.width, y: Math.random() * c.height,
                    r: Math.random() * 1.8 + 0.4,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35,
                    o: Math.random() * 0.4 + 0.08,
                });
            }
        };
        const frame = () => {
            ctx.clearRect(0, 0, c.width, c.height);
            for (const p of pts) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
                if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,212,170,' + p.o + ')';
                ctx.fill();
            }
            requestAnimationFrame(frame);
        };
        resize(); init(); frame();
        addEventListener('resize', () => { resize(); init(); });
    };

    /* ---------- Init ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        const a = tgApp();
        if (a) { try { a.expand(); } catch {} try { a.ready(); } catch {} }
        initBg(); initRules(); initNav(); initTabs(); initSell(); initWithdraw(); initModal();
        initSellCurrencyGrid();
        $('#btnToggleId').onclick = toggleId;
        loadProfile();
        setTimeout(loadProfile, 300);
        setTimeout(loadProfile, 1000);
        if (a) {
            try { a.onEvent('webapp_data', e => { try { onData(JSON.parse(e.data)); } catch { } }); } catch { }
        }
    });
})();
