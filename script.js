(function() {
    'use strict';

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
        userAvatar: null,
        balances: { USDT: 0, TON: 0, STARS: 0 },
        selectedNftForSell: null,
        selectedNftForBuy: null,
        isIdVisible: false,
        isRulesAccepted: false,
        debugMode: true
    };

    // ===== DEBUG LOG =====
    function debugLog(...args) {
        if (state.debugMode) {
            console.log('🐛 [NFT Market]:', ...args);
        }
    }

    // ===== TELEGRAM WEBAPP =====
    function getTgApp() {
        const app = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
        debugLog('Telegram WebApp:', app ? '✅ Доступен' : '❌ Не доступен');
        return app;
    }

    function sendToBackend(data) {
        const app = getTgApp();
        if (!app) {
            setStatus('rulesStatus', '❌ Запустите приложение через Telegram', 'danger');
            debugLog('❌ Нет WebApp');
            return false;
        }
        try {
            const jsonData = JSON.stringify(data);
            debugLog('📤 Отправка:', jsonData);
            app.sendData(jsonData);
            return true;
        } catch (e) {
            debugLog('❌ Ошибка отправки:', e);
            setStatus('rulesStatus', '❌ Ошибка связи: ' + e.message, 'danger');
            return false;
        }
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
        debugLog('📱 Показываем экран:', name);
        Object.values(screens).forEach(s => s && s.classList.remove('active'));
        if (screens[name]) {
            screens[name].classList.add('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== STATUS =====
    function setStatus(id, text, type) {
        const el = $(id);
        if (!el) {
            debugLog('⚠️ Элемент статуса не найден:', id);
            return;
        }
        el.textContent = text || '';
        el.className = 'status';
        if (type) el.classList.add(type);
        debugLog('📊 Статус [' + id + ']:', text, type || '');
    }

    // ===== BALANCE =====
    function updateBalance(data) {
        debugLog('💰 Обновление баланса:', data);
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
    }

    // ===== RULES =====
    function initRules() {
        const cb = $('rulesAcceptedCheckbox');
        const btn = $('btnAcceptRules');
        const statusEl = $('rulesStatus');

        if (!cb || !btn) {
            debugLog('❌ Элементы правил не найдены');
            return;
        }

        debugLog('✅ Правила инициализированы');

        cb.addEventListener('change', () => {
            btn.disabled = !cb.checked;
            setStatus('rulesStatus', '', '');
            debugLog('📋 Чекбокс:', cb.checked ? '✅' : '❌');
        });

        btn.addEventListener('click', () => {
            if (!cb.checked) {
                setStatus('rulesStatus', '⚠️ Примите условия', 'warning');
                return;
            }

            debugLog('📤 Отправка ACCEPT_RULES');
            setStatus('rulesStatus', '⏳ Обработка...', 'info');

            const success = sendToBackend({ 
                action: ACTIONS.ACCEPT_RULES,
                timestamp: Date.now()
            });

            if (!success) {
                setStatus('rulesStatus', '❌ Ошибка отправки', 'danger');
            } else {
                // Оптимистичный переход, если бот не отвечает
                setTimeout(() => {
                    if (!state.isRulesAccepted) {
                        debugLog('⚠️ Нет ответа от бота, переходим вручную');
                        state.isRulesAccepted = true;
                        showScreen('main');
                        requestBalance();
                        setStatus('rulesStatus', '✅ Правила приняты (вручную)', 'success');
                    }
                }, 3000);
            }
        });
    }

    // ===== MAIN MENU =====
    function initMenu() {
        debugLog('📋 Инициализация меню');

        $$('[data-go]').forEach(btn => {
            btn.addEventListener('click', () => {
                const go = btn.dataset.go;
                debugLog('🔘 Нажато меню:', go);
                if (go === 'sell') { showScreen('sell'); requestMyNfts(); }
                else if (go === 'buy') { showScreen('buy'); requestMarket(); }
                else if (go === 'profile') { showScreen('profile'); initProfile(); }
            });
        });

        $$('[data-back="main"]').forEach(btn => {
            btn.addEventListener('click', () => {
                debugLog('🔙 Назад в главное меню');
                showScreen('main');
                requestBalance();
            });
        });
    }

    // ===== SELL =====
    function initSell() {
        debugLog('📋 Инициализация продажи');

        const currencyBtns = $$('#screenSell .currency-option');
        const priceInput = $('sellPriceInput');
        const priceCurrency = $('sellPriceCurrency');
        const sellCurrency = $('sellCurrency');
        const btnList = $('btnListNft');
        const selectedEl = $('sellSelectedNft');

        // Currency selection
        currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.currency;
                if (sellCurrency) sellCurrency.value = val;
                if (priceCurrency) priceCurrency.textContent = val;
                updateSellButton();
                debugLog('💱 Выбрана валюта:', val);
            });
        });

        // Price input
        if (priceInput) {
            priceInput.addEventListener('input', updateSellButton);
        }

        // List button
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

                debugLog('📤 Листинг NFT:', state.selectedNftForSell.id, price, currency);
                setStatus('sellStatus', '⏳ Отправка...', 'info');
                sendToBackend({
                    action: ACTIONS.LIST_NFT,
                    nft_id: state.selectedNftForSell.id,
                    price: price,
                    currency: currency,
                    timestamp: Date.now()
                });
            });
        }

        window._sellUI = {
            renderInventory(items) {
                const list = $('sellInventory');
                const empty = $('sellInvEmpty');
                if (!list) {
                    debugLog('❌ sellInventory не найден');
                    return;
                }

                debugLog('📦 Рендер инвентаря, элементов:', items?.length || 0);
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
                        debugLog('🎯 Выбран NFT для продажи:', nft.name || nft.title);
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
        debugLog('📋 Инициализация покупки');

        const modal = $('nftModal');
        const btnConfirm = $('btnConfirmBuy');

        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                if (!state.selectedNftForBuy) {
                    setStatus('modalBuyStatus', '⚠️ Выберите NFT', 'warning');
                    return;
                }
                debugLog('📤 Заявка на покупку:', state.selectedNftForBuy.id);
                setStatus('modalBuyStatus', '⏳ Отправка заявки...', 'info');
                sendToBackend({
                    action: ACTIONS.CREATE_PURCHASE_REQUEST,
                    nft_id: state.selectedNftForBuy.id,
                    offer_price: state.selectedNftForBuy.price,
                    currency: state.selectedNftForBuy.currency || 'USDT',
                    timestamp: Date.now()
                });
            });
        }

        window._buyUI = {
            renderMarket(items) {
                const list = $('marketList');
                const empty = $('marketEmpty');
                if (!list) {
                    debugLog('❌ marketList не найден');
                    return;
                }

                debugLog('🏪 Рендер маркета, элементов:', items?.length || 0);
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
                        debugLog('🖼️ Открыт NFT:', nft.name || nft.title);
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
        debugLog('📋 Инициализация профиля');
        const user = getTgApp()?.initDataUnsafe?.user || {};
        state.userId = user.id || null;
        state.userName = user.first_name || user.username || 'Пользователь';
        state.userUsername = user.username ? '@' + user.username : '—';

        debugLog('👤 Пользователь:', state.userName, state.userUsername, 'ID:', state.userId);

        const avatarEl = $('profileAvatar');
        const nameEl = $('profileName');
        const usernameEl = $('profileUsername');
        const idEl = $('profileId');

        if (nameEl) nameEl.textContent = state.userName;
        if (usernameEl) usernameEl.textContent = state.userUsername || '—';
        if (idEl) idEl.textContent = state.isIdVisible ? state.userId || '—' : '••••••••';

        // Toggle ID
        const toggleBtn = $('btnToggleId');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                state.isIdVisible = !state.isIdVisible;
                if (idEl) idEl.textContent = state.isIdVisible ? state.userId || '—' : '••••••••';
                toggleBtn.innerHTML = state.isIdVisible ? 
                    '<i class="fa-solid fa-eye-slash"></i>' : 
                    '<i class="fa-solid fa-eye"></i>';
                debugLog('👁️ ID видимость:', state.isIdVisible);
            });
        }

        // Tabs
        const tabs = $$('[data-profile-tab]');
        const panes = $$('.tab-pane[data-tab]');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const name = tab.dataset.profileTab;
                panes.forEach(p => {
                    p.classList.toggle('hidden', p.dataset.tab !== name);
                });
                debugLog('📑 Таб профиля:', name);
                if (name === 'inventory') requestMyNfts();
                else if (name === 'tx') requestTransactions();
            });
        });

        requestMyNfts();
    }

    // ===== WITHDRAW =====
    function initWithdraw() {
        debugLog('📋 Инициализация вывода');

        const currencyBtns = $$('#screenProfile .currency-option');
        const withdrawCurrency = $('withdrawCurrency');

        currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (withdrawCurrency) withdrawCurrency.value = btn.dataset.currency;
                debugLog('💱 Валюта вывода:', btn.dataset.currency);
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

                debugLog('📤 Заявка на вывод:', currency, amount, wallet);
                setStatus('withdrawStatus', '⏳ Создание заявки...', 'info');
                sendToBackend({
                    action: ACTIONS.CREATE_WITHDRAW_REQUEST,
                    currency,
                    amount,
                    wallet_address: wallet || null,
                    timestamp: Date.now()
                });
            });
        }
    }

    // ===== REQUESTS =====
    function requestBalance() {
        debugLog('📤 Запрос баланса');
        sendToBackend({ action: ACTIONS.GET_BALANCE, timestamp: Date.now() });
    }

    function requestMyNfts() {
        debugLog('📤 Запрос моих NFT');
        sendToBackend({ action: ACTIONS.GET_MY_NFTS, timestamp: Date.now() });
    }

    function requestMarket() {
        debugLog('📤 Запрос маркета');
        sendToBackend({ action: ACTIONS.GET_MARKET, timestamp: Date.now() });
    }

    function requestTransactions() {
        debugLog('📤 Запрос транзакций');
        sendToBackend({ action: ACTIONS.GET_MY_TX, timestamp: Date.now() });
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
        if (!list) {
            debugLog('❌ txList не найден');
            return;
        }

        const items = data?.transactions || data?.items || data?.data || [];
        debugLog('📜 Транзакций:', items.length);
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
            el.innerHTML = `
                <div class="tx-item-left">
                    <span class="tx-item-type">${escapeHtml(tx.type || tx.action || 'Транзакция')}</span>
                    <span class="tx-item-date">${escapeHtml(tx.date || tx.time || tx.created_at || '')}</span>
                </div>
                <div class="tx-item-right">
                    <span class="tx-item-amount ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${amount} ${escapeHtml(tx.currency || '')}
                    </span>
                    <span class="tx-item-status">${escapeHtml(tx.status || tx.details || '')}</span>
                </div>
            `;
            list.appendChild(el);
        });
    }

    function renderProfileInventory(items) {
        const list = $('profileInventory');
        const empty = $('profileInvEmpty');
        if (!list) {
            debugLog('❌ profileInventory не найден');
            return;
        }

        debugLog('📦 Инвентарь профиля:', items?.length || 0);
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
        debugLog('📩 Получено от бота:', JSON.stringify(data, null, 2));

        if (!data || typeof data !== 'object') {
            debugLog('⚠️ Неверный формат данных');
            return;
        }

        // Проверяем вложенные структуры
        const payload = data.result || data.data || data;
        const action = data.action || data.type || payload?.action || payload?.type;

        debugLog('🎯 Действие:', action);

        // Если это ответ на accept_rules
        if (action === 'accept_nft_rules' || action === ACTIONS.ACCEPT_RULES) {
            state.isRulesAccepted = true;
            setStatus('rulesStatus', '✅ Правила приняты!', 'success');
            setTimeout(() => {
                showScreen('main');
                requestBalance();
            }, 500);
            return;
        }

        // Обработка других действий
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
                setStatus('modalBuyStatus', payload?.success ? '✅ Заявка отправлена!' : '❌ ' + (payload?.error || 'Ошибка'), payload?.success ? 'success' : 'danger');
                if (payload?.success) {
                    setTimeout(() => {
                        closeModal();
                        requestMarket();
                    }, 1500);
                }
                break;

            case ACTIONS.CREATE_WITHDRAW_REQUEST:
                setStatus('withdrawStatus', payload?.success ? '✅ Заявка создана!' : '❌ ' + (payload?.error || 'Ошибка'), payload?.success ? 'success' : 'danger');
                if (payload?.success) {
                    setTimeout(() => {
                        requestBalance();
                        const amountInput = $('withdrawAmountInput');
                        const walletInput = $('withdrawWalletInput');
                        if (amountInput) amountInput.value = '';
                        if (walletInput) walletInput.value = '';
                    }, 1000);
                }
                break;

            case ACTIONS.LIST_NFT:
                setStatus('sellStatus', payload?.success ? '✅ NFT выставлен на продажу!' : '❌ ' + (payload?.error || 'Ошибка'), payload?.success ? 'success' : 'danger');
                if (payload?.success) {
                    setTimeout(() => {
                        showScreen('main');
                        requestBalance();
                        requestMarket();
                    }, 1500);
                }
                break;

            default:
                // Если не распознали действие, пробуем обновить баланс
                if (payload?.usdt_balance !== undefined || payload?.balance) {
                    updateBalance(payload);
                }
                debugLog('⚠️ Неизвестное действие:', action);
                break;
        }
    }

    // ===== WEBAPP EVENTS =====
    function initWebApp() {
        const app = getTgApp();
        if (!app) {
            debugLog('⚠️ Не в Telegram WebApp, показываем демо-режим');
            // Демо-режим для тестирования
            setTimeout(() => {
                showScreen('rules');
            }, 500);
            return;
        }

        debugLog('📱 Telegram WebApp инициализирован');

        // Получаем данные пользователя
        const user = app.initDataUnsafe?.user || {};
        debugLog('👤 Пользователь:', user);

        // Основной обработчик
        try {
            app.onEvent('webapp_data', (event) => {
                debugLog('📨 webapp_data event:', event);
                if (event?.data) {
                    try {
                        const parsed = JSON.parse(event.data);
                        handleBackendMessage(parsed);
                    } catch (e) {
                        debugLog('❌ Ошибка парсинга webapp_data:', e);
                        // Пробуем как текст
                        try {
                            const parsed2 = JSON.parse(event.data.replace(/'/g, '"'));
                            handleBackendMessage(parsed2);
                        } catch (e2) {
                            debugLog('❌ Не удалось распарсить:', event.data);
                        }
                    }
                }
            });
        } catch (e) {
            debugLog('⚠️ webapp_data не поддерживается, пробуем message');
            try {
                app.onEvent('message', (event) => {
                    debugLog('📨 message event:', event);
                    if (event?.data) {
                        try {
                            const parsed = JSON.parse(event.data);
                            handleBackendMessage(parsed);
                        } catch (e) {
                            debugLog('❌ Ошибка парсинга message:', e);
                        }
                    }
                });
            } catch (e2) {
                debugLog('❌ Нет поддерживаемых событий');
            }
        }

        // Альтернативный метод - через метод setBackgroundColor
        try {
            // Настройка внешнего вида
            app.setBackgroundColor('#0F0F1F');
            app.setHeaderColor('#0F0F1F');
        } catch (e) {
            // Игнорируем
        }

        // Готово
        app.ready();
        debugLog('✅ WebApp готов');

        // Показываем правила сразу
        setTimeout(() => {
            showScreen('rules');
            // Запрашиваем баланс для фона
            setTimeout(requestBalance, 1000);
        }, 300);
    }

    // ===== SEASONAL EFFECTS =====
    function initSeasonal() {
        const seasons = ['summer', 'autumn', 'winter', 'spring'];
        const month = new Date().getMonth();
        let defaultSeason = 'summer';
        if (month >= 2 && month <= 4) defaultSeason = 'spring';
        else if (month >= 5 && month <= 7) defaultSeason = 'summer';
        else if (month >= 8 && month <= 10) defaultSeason = 'autumn';
        else defaultSeason = 'winter';

        debugLog('🌿 Сезон:', defaultSeason);

        // Generate elements
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

        Object.values(effects).forEach(id => {
            const el = $(id);
            if (el) el.classList.toggle('active', id === effects[season]);
        });

        debugLog('🌿 Установлен сезон:', season);
    }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 NFT Market v2.0 initialized');
        debugLog('📱 DOM загружен');

        // Показываем загрузку
        const rulesCard = document.querySelector('.rules-card');
        if (rulesCard) {
            // Добавляем индикатор загрузки
        }

        // Init WebApp
        initWebApp();

        // Init components
        initRules();
        initMenu();
        initSell();
        initBuy();
        initWithdraw();

        // Seasonal
        initSeasonal();

        // Если WebApp не доступен, показываем правила
        if (!getTgApp()) {
            debugLog('⚠️ Демо-режим: показываем правила');
            setTimeout(() => showScreen('rules'), 500);
        }

        debugLog('✅ Инициализация завершена');
    });

})();
