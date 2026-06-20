(() => {
  const ACTION = {
    ACCEPT_RULES: 'accept_nft_rules',
    GET_BALANCE: 'get_balance',
    GET_MARKET: 'get_market',
    GET_MY_NFTS: 'get_my_nfts',
    GET_MY_TX: 'get_transactions',
    CREATE_PURCHASE_REQUEST: 'create_purchase_request',
    CREATE_WITHDRAW_REQUEST: 'create_withdrawal_request',
    LIST_NFT: 'list_nft'
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
    el.classList.remove('success', 'warning', 'danger');
    if (kind) el.classList.add(kind);
  }

  // ===== Rules =====
  function initRules() {
    const cb = $('rulesAcceptedCheckbox');
    const btn = $('btnAcceptRules');
    const status = $('rulesStatus');

    if (!cb || !btn) return;

    btn.disabled = !cb.checked;

    cb.addEventListener('change', () => {
      btn.disabled = !cb.checked;
      setStatus('rulesStatus', '', 'info');
    });

    btn.addEventListener('click', () => {
      try {
        tgSend(ACTION.ACCEPT_RULES);
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
        if (go === 'sell') setScreen('sell');
        if (go === 'buy') setScreen('buy');
        if (go === 'profile') setScreen('profile');
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
          if (sec.dataset.tab === tabName) sec.classList.remove('hidden');
          else sec.classList.add('hidden');
        });

        if (tabName === 'inventory') requestMyNfts();
        if (tabName === 'tx') requestTransactions();
        if (tabName === 'withdraw') requestBalanceOnly();
      });
    });

    tabs[0].click();
  }

  // ===== DOM render helpers =====
  function renderList(listEl, items, renderItem) {
    listEl.innerHTML = '';
    if (!items || items.length === 0) return;

    items.forEach(it => {
      const node = renderItem(it);
      if (node) listEl.appendChild(node);
    });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '<')
      .replaceAll('>', '>')
      .replaceAll('"', '"')
      .replaceAll("'", '&#039;');
  }

  // ===== Requests (backend wiring) =====
  function requestBalanceOnly() {
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
        setStatus('sellStatus', 'Отправляю листинг...', 'info');
        tgSend({
          action: ACTION.LIST_NFT,
          nft_id: selectedNftId,
          price,
          currency: cur
        });
      } catch {
        setStatus('sellStatus', 'Ошибка Telegram WebApp', 'danger');
      }
    });

    // Inventory rendering expected from backend response via message.answer is not available in Web;
    // so for now we render only when backend sends data via sendData->webapp_data.data workflow.
    // In your current backend, responses are via message.answer; we need backend to return JSON to frontend.
    // We'll keep UI ready; backend update will follow next.

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
              <img src="${escapeHtml(nft.image_url || nft.imageUrl || nft.image || '')}" alt="">
            </div>
            <div class="list-item-body">
              <div class="list-item-title">${escapeHtml(nft.name || nft.title || 'NFT')}</div>
              <div class="list-item-sub">${escapeHtml(nft.rarity || '')}</div>
            </div>
          `;
          b.addEventListener('click', () => {
            selectedNftId = nft.id ?? nft.nft_id;
            selected.textContent = nft.name || nft.title || 'NFT';
            btn.disabled = false;
            setStatus('sellStatus', '', 'info');
          });
          list.appendChild(b);
        });
      }
    };

    document.querySelectorAll('#screenMainMenu [data-go="sell"]').forEach(b => {
      b.addEventListener('click', () => requestMyNfts());
    });
  }

  function initBuy() {
    const marketList = $('marketList');
    const empty = $('marketEmpty');

    let selectedNft = null;

    const btnConfirm = $('btnConfirmBuy');
    btnConfirm.addEventListener('click', () => {
      if (!selectedNft) return;
      try {
        tgSend({
          action: ACTION.CREATE_PURCHASE_REQUEST,
          nft_id: selectedNft.id,
          offer_price: Number(selectedNft.price),
          currency: selectedNft.currency || 'USDT'
        });
      } catch {}
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
              <img src="${escapeHtml(nft.image_url || nft.imageUrl || nft.image || '')}" alt="">
            </div>
            <div class="market-card-body">
              <div class="market-card-title">${escapeHtml(nft.name || nft.title || 'NFT')}</div>
              <div class="market-card-meta">
                <div class="meta-row">
                  <span class="meta-label">Сумма:</span>
                  <span class="meta-value">${escapeHtml(nft.price)} ${escapeHtml(nft.currency || 'USDT')}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Продавец:</span>
                  <span class="meta-value">${escapeHtml(nft.owner_id != null ? 'ID: ' + nft.owner_id : nft.owner_username || '')}</span>
                </div>
              </div>
            </div>
          `;
          card.addEventListener('click', () => {
            selectedNft = nft;
            // modal open
            $('modalImage').src = nft.image_url || nft.imageUrl || nft.image || '';
            $('modalTitle').textContent = nft.name || nft.title || 'NFT';
            $('modalPrice').textContent = `${nft.price} ${nft.currency || 'USDT'}`;
            $('modalOwner').textContent = nft.owner_username ? '@' + nft.owner_username : (nft.owner_id != null ? 'ID: ' + nft.owner_id : '—');
            $('modalDescription').textContent = nft.rarity ? String(nft.rarity) : '';
            $('modalTokenLink').textContent = nft.token_link || nft.tokenLink || '—';
            $('modalRarity').textContent = nft.rarity ? String(nft.rarity) : '—';

            const modal = $('nftModal');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            btnConfirm.disabled = false;
          });
          marketList.appendChild(card);
        });
      }
    };

    // open modal close
    const modal = $('nftModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) closeModal();
    });

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('#screenMainMenu [data-go="buy"]').forEach(b => {
      b.addEventListener('click', () => requestMarket());
    });
  }

  function initWithdraw() {
    const btn = $('btnCreateWithdraw');
    const status = $('withdrawStatus');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const currency = $('withdrawCurrency')?.value || 'USDT';
      const amount = Number($('withdrawAmountInput')?.value || 0);
      const wallet = $('withdrawWalletInput')?.value || '';

      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus('withdrawStatus', 'Введите сумму > 0', 'warning');
        return;
      }

      try {
        setStatus('withdrawStatus', 'Создаю заявку...', 'info');
        tgSend({
          action: ACTION.CREATE_WITHDRAW_REQUEST,
          currency,
          amount,
          wallet_address: wallet || null
        });
      } catch {
        setStatus('withdrawStatus', 'Ошибка Telegram WebApp', 'danger');
      }
    });
  }

  function initTransactions() {
    // rendering expects backend JSON; once backend sends data back we can fill.
    // keep empty for now; backend fix next.
  }

  // ===== Seasonal effects (from old, with DOM guards) =====
  function setupSeasonalEffects() {
    const seasonBtns = document.querySelectorAll('.season-btn');
    const sunRays = document.getElementById('sunRays');
    const fallingLeaves = document.getElementById('fallingLeaves');
    const snowflakes = document.getElementById('snowflakes');
    const fallingFlowers = document.getElementById('fallingFlowers');
    if (!sunRays || !fallingLeaves || !snowflakes || !fallingFlowers) return;

    generateLeaves();
    generateSnowflakes();
    generateFlowers();

    seasonBtns.forEach(btn => {
      btn.addEventListener('click', () => setSeason(btn.dataset.season));
    });
  }

  function generateLeaves() {
    const container = document.getElementById('fallingLeaves');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const leaf = document.createElement('div');
      leaf.className = 'leaf';
      leaf.style.left = `${Math.random() * 100}%`;
      leaf.style.animationDuration = `${8 + Math.random() * 10}s`;
      leaf.style.animationDelay = `${Math.random() * 10}s`;
      leaf.style.width = `${20 + Math.random() * 20}px`;
      leaf.style.height = `${20 + Math.random() * 20}px`;
      container.appendChild(leaf);
    }
  }

  function generateSnowflakes() {
    const container = document.getElementById('snowflakes');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
      const snowflake = document.createElement('div');
      snowflake.className = 'snowflake';
      snowflake.style.left = `${Math.random() * 100}%`;
      snowflake.style.animationDuration = `${5 + Math.random() * 10}s`;
      snowflake.style.animationDelay = `${Math.random() * 10}s`;
      container.appendChild(snowflake);
    }
  }

  function generateFlowers() {
    const container = document.getElementById('fallingFlowers');
    if (!container) return;
    for (let i = 0; i < 15; i++) {
      const flower = document.createElement('div');
      flower.className = 'flower';
      flower.style.left = `${Math.random() * 100}%`;
      flower.style.animationDuration = `${10 + Math.random() * 15}s`;
      flower.style.animationDelay = `${Math.random() * 15}s`;
      flower.style.width = `${20 + Math.random() * 15}px`;
      flower.style.height = `${20 + Math.random() * 15}px`;
      container.appendChild(flower);
    }
  }

  function setSeason(season) {
    const body = document.body;
    const seasonBtns = document.querySelectorAll('.season-btn');
    const sunRays = document.getElementById('sunRays');
    const fallingLeaves = document.getElementById('fallingLeaves');
    const snowflakes = document.getElementById('snowflakes');
    const fallingFlowers = document.getElementById('fallingFlowers');

    body.classList.remove('season-summer', 'season-autumn', 'season-winter', 'season-spring');
    seasonBtns.forEach(btn => btn.classList.remove('active'));

    sunRays?.classList.remove('active');
    fallingLeaves?.classList.remove('active');
    snowflakes?.classList.remove('active');
    fallingFlowers?.classList.remove('active');

    body.classList.add(`season-${season}`);

    seasonBtns.forEach(btn => {
      if (btn.dataset.season === season) btn.classList.add('active');
    });

    switch (season) {
      case 'summer': sunRays?.classList.add('active'); break;
      case 'autumn': fallingLeaves?.classList.add('active'); break;
      case 'winter': snowflakes?.classList.add('active'); break;
      case 'spring': fallingFlowers?.classList.add('active'); break;
    }
  }

  function autoDetectSeason() {
    const month = new Date().getMonth();
    if (month >= 5 && month <= 7) setSeason('summer');
    else if (month >= 8 && month <= 10) setSeason('autumn');
    else if (month >= 11 || month <= 1) setSeason('winter');
    else setSeason('spring');
  }

  function renderBalance(payload) {
    // try multiple possible field names
    const balance = payload?.balance ?? payload?.usdt_balance ?? payload?.amount ?? null;
    const el = $('balanceValue') || $('balanceAmount') || $('balanceText');
    if (!el) return;
    if (balance === null || balance === undefined) return;
    el.textContent = String(balance);
  }

  function renderTx(payload) {
    const items = payload?.transactions ?? payload?.data ?? payload?.items ?? [];
    const listEl = $('txList');
    const emptyEl = $('txEmpty');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!items || items.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    items.forEach(tx => {
      const row = document.createElement('div');
      row.className = 'tx-item';
      row.innerHTML = `
        <div><b>${escapeHtml(tx.type || tx.action || '')}</b></div>
        <div>${escapeHtml(String(tx.amount ?? tx.value ?? ''))} ${escapeHtml(tx.currency || '')}</div>
        <div class="muted">${escapeHtml(tx.details || tx.status || tx.id || '')}</div>
      `;
      listEl.appendChild(row);
    });
  }

  function attachWebAppHandlers() {
    const app = tgApp();
    if (!app) return;

    // Primary (recommended)
    try {
      app.onEvent('webapp_data', (event) => {
        if (!event || !event.data) return;
        let parsed;
        try { parsed = JSON.parse(event.data); } catch { return; }

        handleBackendMessage(parsed);
      });
      return;
    } catch {}

    // Fallback
    try {
      app.onEvent('message', (event) => {
        if (!event || !event.data) return;
        let parsed;
        try { parsed = JSON.parse(event.data); } catch { return; }

        handleBackendMessage(parsed);
      });
    } catch {}
  }

  function handleBackendMessage(msg) {
    // Expected formats (we try to be flexible):
    // { action: 'get_market', items: [...] }
    // { type: 'get_my_nfts', nfts: [...] }
    // { action: 'get_balance', balance: ... }
    const action = msg?.action ?? msg?.type ?? msg?.request_action ?? null;

    if (action === ACTION.GET_BALANCE) {
      renderBalance(msg);
      return;
    }
    if (action === ACTION.GET_MARKET) {
      const items = msg?.items ?? msg?.listings ?? msg?.market ?? [];
      window._buyUI?.renderMarket(items);
      return;
    }
    if (action === ACTION.GET_MY_NFTS) {
      const items = msg?.items ?? msg?.nfts ?? msg?.inventory ?? [];
      window._sellUI?.renderInventory(items);
      return;
    }
    if (action === ACTION.GET_MY_TX || action === ACTION.GET_TRANSACTIONS) {
      renderTx(msg);
      return;
    }

    // Some backends may wrap: { result: { action: 'get_market', ... } }
    if (!action && msg?.result) {
      handleBackendMessage(msg.result);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Attach handlers first, so we don't miss responses.
    attachWebAppHandlers();

    initRules();
    initMenu();
    initProfileTabs();
    initSell();
    initBuy();
    initWithdraw();

    setupSeasonalEffects();
    autoDetectSeason();

    setScreen('rules');

    // Load balance early
    try { tgSend({ action: ACTION.GET_BALANCE }); } catch {}
  });
})();
