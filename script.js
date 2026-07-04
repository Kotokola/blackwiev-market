(() => {
  const ACTION = {
    ACCEPT_RULES: 'accept_rules',
    GET_BALANCE: 'get_balance',
    GET_MARKET: 'get_market',
    GET_MY_NFTS: 'get_my_nfts',
    GET_MY_TX: 'get_transactions',
    CREATE_PURCHASE_REQUEST: 'create_purchase_request',
    CREATE_WITHDRAW: 'create_withdraw',
    LIST_NFT: 'list_nft',
    UNLIST_NFT: 'unlist_nft'
  };

  const $ = (id) => document.getElementById(id);

  const screens = {
    rules: $('screenRules'),
    main: $('screenMainMenu'),
    sell: $('screenSell'),
    buy: $('screenBuy'),
    profile: $('screenProfile'),
  };

  function setScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.add('hidden'));
    if (screens[name]) screens[name].classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function tgApp() {
    return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  }

  function tgSend(actionOrPayload) {
    const app = tgApp();
    if (!app) throw new Error('Telegram WebApp API not found');
    const data = typeof actionOrPayload === 'string'
      ? JSON.stringify({ action: actionOrPayload })
      : JSON.stringify(actionOrPayload);
    app.sendData(data);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setStatus(id, text, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'status';
    if (kind) el.classList.add(kind);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPrice(price, currency) {
    const num = Number(price) || 0;
    return `${num.toFixed(2)} ${escapeHtml(currency || 'USDT')}`;
  }

  // ===== Rules =====
  function initRules() {
    const cb = $('rulesAcceptedCheckbox');
    const btn = $('btnAcceptRules');

    if (!cb || !btn) return;

    btn.disabled = !cb.checked;
    cb.addEventListener('change', () => {
      btn.disabled = !cb.checked;
    });

    btn.addEventListener('click', () => {
      try {
        tgSend({ action: ACTION.ACCEPT_RULES });
      } catch (e) {
        setStatus('rulesStatus', 'Запусти mini app внутри Telegram.', 'danger');
      }
    });
  }

  // ===== Main menu =====
  function initMenu() {
    document.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        const go = btn.dataset.go;
        if (go === 'sell') { setScreen('sell'); requestMyNfts(); }
        if (go === 'buy') { setScreen('buy'); requestMarket(); }
        if (go === 'profile') { setScreen('profile'); requestBalance(); requestMyNfts(); }
      });
    });

    document.querySelectorAll('[data-back="main"]').forEach(btn => {
      btn.addEventListener('click', () => setScreen('main'));
    });
  }

  // ===== Profile tabs =====
  function initProfileTabs() {
    const tabs = document.querySelectorAll('.tab[data-profile-tab]');
    const sections = document.querySelectorAll('.profile-section[data-tab]');
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.profileTab;
        sections.forEach(sec => {
          sec.classList.toggle('hidden', sec.dataset.tab !== tabName);
        });
        if (tabName === 'inventory') requestMyNfts();
        if (tabName === 'tx') requestTransactions();
        if (tabName === 'withdraw') requestBalance();
      });
    });
    tabs[0].click();
  }

  // ===== Sell screen =====
  function initSell() {
    const list = $('sellInventory');
    const empty = $('sellInvEmpty');
    const selected = $('sellSelectedNft');
    const currency = $('sellCurrency');
    const priceInput = $('sellPriceInput');
    const btn = $('btnListNft');
    const status = $('sellStatus');

    let selectedNftId = null;

    btn.addEventListener('click', () => {
      if (!selectedNftId) return;
      const price = Number(priceInput.value);
      const cur = currency.value;

      if (!Number.isFinite(price) || price <= 0) {
        setStatus('sellStatus', 'Введите сумму > 0', 'warning');
        return;
      }

      try {
        setStatus('sellStatus', 'Отправляю...', 'info');
        tgSend({ action: ACTION.LIST_NFT, nft_id: selectedNftId, price, currency: cur });
      } catch {
        setStatus('sellStatus', 'Ошибка Telegram WebApp', 'danger');
      }
    });

    window._sellUI = {
      renderInventory(items) {
        list.innerHTML = '';
        empty.style.display = items && items.length ? 'none' : 'block';
        if (!items || !items.length) return;

        items.forEach(nft => {
          const b = document.createElement('button');
          b.className = 'list-item';
          b.type = 'button';
          b.innerHTML = `
            <div class="list-item-media">
              <img src="${escapeHtml(nft.image_url || '')}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2230%22>NFT</text></svg>'">
            </div>
            <div class="list-item-body">
              <div class="list-item-title">${escapeHtml(nft.name || 'NFT')}</div>
              <div class="list-item-sub">${escapeHtml(nft.rarity || '')}</div>
            </div>
          `;
          b.addEventListener('click', () => {
            list.querySelectorAll('.list-item').forEach(el => el.classList.remove('selected'));
            b.classList.add('selected');
            selectedNftId = nft.id;
            selected.textContent = nft.name || 'NFT';
            btn.disabled = false;
            setStatus('sellStatus', '', '');
          });
          list.appendChild(b);
        });
      }
    };
  }

  // ===== Buy screen =====
  function initBuy() {
    const marketList = $('marketList');
    const empty = $('marketEmpty');
    const btnConfirm = $('btnConfirmBuy');
    let selectedNft = null;

    btnConfirm.addEventListener('click', () => {
      if (!selectedNft) return;
      try {
        tgSend({
          action: ACTION.CREATE_PURCHASE_REQUEST,
          nft_id: selectedNft.id,
          offer_price: Number(selectedNft.price),
          currency: selectedNft.currency || 'USDT'
        });
        setStatus('modalBuyStatus', 'Заявка отправлена!', 'success');
      } catch {
        setStatus('modalBuyStatus', 'Ошибка', 'danger');
      }
    });

    window._buyUI = {
      renderMarket(items) {
        marketList.innerHTML = '';
        empty.style.display = items && items.length ? 'none' : 'block';
        if (!items || !items.length) return;

        items.forEach(nft => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'market-card';
          card.innerHTML = `
            <div class="market-card-media">
              <img src="${escapeHtml(nft.image_url || '')}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2230%22>NFT</text></svg>'">
            </div>
            <div class="market-card-body">
              <div class="market-card-title">${escapeHtml(nft.name || 'NFT')}</div>
              <div class="market-card-meta">
                <div class="meta-row">
                  <span class="meta-label">Цена:</span>
                  <span class="meta-value">${formatPrice(nft.price, nft.currency)}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Продавец:</span>
                  <span class="meta-value">${escapeHtml(nft.seller_name || 'ID: ' + (nft.owner_id || ''))}</span>
                </div>
              </div>
            </div>
          `;
          card.addEventListener('click', () => {
            selectedNft = nft;
            $('modalImage').src = nft.image_url || '';
            $('modalTitle').textContent = nft.name || 'NFT';
            $('modalPrice').textContent = formatPrice(nft.price, nft.currency);
            $('modalOwner').textContent = nft.seller_name || '';
            $('modalDescription').textContent = nft.rarity ? `Редкость: ${nft.rarity}` : '';
            $('modalTokenLink').textContent = nft.token_link || 'Нет ссылки';
            $('modalRarity').textContent = (nft.rarity || 'common').toUpperCase();
            $('modalRarityText').textContent = nft.rarity || 'common';
            $('modalBuyStatus').textContent = '';
            $('nftModal').classList.add('active');
            document.body.style.overflow = 'hidden';
            btnConfirm.disabled = false;
          });
          marketList.appendChild(card);
        });
      }
    };

    // Modal close
    const modal = $('nftModal');
    const closeBtn = $('modalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ===== Withdraw =====
  function initWithdraw() {
    const btn = $('btnCreateWithdraw');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const amount = Number($('withdrawAmountInput')?.value || 0);
      const wallet = $('withdrawWalletInput')?.value || '';

      if (!Number.isFinite(amount) || amount < 1) {
        setStatus('withdrawStatus', 'Минимум 1 USDT', 'warning');
        return;
      }

      try {
        setStatus('withdrawStatus', 'Создаю заявку...', 'info');
        tgSend({ action: ACTION.CREATE_WITHDRAW, amount, wallet_address: wallet || null });
      } catch {
        setStatus('withdrawStatus', 'Ошибка Telegram WebApp', 'danger');
      }
    });
  }

  // ===== Profile =====
  function renderProfile(user) {
    if (!user) return;
    setText('profileName', user.username ? '@' + user.username : (user.first_name || 'Пользователь'));
    setText('profileUsername', user.username || '—');
    setText('profileId', user.user_id || '—');
    setText('balUsdt', (Number(user.balance) || 0).toFixed(2));
  }

  function renderProfileInventory(items) {
    const list = $('profileInventory');
    const empty = $('profileInvEmpty');
    if (!list) return;
    list.innerHTML = '';
    empty.style.display = items && items.length ? 'none' : 'block';
    if (!items || !items.length) return;

    items.forEach(nft => {
      const b = document.createElement('div');
      b.className = 'list-item';
      b.innerHTML = `
        <div class="list-item-media">
          <img src="${escapeHtml(nft.image_url || '')}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2230%22>NFT</text></svg>'">
        </div>
        <div class="list-item-body">
          <div class="list-item-title">${escapeHtml(nft.name || 'NFT')}</div>
          <div class="list-item-sub">${nft.is_listed ? 'В продаже' : 'Не в продаже'}</div>
        </div>
      `;
      list.appendChild(b);
    });
  }

  function renderTx(items) {
    const list = $('txList');
    const empty = $('txEmpty');
    if (!list) return;
    list.innerHTML = '';
    empty.style.display = items && items.length ? 'none' : 'block';
    if (!items || !items.length) return;

    items.forEach(tx => {
      const row = document.createElement('div');
      row.className = 'tx-item';
      const amount = Number(tx.amount) || 0;
      const sign = amount >= 0 ? '+' : '';
      row.innerHTML = `
        <div class="tx-type">${escapeHtml(tx.type || tx.action || '—')}</div>
        <div class="tx-amount">${sign}${amount.toFixed(2)} ${escapeHtml(tx.currency || 'USDT')}</div>
        <div class="tx-detail">${escapeHtml(tx.details || tx.created_at || '')}</div>
      `;
      list.appendChild(row);
    });
  }

  // ===== Requests =====
  function requestBalance() {
    try { tgSend(ACTION.GET_BALANCE); } catch {}
  }
  function requestMyNfts() {
    try { tgSend(ACTION.GET_MY_NFTS); } catch {}
  }
  function requestTransactions() {
    try { tgSend(ACTION.GET_MY_TX); } catch {}
  }
  function requestMarket() {
    try { tgSend(ACTION.GET_MARKET); } catch {}
  }

  // ===== Backend message handler =====
  function handleBackendMessage(msg) {
    const action = msg?.action || msg?.type || null;

    if (action === ACTION.GET_BALANCE) {
      const bal = msg?.balance ?? msg?.usdt ?? msg?.usdt_balance ?? 0;
      setText('balUsdt', (Number(bal) || 0).toFixed(2));
      renderProfile(msg);
      return;
    }
    if (action === ACTION.GET_MARKET) {
      const items = msg?.items || msg?.listings || [];
      window._buyUI?.renderMarket(items);
      return;
    }
    if (action === ACTION.GET_MY_NFTS) {
      const items = msg?.items || msg?.nfts || [];
      window._sellUI?.renderInventory(items);
      renderProfileInventory(items);
      return;
    }
    if (action === ACTION.GET_MY_TX || action === 'get_transactions') {
      const items = msg?.items || msg?.transactions || [];
      renderTx(items);
      return;
    }
    // Accept rules confirmation
    if (action === 'accept_rules') {
      setScreen('main');
      return;
    }
  }

  // ===== Telegram WebApp handlers =====
  function attachWebAppHandlers() {
    const app = tgApp();
    if (!app) return;

    try {
      app.onEvent('webapp_data', (event) => {
        if (!event?.data) return;
        try {
          const parsed = JSON.parse(event.data);
          handleBackendMessage(parsed);
        } catch {}
      });
    } catch {}
  }

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', () => {
    attachWebAppHandlers();
    initRules();
    initMenu();
    initProfileTabs();
    initSell();
    initBuy();
    initWithdraw();
    setScreen('rules');
  });
})();
