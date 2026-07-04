(() => {
  const $ = s => document.getElementById(s);
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const price = (v,c) => (Number(v)||0).toFixed(2)+' '+(c||'USDT');

  // === Telegram ===
  const tg = () => window.Telegram?.WebApp || null;
  const tgUser = () => { try { return tg()?.initDataUnsafe?.user || null; } catch { return null; } };
  function tgSend(d) {
    const app = tg();
    if (!app) return;
    try { app.sendData(typeof d === 'string' ? d : JSON.stringify(d)); } catch {}
  }

  // === Screens ===
  function show(id) {
    document.querySelectorAll('.scr').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
  }

  // === Profile from Telegram ===
  function loadProfile() {
    const u = tgUser();
    if (!u) {
      $('pName').textContent = 'Пользователь';
      $('pUser').textContent = '—';
      $('pId').textContent = '—';
      return;
    }
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    $('pName').textContent = name || 'Пользователь';
    $('pUser').textContent = u.username ? '@'+u.username : '—';
    $('pId').textContent = u.id;

    const av = $('av');
    if (u.photo_url) {
      av.innerHTML = '<img src="'+esc(u.photo_url)+'" alt="">';
    } else {
      av.innerHTML = (u.first_name||'?')[0].toUpperCase();
    }
  }

  // === Init ===
  document.addEventListener('DOMContentLoaded', () => {
    const app = tg();
    if (app) { try { app.expand(); } catch {} try { app.ready(); } catch {} }

    loadProfile();
    initBg();
    initRules();
    initMenu();
    initTabs();
    initSell();
    initBuy();
    initWithdraw();
    show('scrRules');
  });

  // === Rules ===
  function initRules() {
    const cb = $('cbRules'), btn = $('btnRules');
    btn.disabled = !cb.checked;
    cb.onchange = () => { btn.disabled = !cb.checked; };
    btn.onclick = () => {
      try { localStorage.setItem('bb_rules','1'); } catch {}
      show('scrMenu');
      tgSend({action:'accept_rules'});
    };
    try { if (localStorage.getItem('bb_rules')==='1') show('scrMenu'); } catch {}
  }

  // === Menu ===
  function initMenu() {
    document.querySelectorAll('[data-go]').forEach(b => {
      b.onclick = () => {
        const g = b.dataset.go;
        show('scr'+g.charAt(0).toUpperCase()+g.slice(1));
        if (g==='sell') tgSend({action:'get_my_nfts'});
        if (g==='buy') tgSend({action:'get_market'});
        if (g==='profile') { loadProfile(); tgSend({action:'get_balance'}); tgSend({action:'get_my_nfts'}); }
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => show('scr'+b.dataset.back.charAt(0).toUpperCase()+b.dataset.back.slice(1));
    });
  }

  // === Profile Tabs ===
  function initTabs() {
    document.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tabcont').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelector('.tabcont[data-tab="'+t.dataset.tab+'"]').classList.add('active');
        if (t.dataset.tab==='inv') tgSend({action:'get_my_nfts'});
        if (t.dataset.tab==='tx') tgSend({action:'get_transactions'});
        if (t.dataset.tab==='wd') tgSend({action:'get_balance'});
      };
    });
  }

  // === Sell ===
  let sellNftId = null;
  function initSell() {
    $('btnSell').onclick = () => {
      if (!sellNftId) return;
      const p = Number($('sellPrice').value);
      if (!p || p <= 0) { msg('msgSell','Введите сумму','wn'); return; }
      tgSend({action:'list_nft', nft_id:sellNftId, price:p, currency:'USDT'});
      msg('msgSell','Отправлено','ok');
    };

    window._onSellNfts = (items) => {
      const el = $('sellList'), em = $('sellEmpty');
      el.innerHTML = '';
      em.style.display = items.length ? 'none' : 'block';
      items.forEach(n => {
        const b = document.createElement('button');
        b.className = 'li'; b.type = 'button';
        b.innerHTML = '<div class="li-img"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="li-body"><div class="li-name">'+esc(n.name||'NFT')+'</div><div class="li-sub">'+esc(n.rarity||'')+'</div></div>';
        b.onclick = () => {
          el.querySelectorAll('.li').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
          sellNftId = n.id;
          $('sellSel').textContent = n.name || 'NFT';
          $('btnSell').disabled = false;
        };
        el.appendChild(b);
      });
    };
  }

  // === Buy ===
  let buyNft = null;
  function initBuy() {
    $('btnBuy').onclick = () => {
      if (!buyNft) return;
      tgSend({action:'create_purchase_request', nft_id:buyNft.id, offer_price:Number(buyNft.price), currency:buyNft.currency||'USDT'});
      msg('msgBuy','Заявка отправлена!','ok');
      setTimeout(() => { $('overlay').classList.remove('show'); }, 1500);
    };
    $('mClose').onclick = () => $('overlay').classList.remove('show');
    $('overlay').onclick = e => { if (e.target === $('overlay')) $('overlay').classList.remove('show'); };

    window._onMarket = (items) => {
      const el = $('marketList'), em = $('marketEmpty');
      el.innerHTML = '';
      em.style.display = items.length ? 'none' : 'block';
      items.forEach(n => {
        const c = document.createElement('button');
        c.className = 'mc'; c.type = 'button';
        c.innerHTML = '<div class="mc-img"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="mc-body"><div class="mc-name">'+esc(n.name||'NFT')+'</div><div class="mc-row"><span class="mc-lbl">Цена:</span><span class="mc-val">'+price(n.price,n.currency)+'</span></div><div class="mc-row"><span class="mc-lbl">Продавец:</span><span class="mc-val">'+esc(n.seller_name||'')+'</span></div></div>';
        c.onclick = () => {
          buyNft = n;
          $('mImg').src = n.image_url || '';
          $('mTitle').textContent = n.name || 'NFT';
          $('mPrice').textContent = price(n.price, n.currency);
          $('mSeller').textContent = n.seller_name || '';
          $('mRarity').textContent = (n.rarity||'COMMON').toUpperCase();
          $('mRarText').textContent = n.rarity || 'common';
          $('mLink').textContent = n.token_link || '—';
          $('msgBuy').textContent = '';
          $('overlay').classList.add('show');
          $('btnBuy').disabled = false;
        };
        el.appendChild(c);
      });
    };
  }

  // === Withdraw ===
  function initWithdraw() {
    $('btnWd').onclick = () => {
      const a = Number($('wdAmt').value||0), w = $('wdWallet').value||'';
      if (a < 1) { msg('msgWd','Минимум 1 USDT','wn'); return; }
      tgSend({action:'create_withdraw', amount:a, wallet_address:w||null});
      msg('msgWd','Заявка создана','ok');
    };
  }

  // === Profile NFTs ===
  window._onMyNfts = (items) => {
    const el = $('profInv'), em = $('profInvE');
    if (!el) return;
    el.innerHTML = '';
    em.style.display = items.length ? 'none' : 'block';
    items.forEach(n => {
      const d = document.createElement('div');
      d.className = 'li';
      d.innerHTML = '<div class="li-img"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="li-body"><div class="li-name">'+esc(n.name||'NFT')+'</div><div class="li-sub">'+(n.is_listed?'В продаже':'Не в продаже')+'</div></div>';
      el.appendChild(d);
    });
    // Also update sell inventory
    if (window._onSellNfts) window._onSellNfts(items);
  };

  // === Transactions ===
  window._onTx = (items) => {
    const el = $('txList'), em = $('txE');
    if (!el) return;
    el.innerHTML = '';
    em.style.display = items.length ? 'none' : 'block';
    items.forEach(tx => {
      const d = document.createElement('div');
      d.className = 'txi';
      const a = Number(tx.amount)||0;
      d.innerHTML = '<b>'+esc(tx.type||'—')+'</b><div class="amt">'+(a>=0?'+':'')+a.toFixed(2)+' '+esc(tx.currency||'USDT')+'</div><div class="det">'+esc(tx.details||tx.created_at||'')+'</div>';
      el.appendChild(d);
    });
  };

  // === Balance ===
  window._onBalance = (bal) => {
    $('balUsdt').textContent = (Number(bal)||0).toFixed(2);
  };

  // === Accept rules ===
  window._onAcceptRules = () => show('scrMenu');

  // === Backend handler ===
  function onData(msg) {
    const a = msg?.action;
    if (a==='get_balance') window._onBalance?.(msg.balance);
    if (a==='get_market') window._onMarket?.(msg.items||[]);
    if (a==='get_my_nfts') window._onMyNfts?.(msg.items||[]);
    if (a==='get_transactions') window._onTx?.(msg.items||[]);
    if (a==='accept_rules') window._onAcceptRules?.();
  }

  // Listen for bot messages
  const app = tg();
  if (app) {
    try {
      app.onEvent('webapp_data', e => { try { onData(JSON.parse(e.data)); } catch {} });
    } catch {}
  }

  // === Helpers ===
  function msg(id, text, type) { const e=$(id); if(!e)return; e.textContent=text||''; e.className='msg '+type; }

  // === Background Particles ===
  function initBg() {
    const c = $('bgCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    let w, h, pts = [];

    function resize() { w = c.width = innerWidth; h = c.height = innerHeight; }

    function make() {
      pts = [];
      const n = Math.floor(w * h / 18000);
      for (let i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.8 + 0.4,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          o: Math.random() * 0.4 + 0.08
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,136,204,' + p.o + ')';
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    resize();
    make();
    frame();
    addEventListener('resize', () => { resize(); make(); });
  }
})();
