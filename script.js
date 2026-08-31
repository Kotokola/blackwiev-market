(() => {
    'use strict';

    /* ===== Utilities ===== */
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": "'" }[c]));
    const fmt = (v, c) => (Number(v) || 0).toFixed(2) + ' ' + (c || '');
    const FEE = 0.05;

    const tgApp = () => { try { return window.Telegram?.WebApp || null } catch { return null } };
    const tgSend = data => { const a = tgApp(); if (!a) return; try { a.sendData(typeof data === 'string' ? data : JSON.stringify(data)) } catch { } };

    /* ===== State ===== */
    let balances = { usdt: 0, stars: 0, ton: 0 };
    let sellNft = null, sellCurrency = null, buyNft = null;
    let currentStep = 1;
    let idVisible = true;

    /* ===== Helpers ===== */
    const show = id => {
        $$('.screen').forEach(s => s.classList.remove('active'));
        const el = $(id); if (el) el.classList.add('active');
        window.scrollTo(0, 0);
    };

    const toast = (text, type = 'info') => {
        const container = $('#toastContainer');
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = text;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
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
        $('#profId').textContent = String(id || '—');
        if (photoUrl) $('#avatar').innerHTML = '<img src="' + esc(photoUrl) + '" alt="">';
        else $('#avatar').textContent = (name || '?')[0].toUpperCase();
    };

    /* ===== Profile / Auth ===== */
    const loadProfile = () => {
        const a = tgApp();
        if (a) {
            try { if (a.initDataUnsafe?.user) {
                const u = a.initDataUnsafe.user;
                fillProfile([u.first_name, u.last_name].filter(Boolean).join(' '), u.username, u.id, u.photo_url);
                return;
            }} catch {}
            try { if (a.initData) {
                const p = new URLSearchParams(a.initData);
                const raw = p.get('user');
                if (raw) { const u = JSON.parse(raw); fillProfile([u.first_name, u.last_name].filter(Boolean).join(' '), u.username, u.id, u.photo_url); return; }
            }} catch {}
        }
        try {
            const p = new URLSearchParams(location.search);
            const uid = p.get('uid');
            if (uid) { fillProfile(p.get('fn') || 'Неизвестно', p.get('un') || '', Number(uid)); return; }
        } catch {}
        fillProfile('Неизвестно', '', 0, null);
        tgSend({ action: 'get_balance' });
    };

    const toggleId = () => {
        idVisible = !idVisible;
        $('#profId').classList.toggle('show', idVisible);
        $('#btnToggleId').innerHTML = idVisible ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    };

    /* ===== Navigation ===== */
    const initNav = () => {
        $$('[data-go]').forEach(b => {
            b.onclick = () => {
                const g = b.dataset.go;
                show('scr' + g[0].toUpperCase() + g.slice(1));
                if (g === 'sell') { resetSell(); fetchMyNfts(); }
                if (g === 'buy') fetchMarket();
                if (g === 'profile') { loadProfile(); tgSend({ action: 'get_balance' }); fetchMyNfts(); }
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
                $$('.tab-panel').forEach(x => x.hidden = true);
                t.classList.add('active');
                t.setAttribute('aria-selected', 'true');
                const panel = $('.tab-panel[data-tab="' + t.dataset.tab + '"]');
                if (panel) panel.hidden = false;
                if (t.dataset.tab === 'inv') fetchMyNfts();
                if (t.dataset.tab === 'tx') tgSend({ action: 'get_transactions' });
                if (t.dataset.tab === 'wd') tgSend({ action: 'get_balance' });
            };
        });
    };

    /* ===== Rules ===== */
    const initRules = () => {
        const cb = $('#cbRules'), btn = $('#btnEnter');
        btn.disabled = !cb.checked;
        cb.onchange = () => { btn.disabled = !cb.checked };
        btn.onclick = () => {
            try { localStorage.setItem('bb_rules', '1'); } catch {}
            show('scrMenu');
            tgSend({ action: 'accept_rules' });
        };
        try { if (localStorage.getItem('bb_rules') === '1') show('scrMenu'); } catch {}
    };

    /* ===== Sell Flow ===== */
    const resetSell = () => {
        sellNft = null; sellCurrency = null; currentStep = 1;
        updateStepUI();
        $('#sellGrid').innerHTML = '';
        $('#sellEmpty').hidden = false;
        $('#sellPrice').value = '';
        $('#btnList').disabled = true;
        $$('.currency-btn').forEach(b => b.classList.remove('selected'));
        $('#sellPreview').hidden = true;
        msg('sellMsg', '', '');
    };

    const updateStepUI = () => {
        $$('.step-dot').forEach((d, i) => {
            d.classList.toggle('active', i + 1 <= currentStep);
        });
        $$('.step-panel').forEach(p => p.hidden = Number(p.dataset.step) !== currentStep);
        $$('.step-line').forEach((l, i) => {
            l.style.setProperty('--fill', i + 1 < currentStep ? '100%' : '0%');
        });
    };

    const renderSellGrid = items => {
        const el = $('#sellGrid'), em = $('#sellEmpty');
        el.innerHTML = '';
        em.hidden = items.length > 0;
        items.forEach(n => {
            const attrs = n.attributes || {};
            const btn = document.createElement('button');
            btn.className = 'nft-item';
            btn.type = 'button';
            btn.setAttribute('role', 'listitem');
            btn.setAttribute('aria-label', n.name);
            btn.innerHTML = `
                <img class="nft-img" src="${esc(n.image_url || '')}" alt="" onerror="this.style.display='none'">
                <div class="nft-meta">
                    <span class="nft-name">${esc(n.name || 'NFT')}${attrs.number ? ' #' + esc(attrs.number) : ''}</span>
                    <span class="nft-status ${n.is_listed ? 'listed' : ''}">${n.is_listed ? '• На продаже' : '• В инвентаре'}</span>
                </div>
            `;
            btn.onclick = () => selectNft(n, btn);
            el.appendChild(btn);
        });
    };

    const selectNft = (nft, btn) => {
        $$('#sellGrid .nft-item').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        sellNft = nft;
        currentStep = 2;
        updateStepUI();
        renderCurrencyBtns();
    };

    const renderCurrencyBtns = () => {
        const el = $('.currency-grid');
        if (!el) return;
        el.innerHTML = '';
        ['USDT', 'STARS', 'TON'].forEach(cur => {
            const btn = document.createElement('button');
            btn.className = 'currency-btn';
            btn.type = 'button';
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', 'false');
            btn.dataset.cur = cur;
            const icons = { USDT: 'fa-dollar-sign', STARS: 'fa-star', TON: 'fa-cube' };
            btn.innerHTML = `<i class="fa-solid ${icons[cur]}"></i><span>${cur}</span>`;
            btn.onclick = () => selectCurrency(cur, btn);
            el.appendChild(btn);
        });
    };

    const selectCurrency = (cur, btn) => {
        $$('.currency-grid .currency-btn').forEach(b => {
            b.classList.remove('selected');
            b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        sellCurrency = cur;
        if (sellNft) {
            $('#sellPreviewImg').src = sellNft.image_url || '';
            $('#sellPreviewName').textContent = sellNft.name || 'NFT';
            $('#sellPreviewCur').textContent = cur;
            $('#sellPreview').hidden = false;
        }
        currentStep = 3;
        updateStepUI();
    };

    const initSell = () => {
        $('#btnList').onclick = () => {
            if (!sellNft || !sellCurrency) { msg('sellMsg', 'Выберите NFT и валюту', 'wn'); return; }
            const price = Number($('#sellPrice').value);
            if (!price || price < 0.01) { msg('sellMsg', 'Укажите корректную цену (мин. 0.01)', 'wn'); return; }
            tgSend({ action: 'list_nft', nft_id: sellNft.id, price: price, currency: sellCurrency });
            msg('sellMsg', 'NFT выставлен на продажу!', 'ok');
            setTimeout(resetSell, 1500);
        };
    };

    /* ===== Market / Buy ===== */

    const fetchMarket = async () => {
        try {
            const sp = new URLSearchParams(location.search);
            const mktParam = sp.get('market');
            if (mktParam) {
                try {
                    const items = JSON.parse(mktParam);
                    if (Array.isArray(items) && items.length) {
                        items.forEach(it => { if (!it.seller_name) it.seller_name = 'ID:' + (it.owner_id || ''); });
                        renderMarket(items);
                        return;
                    }
                } catch {}
            }
            const r = await fetch('./api.json?' + Date.now());
            if (!r.ok) throw new Error('no api');
            const data = await r.json();
            const all = Object.values(data).flat();
            const items = all.filter(x => x.is_listed);
            items.forEach(it => { if (!it.seller_name) it.seller_name = 'ID:' + (it.owner_id || ''); });
            renderMarket(items);
        } catch {
            try { tgSend({ action: 'get_market' }); } catch {}
        }
    };

    const renderMarket = items => {
        const el = $('#marketGrid'), em = $('#marketEmpty');
        el.innerHTML = '';
        em.hidden = items.length > 0;
        items.forEach(n => {
            const attrs = n.attributes || {};
            const card = document.createElement('div');
            card.className = 'market-item';
            card.setAttribute('role', 'listitem');
            const attrHtml = fmtAttrsHtml(n.attributes);
            card.innerHTML = `
                <img class="market-img" src="${esc(n.image_url || '')}" alt="" onerror="this.style.display='none'">
                <div class="market-info">
                    <div class="market-name">${esc(n.name || 'NFT')}${n.attributes?.number ? ' #' + esc(n.attributes.number) : ''}</div>
                    ${attrHtml ? '<div class="market-attrs">' + attrHtml + '</div>' : ''}
                    <div class="market-footer">
                        <span class="market-price">${fmt(n.price, n.currency)}</span>
                        <span class="market-seller">${esc(n.seller_name || 'ID:' + n.owner_id)}</span>
                    </div>
                </div>
            `;
            card.onclick = () => openModal(n);
            $('#marketGrid').appendChild(card);
        });
    };

    /* ===== Profile / Inventory ===== */
    const fetchMyNfts = async () => {
        try {
            const sp = new URLSearchParams(location.search);
            const nftsParam = sp.get('nfts');
            if (nftsParam) {
                try {
                    const items = JSON.parse(nftsParam);
                    if (Array.isArray(items) && items.length) {
                        renderInventory(items);
                        return;
                    }
                } catch {}
            }
            const uid = sp.get('uid') || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0;
            const r = await fetch('./api.json?' + Date.now());
            if (!r.ok) throw new Error('no api');
            const data = await r.json();
            renderInventory(data[String(uid)] || []);
        } catch {
            try { tgSend({ action: 'get_my_nfts' }); } catch {}
        }
    };

    const renderInventory = items => {
        const el = $('#invGrid'), em = $('#invEmpty'), cnt = $('#invCount');
        el.innerHTML = '';
        em.hidden = items.length > 0;
        cnt.textContent = items.length;
        items.forEach(n => {
            const attrs = n.attributes || {};
            const status = n.is_listed ? '• На продаже' : '• В инвентаре';
            const card = document.createElement('div');
            card.className = 'nft-item' + (n.is_listed ? ' listed' : '');
            card.setAttribute('role', 'listitem');
            card.innerHTML = `
                <img class="nft-img" src="${esc(n.image_url || '')}" alt="" onerror="this.style.display='none'">
                <div class="nft-meta">
                    <span class="nft-name">${esc(n.name || 'NFT')}${attrs.number ? ' #' + esc(attrs.number) : ''}</span>
                    <span class="nft-status ${n.is_listed ? 'listed' : ''}">${esc(status)}</span>
                </div>
            `;
            el.appendChild(card);
        });
    };

    /* ===== Modal ===== */
    const openModal = nft => {
        buyNft = nft;
        const attrs = nft.attributes || {};
        $('#modalImg').src = nft.image_url || '';
        $('#modalBadge').textContent = nft.is_listed ? 'НА ПРОДАЖЕ' : 'В ИНВЕНТАРЕ';
        $('#modalTitle').textContent = nft.name || 'NFT';
        $('#modalPrice').textContent = fmt(nft.price, nft.currency);
        $('#modalSeller').innerHTML = `Продавец: <strong>${esc(nft.seller_name || 'ID:' + nft.owner_id)}</strong>`;
        $('#modalLink').href = nft.token_link || '#';
        $('#modalLink').textContent = nft.token_link ? 'Открыть в Telegram' : 'Ссылка недоступна';
        $('#modalAttrs').innerHTML = fmtAttrsHtml(attrs) || '<span class="attr-tag">Атрибутов нет</span>';
        $('#modalBuy').disabled = nft.is_listed ? false : true;
        $('#modalBuy').textContent = nft.is_listed ? 'Купить' : 'Не в продаже';
        msg('modalMsg', '', '');
        $('#modal').hidden = false;
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        buyNft = null;
        $('#modal').hidden = true;
        document.body.style.overflow = '';
    };

    const initModal = () => {
        $('#modalClose').onclick = closeModal;
        $('#modalCancel').onclick = closeModal;
        $('#modal').onclick = e => { if (e.target === $('#modal')) closeModal(); };
        $('#modalBuy').onclick = () => {
            if (!buyNft || !buyNft.is_listed) return;
            tgSend({ action: 'create_purchase_request', nft_id: buyNft.id, offer_price: Number(buyNft.price), currency: buyNft.currency || 'USDT' });
            msg('modalMsg', 'Заявка на покупку отправлена!', 'ok');
            setTimeout(closeModal, 1500);
        };
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
    };

    /* ===== Withdraw ===== */
    const initWithdraw = () => {
        const ai = $('#wdAmt'), cs = $('#wdCur'), cl = $('#wdPreview');
        const update = () => {
            const a = Number(ai.value || 0), c = cs.value;
            if (a <= 0) { cl.innerHTML = 'К получению: <strong>—</strong>'; return; }
            cl.innerHTML = 'К получению: <strong>' + (a * (1 - FEE)).toFixed(2) + '</strong> ' + c;
        };
        ai.oninput = update; cs.onchange = update;

        $('#wdForm').onsubmit = e => {
            e.preventDefault();
            const a = Number($('#wdAmt').value || 0), w = $('#wdTo').value.trim(), cur = $('#wdCur').value;
            if (a <= 0) { msg('wdMsg', 'Укажите сумму', 'wn'); return; }
            if (!w) { msg('wdMsg', 'Укажите @username или кошелёк', 'wn'); return; }
            const mins = { USDT: 1, STARS: 50, TON: 0.5 };
            if (a < mins[cur]) { msg('wdMsg', 'Минимум: ' + mins[cur] + ' ' + cur, 'wn'); return; }
            if (cur === 'USDT' && a > balances.usdt) { msg('wdMsg', 'Недостаточно. Баланс: ' + balances.usdt.toFixed(2) + ' USDT', 'wn'); return; }
            if (cur === 'STARS' && a > balances.stars) { msg('wdMsg', 'Недостаточно. Баланс: ' + balances.stars + ' Stars', 'wn'); return; }
            if (cur === 'TON' && a > balances.ton) { msg('wdMsg', 'Недостаточно. Баланс: ' + balances.ton.toFixed(2) + ' TON', 'wn'); return; }
            tgSend({ action: 'create_withdraw', amount: a, currency: cur, wallet_address: w });
            msg('wdMsg', 'Заявка на вывод отправлена! Менеджер свяжется.', 'ok');
        };
    };

    /* ===== Transactions ===== */
    const renderTx = items => {
        const el = $('#txList'), em = $('#txEmpty');
        el.innerHTML = '';
        em.hidden = items.length > 0;
        items.forEach(tx => {
            const a = Number(tx.amount) || 0;
            const div = document.createElement('div');
            div.className = 'tx-item';
            div.innerHTML = `
                <div class="tx-main">
                    <span class="tx-type">${esc(tx.type || '—')}</span>
                    <span class="tx-details">${esc(tx.details || tx.created_at || '')}</span>
                </div>
                <span class="tx-amount ${a >= 0 ? 'positive' : 'negative'}">${a >= 0 ? '+' : ''}${fmt(tx.amount, tx.currency)}</span>
            `;
            $('#txList').appendChild(div);
        });
    };

    /* ===== Balance ===== */
    const renderBalance = m => {
        balances.usdt = Number(m.balance) || 0;
        balances.stars = Number(m.stars) || 0;
        balances.ton = Number(m.ton) || 0;
        $('#balUsdt').textContent = balances.usdt.toFixed(2);
        $('#balStars').textContent = balances.stars.toFixed(0);
        $('#balTon').textContent = balances.ton.toFixed(2);
        if (m.user_id) fillProfile(m.first_name || 'Неизвестно', m.username || '', m.user_id, null);
    };

    /* ===== Withdraw Preview ===== */
    const updateWithdrawPreview = () => {
        const a = Number($('#wdAmt').value || 0), c = $('#wdCur').value;
        const preview = $('#wdPreview');
        if (a <= 0) { preview.innerHTML = 'К получению: <strong>—</strong>'; return; }
        preview.innerHTML = 'К получению: <strong>' + (a * (1 - FEE)).toFixed(2) + '</strong> ' + c;
    };

    /* ===== Attribute Formatting ===== */
    function fmtAttrsHtml(a) {
        if (!a || typeof a !== 'object') return '';
        let h = '';
        if (a.model) h += '<div><span class="attr-label">Model:</span><span class="attr-value">' + esc(a.model) + '</span></div>';
        if (a.backdrop) h += '<div><span class="attr-label">Backdrop:</span><span class="attr-value">' + esc(a.backdrop) + '</span></div>';
        if (a.symbol) h += '<div><span class="attr-label">Symbol:</span><span class="attr-value">' + esc(a.symbol) + '</span></div>';
        if (a.pattern) h += '<div><span class="attr-label">Pattern:</span><span class="attr-value">' + esc(a.pattern) + '</span></div>';
        if (a.background) h += '<div><span class="attr-label">Background:</span><span class="attr-value">' + esc(a.background) + '</span></div>';
        if (a.number) h += '<div><span class="attr-label">#:</span><span class="attr-value">' + esc(a.number) + '</span></div>';
        return h;
    }

    /* ===== Data Handlers ===== */
    const onData = m => {
        const a = m?.action;
        if (a === 'get_balance') renderBalance(m);
        if (a === 'get_market') fetchMarket();
        if (a === 'get_my_nfts') fetchMyNfts();
        if (a === 'get_transactions') renderTx(m.items || []);
        if (a === 'accept_rules') show('scrMenu');
    };

    /* ===== Background ===== */
    const initBg = () => {
        const c = $('#bgCanvas'); if (!c) return;
        const ctx = c.getContext('2d'); let w, h, pts = [];
        const resize = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
        const init = () => { pts = []; for (let i = 0, n = Math.floor(w * h / 18000); i < n; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + .4, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, o: Math.random() * .4 + .08 }); };
        const frame = () => { ctx.clearRect(0, 0, w, h); for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,136,204,' + p.o + ')'; ctx.fill(); } requestAnimationFrame(frame); };
        resize(); init(); frame(); addEventListener('resize', () => { resize(); init(); });
    };

    /* ===== Init ===== */
    document.addEventListener('DOMContentLoaded', () => {
        const a = tgApp();
        if (a) { try { a.expand() } catch {} try { a.ready() } catch {} }
        initBg(); initRules(); initNav(); initTabs(); initSell(); initWithdraw(); initModal();
        $('#btnToggleId').onclick = () => { idVisible = !idVisible; $('#profId').classList.toggle('show', idVisible); $('#btnToggleId').innerHTML = idVisible ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>'; };
        loadProfile(); setTimeout(loadProfile, 300); setTimeout(loadProfile, 1000);

        /* ===== WebApp Data Listener ===== */
        if (a) try { a.onEvent('webapp_data', e => { try { onData(JSON.parse(e.data)); } catch {} }) } catch {}
    });
})();