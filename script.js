(function() {
    'use strict';

    // ===== VERSION =====
    const APP_VERSION = '2.0.8';
    console.log('🚀 NFT Market v' + APP_VERSION);

    // ===== CONSTANTS =====
    const ACTIONS = {
        ACCEPT_RULES: 'accept_nft_rules',
        GET_BALANCE: 'get_balance',
        GET_MARKET: 'get_market',
        GET_MY_NFTS: 'get_my_nfts',
        GET_MY_TX: 'get_transactions',
        CREATE_PURCHASE_REQUEST: 'create_purchase_request',
        CREATE_WITHDRAW_REQUEST: 'create_withdrawal_request',
        LIST_NFT: 'list_nft'
    };

    // ===== DOM HELPERS =====
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ===== STATE =====
    const state = {
        userId: null,
        userName: null,
        userUsername: null,
        balances: { USDT: 0, TON: 0, STARS: 0 },
        selectedNftForSell: null,
        selectedNftForBuy: null,
        isIdVisible: false,
        isRulesAccepted: false,
        isTelegram: false
    };

    // ===== TELEGRAM WEBAPP =====
    function getTgApp() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                return window.Telegram.WebApp;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function sendToBackend(data) {
        const app = getTgApp();
        
        if (app) {
            try {
                const jsonData = JSON.stringify(data);
                app.sendData(jsonData);
                return true;
            } catch (e) {
                console.error('❌ Ошибка отправки:', e);
                return false;
            }
        }
        return false;
    }

    // ===== SCREEN MANAGEMENT =====
    const screens = {
        rules: $('screenRules'),
        main: $('screenMainMenu'),
        sell: $('screenSell'),
        buy: $('screenBuy'),
        profile: $('screenProfile')
    };

    function showScreen(name) {
        Object.values(screens).forEach(s => s && s.classList.remove('active'));
        if (screens[name]) {
            screens[name].classList.add('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== STATUS =====
    function setStatus(id, text, type) {
        const el = $(id);
        if (!el) return;
        el.textContent = text || '';
        el.className = 'status';
        if (type) el.classList.add(type);
    }

    // ===== BALANCE =====
    function updateBalance(data) {
        const bal = data?.balance || data || {};
        state.balances = {
            USDT: Number(bal.USDT ?? bal.usdt ?? bal.usdt_balance ?? 0),
            TON: Number(bal.TON ?? bal.ton ?? bal.ton_balance ?? 0),
            STARS: Number(bal.STARS ?? bal.stars ?? bal.stars_balance ?? 0)
        };

        ['balUsdt', 'balTon', 'balStars'].forEach(id => {
            const el = $(id);
            if (!el) return;
            const key = id.replace('bal', '').toUpperCase();
            el.textContent = (state.balances[key] || 0).toFixed(2);
        });

        ['withdrawBalUsdt', 'withdrawBalTon', 'withdrawBalStars'].forEach(id => {
            const el = $(id);
            if (!el) return;
            const key = id.replace('withdrawBal', '').toUpperCase();
            el.textContent = (state.balances[key] || 0).toFixed(2);
        });
    }

    // ===== RULES =====
    function initRules() {
        const cb = $('rulesAcceptedCheckbox');
        const btn = $('btnAcceptRules');

        if (!cb || !btn) return;

        const rulesAccepted = localStorage.getItem('nft_rules_accepted');
        if (rulesAccepted === 'true') {
            state.isRulesAccepted = true;
            cb.checked = true;
            btn.disabled = false;
            // Сразу переходим в главное меню без статусов
            showScreen('main');
            requestBalance();
            requestMyNfts();
            requestMarket();
            return;
        }

        cb.addEventListener('change', () => {
            btn.disabled = !cb.checked;
        });

        btn.addEventListener('click', () => {
            if (!cb.checked) {
                setStatus('rulesStatus', '⚠️ Примите условия', 'warning');
                return;
            }

            // Сохраняем в localStorage
            localStorage.setItem('nft_rules_accepted', 'true');
            state.isRulesAccepted = true;
            
            // Отправляем в бот (в фоне)
            sendToBackend({ action: ACTIONS.ACCEPT_RULES });
            
            // Сразу переходим в главное меню - без ожидания!
            showScreen('main');
            requestBalance();
            requestMyNfts();
            requestMarket();
            
            // Просто показываем успех без задержек
            setStatus('rulesStatus', '✅ Правила приняты!', 'success');
        });
    }

    // ===== MAIN MENU =====
    function initMenu() {
        $$('[data-go]').forEach(btn => {
            btn.addEventListener('click', () => {
                const go = btn.dataset.go;
                if (go === 'sell') { showScreen('sell'); requestMyNfts(); }
                else if (go === 'buy') { showScreen('buy'); requestMarket(); }
                else if (go === 'profile') { showScreen('profile'); initProfile(); }
            });
        });

        $$('[data-back="main"]').forEach(btn => {
            btn.addEventListener('click', () => {
                showScreen('main');
                requestBalance();
            });
        });
    }

    // ===== SELL =====
    function initSell() {
        const currencyBtns = $$('#screenSell .currency-option');
        const priceInput = $('sellPriceInput');
        const priceCurrency = $('sellPriceCurrency');
        const sellCurrency = $('sellCurrency');
        const btnList = $('btnListNft');

        currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.currency;
                if (sellCurrency) sellCurrency.value = val;
                if (priceCurrency) priceCurrency.textContent = val;
                updateSellButton();
            });
        });

        if (priceInput) {
            priceInput.addEventListener('input', updateSellButton);
        }

        if (btnList) {
            btnList.addEventListener('click', () => {
                if (!state.selectedNftForSell) {
                    setStatus('sellStatus', '⚠️ Выберите NFT', 'warning');
                    return;
                }
                const price = parseFloat(priceInput?.value || 0);
                const currency = sellCurrency?.value || 'USDT';

                if (!price || price <= 0) {
                    setStatus('sellStatus', '⚠️ Введите сумму больше 0', 'warning');
                    return;
                }

                setStatus('sellStatus', '⏳ Отправка...', 'info');
                sendToBackend({
                    action: ACTIONS.LIST_NFT,
                    nft_id: state.selectedNftForSell.id,
                    price: price,
                    currency: currency
                });
            });
        }

        window._sellUI = {
            renderInventory(items) {
                const list = $('sellInventory');
                const empty = $('sellInvEmpty');
                if (!list) return;

                list.innerHTML = '';

                if (!items || items.length === 0) {
                    if (empty) {
                        empty.style.display = 'flex';
                        empty.innerHTML = `
                            <i class="fa-solid fa-box-open"></i>
                            <p>Предметов пока нет</p>
                            <span class="empty-hint">Пополните через админа: @ggyyert</span>
                        `;
                    }
                    return;
                }
                if (empty) empty.style.display = 'none';

                items.forEach(nft => {
                    const el = document.createElement('button');
                    el.className = 'inventory-item';
                    el.type = 'button';
                    const imgUrl = nft.image_url || nft.imageUrl || nft.image || '';
                    el.innerHTML = `
                        <div class="inventory-item-image">
                            ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="">` : '<i class="fa-solid fa-image" style="font-size:24px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;height:100%;"></i>'}
                        </div>
                        <div class="inventory-item-info">
                            <span class="inventory-item-name">${escapeHtml(nft.name || nft.title || 'NFT')}</span>
                            <span class="inventory-item-rarity">${escapeHtml(nft.rarity || '')}</span>
                        </div>
                    `;
                    el.addEventListener('click', () => {
                        $$('#sellInventory .inventory-item').forEach(e => e.classList.remove('selected'));
                        el.classList.add('selected');
                        state.selectedNftForSell = nft;
                        const nameEl = $('sellSelectedNft');
                        if (nameEl) {
                            nameEl.innerHTML = `<span class="nft-name">${escapeHtml(nft.name || nft.title || 'NFT')}</span>`;
                        }
                        updateSellButton();
                        setStatus('sellStatus', '', '');
                    });
                    list.appendChild(el);
                });
            }
        };
    }

    function updateSellButton() {
        const btn = $('btnListNft');
        const price = parseFloat($('sellPriceInput')?.value || 0);
        const hasNft = !!state.selectedNftForSell;
        if (btn) {
            btn.disabled = !(hasNft && price > 0);
        }
    }

    // ===== BUY =====
    function initBuy() {
        const modal = $('nftModal');
        const btnConfirm = $('btnConfirmBuy');

        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                if (!state.selectedNftForBuy) {
                    setStatus('modalBuyStatus', '⚠️ Выберите NFT', 'warning');
                    return;
                }
                setStatus('modalBuyStatus', '⏳ Отправка заявки...', 'info');
                sendToBackend({
                    action: ACTIONS.CREATE_PURCHASE_REQUEST,
                    nft_id: state.selectedNftForBuy.id,
                    offer_price: state.selectedNftForBuy.price,
                    currency: state.selectedNftForBuy.currency || 'USDT'
                });
            });
        }

        window._buyUI = {
            renderMarket(items) {
                const list = $('marketList');
                const empty = $('marketEmpty');
                if (!list) return;

                list.innerHTML = '';

                if (!items || items.length === 0) {
                    if (empty) {
                        empty.style.display = 'flex';
                        empty.innerHTML = `
                            <i class="fa-solid fa-store-slash"></i>
                            <p>Пока нет доступных NFT</p>
                            <span class="empty-hint">Загляните позже!</span>
                        `;
                    }
                    return;
                }
                if (empty) empty.style.display = 'none';

                items.forEach(nft => {
                    const card = document.createElement('button');
                    card.className = 'market-card';
                    card.type = 'button';
                    const imgUrl = nft.image_url || nft.imageUrl || nft.image || '';
                    card.innerHTML = `
                        <div class="market-card-image">
                            ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;color:var(--text-muted);"><i class="fa-solid fa-image"></i></div>'}
                        </div>
                        <div class="market-card-body">
                            <span class="market-card-title">${escapeHtml(nft.name || nft.title || 'NFT')}</span>
                            <div class="market-card-meta">
                                <div class="meta-row">
                                    <span class="meta-label">Цена</span>
                                    <span class="meta-value">${escapeHtml(nft.price)} ${escapeHtml(nft.currency || 'USDT')}</span>
                                </div>
                                <div class="meta-row">
                                    <span class="meta-label">Продавец</span>
                                    <span class="meta-value">${escapeHtml(nft.owner_username || 'ID: ' + (nft.owner_id || '—'))}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    card.addEventListener('click', () => {
                        state.selectedNftForBuy = nft;
                        openModal(nft);
                    });
                    list.appendChild(card);
                });
            }
        };
    }

    function openModal(nft) {
        const modal = $('nftModal');
        if (!modal) return;

        const imgUrl = nft.image_url || nft.imageUrl || nft.image || '';
        $('modalImage').src = imgUrl || '';
        $('modalTitle').textContent = nft.name || nft.title || 'NFT';
        $('modalPrice').textContent = `${nft.price} ${nft.currency || 'USDT'}`;
        $('modalOwner').innerHTML = `<i class="fa-solid fa-user"></i> ${escapeHtml(nft.owner_username || 'ID: ' + (nft.owner_id || '—'))}`;
        $('modalDescription').textContent = nft.rarity || '—';
        $('modalTokenLink').textContent = nft.token_link || nft.tokenLink || '—';
        $('modalRarity').textContent = nft.rarity || '—';
        $('btnConfirmBuy').disabled = false;
        setStatus('modalBuyStatus', '', '');

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    window.closeModal = function() {
        const modal = $('nftModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // ===== PROFILE =====
    function initProfile() {
        const app = getTgApp();
        
        // Пробуем получить данные разными способами
        let user = {};
        if (app) {
            // Способ 1: через initDataUnsafe
            if (app.initDataUnsafe && app.initDataUnsafe.user) {
                user = app.initDataUnsafe.user;
                console.log('👤 Данные из initDataUnsafe:', user);
            }
            // Способ 2: через WebApp.User
            else if (app.User) {
                user = app.User;
                console.log('👤 Данные из WebApp.User:', user);
            }
        }
        
        // Если данных нет, пробуем получить из URL
        if (!user.id) {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const userData = urlParams.get('user');
                if (userData) {
                    const parsed = JSON.parse(decodeURIComponent(userData));
                    if (parsed && parsed.id) {
                        user = parsed;
                        console.log('👤 Данные из URL:', user);
                    }
                }
            } catch (e) {
                console.warn('Не удалось получить данные из URL');
            }
        }
        
        state.userId = user.id || null;
        state.userName = user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;
        state.userUsername = user.username ? '@' + user.username : null;
        
        console.log('👤 Итоговые данные пользователя:', {
            id: state.userId,
            name: state.userName,
            username: state.userUsername
        });

        const nameEl = $('profileName');
        const usernameEl = $('profileUsername');
        const idEl = $('profileId');

        if (nameEl) nameEl.textContent = state.userName || '—';
        if (usernameEl) usernameEl.textContent = state.userUsername || '—';
        if (idEl) idEl.textContent = state.isIdVisible ? (state.userId || '—') : '••••••••';

        const toggleBtn = $('btnToggleId');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                state.isIdVisible = !state.isIdVisible;
                if (idEl) idEl.textContent = state.isIdVisible ? (state.userId || '—') : '••••••••';
                toggleBtn.innerHTML = state.isIdVisible ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            });
        }

        const tabs = $$('[data-profile-tab]');
        const panes = $$('.tab-pane[data-tab]');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const name = tab.dataset.profileTab;
                panes.forEach(p => p.classList.toggle('hidden', p.dataset.tab !== name));
                if (name === 'inventory') requestMyNfts();
                else if (name === 'tx') requestTransactions();
            });
        });

        requestMyNfts();
    }

    // ===== WITHDRAW =====
    function initWithdraw() {
        const currencyBtns = $$('#screenProfile .currency-option');
        const withdrawCurrency = $('withdrawCurrency');

        currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (withdrawCurrency) withdrawCurrency.value = btn.dataset.currency;
            });
        });

        const btn = $('btnCreateWithdraw');
        if (btn) {
            btn.addEventListener('click', () => {
                const currency = withdrawCurrency?.value || 'USDT';
                const amount = parseFloat($('withdrawAmountInput')?.value || 0);
                const wallet = $('withdrawWalletInput')?.value || '';

                if (!amount || amount <= 0) {
                    setStatus('withdrawStatus', '⚠️ Введите сумму больше 0', 'warning');
                    return;
                }

                if ((state.balances[currency] || 0) < amount) {
                    setStatus('withdrawStatus', `⚠️ Недостаточно ${currency} на балансе`, 'warning');
                    return;
                }

                if (!wallet || wallet.trim().length < 5) {
                    setStatus('withdrawStatus', '⚠️ Введите адрес кошелька', 'warning');
                    return;
                }

                setStatus('withdrawStatus', '⏳ Создание заявки...', 'info');
                sendToBackend({
                    action: ACTIONS.CREATE_WITHDRAW_REQUEST,
                    currency: currency,
                    amount: amount,
                    wallet_address: wallet.trim()
                });
            });
        }
    }

    // ===== REQUESTS =====
    function requestBalance() {
        sendToBackend({ action: ACTIONS.GET_BALANCE });
    }

    function requestMyNfts() {
        sendToBackend({ action: ACTIONS.GET_MY_NFTS });
    }

    function requestMarket() {
        sendToBackend({ action: ACTIONS.GET_MARKET });
    }

    function requestTransactions() {
        sendToBackend({ action: ACTIONS.GET_MY_TX });
    }

    // ===== RENDER HELPERS =====
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderTransactions(data) {
        const list = $('txList');
        const empty = $('txEmpty');
        if (!list) return;

        const items = data?.transactions || data?.items || data?.data || [];
        list.innerHTML = '';

        if (!items || items.length === 0) {
            if (empty) {
                empty.style.display = 'flex';
                empty.innerHTML = `
                    <i class="fa-solid fa-receipt"></i>
                    <p>История пуста</p>
                    <span class="empty-hint">Здесь будут отображаться ваши транзакции</span>
                `;
            }
            return;
        }
        if (empty) empty.style.display = 'none';

        items.forEach(tx => {
            const el = document.createElement('div');
            el.className = 'tx-item';
            const amount = tx.amount ?? tx.value ?? 0;
            const isPositive = amount > 0;
            const statusMap = {
                'pending': '⏳ Ожидает',
                'completed': '✅ Завершено',
                'cancelled': '❌ Отменено',
                'processing': '🔄 В обработке'
            };
            const statusText = statusMap[tx.status] || tx.status || tx.details || '';
            
            el.innerHTML = `
                <div class="tx-item-left">
                    <span class="tx-item-type">${escapeHtml(tx.type || tx.action || 'Транзакция')}</span>
                    <span class="tx-item-date">${escapeHtml(tx.date || tx.time || tx.created_at || '')}</span>
                </div>
                <div class="tx-item-right">
                    <span class="tx-item-amount ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${amount} ${escapeHtml(tx.currency || '')}
                    </span>
                    <span class="tx-item-status">${escapeHtml(statusText)}</span>
                </div>
            `;
            list.appendChild(el);
        });
    }

    function renderProfileInventory(items) {
        const list = $('profileInventory');
        const empty = $('profileInvEmpty');
        if (!list) return;

        list.innerHTML = '';

        if (!items || items.length === 0) {
            if (empty) {
                empty.style.display = 'flex';
                empty.innerHTML = `
                    <i class="fa-solid fa-box-open"></i>
                    <p>Предметов пока нет</p>
                    <span class="empty-hint">Пополните через админа: @ggyyert</span>
                `;
            }
            return;
        }
        if (empty) empty.style.display = 'none';

        items.forEach(nft => {
            const el = document.createElement('div');
            el.className = 'inventory-item';
            const imgUrl = nft.image_url || nft.imageUrl || nft.image || '';
            el.innerHTML = `
                <div class="inventory-item-image">
                    ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="">` : '<i class="fa-solid fa-image" style="font-size:24px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;height:100%;"></i>'}
                </div>
                <div class="inventory-item-info">
                    <span class="inventory-item-name">${escapeHtml(nft.name || nft.title || 'NFT')}</span>
                    <span class="inventory-item-rarity">${escapeHtml(nft.rarity || '')}</span>
                </div>
            `;
            list.appendChild(el);
        });
    }

    // ===== HANDLE BACKEND MESSAGES =====
    function handleBackendMessage(data) {
        console.log('📩 Получено от бота:', data);

        if (!data || typeof data !== 'object') return;

        const payload = data.result || data.data || data;
        const action = data.action || data.type || payload?.action || payload?.type;

        switch (action) {
            case ACTIONS.GET_BALANCE:
                updateBalance(payload.balance || payload);
                break;

            case ACTIONS.GET_MARKET:
                const marketItems = payload?.items || payload?.listings || payload?.market || [];
                window._buyUI?.renderMarket(marketItems);
                break;

            case ACTIONS.GET_MY_NFTS:
                const nftItems = payload?.items || payload?.nfts || payload?.inventory || [];
                window._sellUI?.renderInventory(nftItems);
                renderProfileInventory(nftItems);
                break;

            case ACTIONS.GET_MY_TX:
                renderTransactions(payload);
                break;

            case ACTIONS.CREATE_PURCHASE_REQUEST:
                if (payload?.success !== false) {
                    setStatus('modalBuyStatus', '✅ Заявка на покупку отправлена! Напишите админу @ggyyert', 'success');
                    setTimeout(() => {
                        closeModal();
                        requestMarket();
                    }, 2000);
                } else {
                    setStatus('modalBuyStatus', '❌ ' + (payload?.error || 'Ошибка создания заявки'), 'danger');
                }
                break;

            case ACTIONS.CREATE_WITHDRAW_REQUEST:
                if (payload?.success !== false) {
                    setStatus('withdrawStatus', '✅ Заявка на вывод создана! Напишите админу @ggyyert', 'success');
                    setTimeout(() => {
                        requestBalance();
                        const amountInput = $('withdrawAmountInput');
                        const walletInput = $('withdrawWalletInput');
                        if (amountInput) amountInput.value = '';
                        if (walletInput) walletInput.value = '';
                    }, 2000);
                } else {
                    setStatus('withdrawStatus', '❌ ' + (payload?.error || 'Ошибка создания заявки'), 'danger');
                }
                break;

            case ACTIONS.LIST_NFT:
                if (payload?.success !== false) {
                    setStatus('sellStatus', '✅ NFT выставлен на продажу!', 'success');
                    setTimeout(() => {
                        showScreen('main');
                        requestBalance();
                        requestMarket();
                    }, 1500);
                } else {
                    setStatus('sellStatus', '❌ ' + (payload?.error || 'Ошибка выставления NFT'), 'danger');
                }
                break;

            default:
                if (payload?.usdt_balance !== undefined || payload?.balance) {
                    updateBalance(payload);
                }
                break;
        }
    }

    // ===== WEBAPP EVENTS =====
    function initWebApp() {
        const app = getTgApp();
        
        if (app) {
            console.log('✅ Telegram WebApp найден');
            state.isTelegram = true;
            
            try {
                app.onEvent('webapp_data', (event) => {
                    if (event?.data) {
                        try {
                            const parsed = JSON.parse(event.data);
                            handleBackendMessage(parsed);
                        } catch (e) {
                            console.warn('Ошибка парсинга:', e);
                        }
                    }
                });
            } catch (e) {
                console.warn('webapp_data не поддерживается');
            }

            try {
                app.ready();
                app.setBackgroundColor('#0F0F1F');
                app.setHeaderColor('#0F0F1F');
                app.expand();
            } catch (e) {}

            // Логируем все данные для отладки
            console.log('📱 initDataUnsafe:', app.initDataUnsafe);
            console.log('📱 WebApp:', app);
            
        } else {
            console.log('⚠️ Telegram WebApp не найден');
            state.isTelegram = false;
        }

        // Показываем нужный экран
        setTimeout(() => {
            const rulesAccepted = localStorage.getItem('nft_rules_accepted');
            if (rulesAccepted === 'true') {
                state.isRulesAccepted = true;
                showScreen('main');
                requestBalance();
                requestMyNfts();
                requestMarket();
            } else {
                showScreen('rules');
            }
        }, 300);
    }

    // ===== SEASONAL EFFECTS =====
    function initSeasonal() {
        const month = new Date().getMonth();
        let defaultSeason = 'summer';
        if (month >= 2 && month <= 4) defaultSeason = 'spring';
        else if (month >= 5 && month <= 7) defaultSeason = 'summer';
        else if (month >= 8 && month <= 10) defaultSeason = 'autumn';
        else defaultSeason = 'winter';

        const leafContainer = $('fallingLeaves');
        if (leafContainer) {
            for (let i = 0; i < 20; i++) {
                const leaf = document.createElement('div');
                leaf.className = 'leaf';
                leaf.style.left = Math.random() * 100 + '%';
                leaf.style.animationDuration = (8 + Math.random() * 10) + 's';
                leaf.style.animationDelay = (Math.random() * 10) + 's';
                leafContainer.appendChild(leaf);
            }
        }

        const snowContainer = $('snowflakes');
        if (snowContainer) {
            for (let i = 0; i < 40; i++) {
                const snow = document.createElement('div');
                snow.className = 'snowflake';
                snow.style.left = Math.random() * 100 + '%';
                snow.style.animationDuration = (5 + Math.random() * 8) + 's';
                snow.style.animationDelay = (Math.random() * 8) + 's';
                snowContainer.appendChild(snow);
            }
        }

        const flowerContainer = $('fallingFlowers');
        if (flowerContainer) {
            for (let i = 0; i < 15; i++) {
                const flower = document.createElement('div');
                flower.className = 'flower';
                flower.style.left = Math.random() * 100 + '%';
                flower.style.animationDuration = (10 + Math.random() * 12) + 's';
                flower.style.animationDelay = (Math.random() * 12) + 's';
                flowerContainer.appendChild(flower);
            }
        }

        setSeason(defaultSeason);

        $$('.season-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setSeason(btn.dataset.season);
            });
        });
    }

    function setSeason(season) {
        const body = document.body;
        const effects = {
            summer: 'sunRays',
            autumn: 'fallingLeaves',
            winter: 'snowflakes',
            spring: 'fallingFlowers'
        };

        body.className = body.className
            .split(' ')
            .filter(c => !c.startsWith('season-'))
            .join(' ');
        body.classList.add('season-' + season);

        $$('.season-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.season === season);
        });

        Object.keys(effects).forEach(key => {
            const el = $(effects[key]);
            if (el) {
                el.classList.toggle('active', key === season);
            }
        });
    }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 NFT Market v' + APP_VERSION + ' запущен');
        console.log('📱 User Agent:', navigator.userAgent);

        initWebApp();
        initRules();
        initMenu();
        initSell();
        initBuy();
        initWithdraw();
        initSeasonal();
    });

})();
