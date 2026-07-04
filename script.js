(() => {
  const $ = s => document.getElementById(s);
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fp = (v,c) => (Number(v)||0).toFixed(2)+' '+(c||'');
  const FEE = 0.05;

  const tg = () => { try { return window.Telegram?.WebApp || null; } catch { return null; } };
  function send(d) { const a=tg(); if(!a)return; try{a.sendData(typeof d==='string'?d:JSON.stringify(d));}catch{} }

  function show(id) {
    document.querySelectorAll('.scr').forEach(s => s.classList.remove('act'));
    const el=$(id); if(el) el.classList.add('act');
    window.scrollTo(0,0);
  }
  function msg(id,t,k) { const e=$(id); if(!e)return; e.textContent=t||''; e.className='ms'; if(k)e.classList.add(k); }

  // === User data — parse from initData (works via menu button) ===
  function parseUser() {
    const app = tg();
    if (!app) return null;
    // Method 1: initDataUnsafe
    try { if (app.initDataUnsafe && app.initDataUnsafe.user) return app.initDataUnsafe.user; } catch {}
    // Method 2: parse initData URL params
    try {
      if (app.initData) {
        const p = new URLSearchParams(app.initData);
        const u = p.get('user');
        if (u) return JSON.parse(u);
      }
    } catch {}
    return null;
  }

  let idVisible = false;
  let sellNft = null;
  let sellCurrency = null;

  function loadProfile() {
    const u = parseUser();
    const av = $('av');
    if (u) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
      $('pNm').textContent = name || 'Пользователь';
      $('pUs').textContent = u.username ? '@'+u.username : 'Без username';
      $('pId').textContent = String(u.id);
      if (u.photo_url) {
        av.innerHTML = '<img src="'+esc(u.photo_url)+'" alt="">';
      } else {
        av.textContent = (u.first_name||'?')[0].toUpperCase();
      }
    } else {
      $('pNm').textContent = 'Пользователь';
      $('pUs').textContent = 'Откройте через Telegram';
      $('pId').textContent = '—';
      av.textContent = '?';
    }
  }

  function toggleId() {
    idVisible = !idVisible;
    $('pId').classList.toggle('show', idVisible);
    $('btnToggleId').textContent = idVisible ? 'Скрыть' : 'Показать';
  }

  // === Init ===
  document.addEventListener('DOMContentLoaded', () => {
    const app = tg();
    if (app) { try{app.expand();}catch{} try{app.ready();}catch{} }

    setTimeout(loadProfile, 200);

    initBg();
    initRules();
    initMenu();
    initTabs();
    initSell();
    initBuy();
    initWithdraw();

    $('btnToggleId').onclick = toggleId;
    show('scrRules');
  });

  // === Rules ===
  function initRules() {
    const cb=$('cbR'), btn=$('btnR');
    btn.disabled=!cb.checked;
    cb.onchange=()=>{btn.disabled=!cb.checked;};
    btn.onclick=()=>{
      try{localStorage.setItem('bb_r','1');}catch{}
      show('scrMenu');
      send({action:'accept_rules'});
    };
    try{if(localStorage.getItem('bb_r')==='1')show('scrMenu');}catch{}
  }

  // === Menu ===
  function initMenu() {
    document.querySelectorAll('[data-go]').forEach(b=>{
      b.onclick=()=>{
        const g=b.dataset.go;
        show('scr'+g[0].toUpperCase()+g.slice(1));
        if(g==='sell'){resetSell();send({action:'get_my_nfts'});}
        if(g==='buy') send({action:'get_market'});
        if(g==='profile'){loadProfile();send({action:'get_balance'});send({action:'get_my_nfts'});}
      };
    });
    document.querySelectorAll('[data-back]').forEach(b=>{
      b.onclick=()=>show('scr'+b.dataset.back[0].toUpperCase()+b.dataset.back.slice(1));
    });
  }

  // === Tabs ===
  function initTabs() {
    document.querySelectorAll('.tab').forEach(t=>{
      t.onclick=()=>{
        document.querySelectorAll('.tab').forEach(x=>x.classList.remove('act'));
        document.querySelectorAll('.tc').forEach(x=>x.classList.remove('act'));
        t.classList.add('act');
        const sec=document.querySelector('.tc[data-tab="'+t.dataset.tab+'"]');
        if(sec) sec.classList.add('act');
        if(t.dataset.tab==='inv') send({action:'get_my_nfts'});
        if(t.dataset.tab==='tx') send({action:'get_transactions'});
        if(t.dataset.tab==='wd') send({action:'get_balance'});
      };
    });
  }

  // === Sell (step by step) ===
  function resetSell() {
    sellNft = null;
    sellCurrency = null;
    $('step1').classList.remove('done');
    $('step2').classList.add('locked');
    $('step3').classList.add('locked');
    $('sellS').textContent = '—';
    $('sellP').value = '';
    document.querySelectorAll('.curbtn').forEach(b=>b.classList.remove('sel'));
    msg('msgSell','','');
  }

  function initSell() {
    // Currency selection
    document.querySelectorAll('.curbtn').forEach(btn=>{
      btn.onclick=()=>{
        document.querySelectorAll('.curbtn').forEach(b=>b.classList.remove('sel'));
        btn.classList.add('sel');
        sellCurrency = btn.dataset.cur;
        $('step3').classList.remove('locked');
        if(sellNft) $('sellS').textContent = sellNft.name + ' ('+sellCurrency+')';
      };
    });

    // Final submit
    $('btnSell').onclick=()=>{
      if(!sellNft||!sellCurrency){msg('msgSell','Выберите NFT и валюту','wn');return;}
      const p=Number($('sellP').value);
      if(!p||p<=0){msg('msgSell','Введите цену','wn');return;}
      send({action:'list_nft',nft_id:sellNft.id,price:p,currency:sellCurrency});
      msg('msgSell','Выставлено на продажу!','ok');
      setTimeout(resetSell, 2000);
    };
  }

  function renderSell(items) {
    const el=$('sellL'),em=$('sellE');
    if(!el)return;
    el.innerHTML='';
    em.style.display=items.length?'none':'block';
    items.forEach(n=>{
      const b=document.createElement('button');
      b.className='li';b.type='button';
      b.innerHTML='<div class="lii"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="lib"><div class="lin">'+esc(n.name||'NFT')+'</div><div class="lis">'+esc(n.rarity||'')+'</div></div>';
      b.onclick=()=>{
        el.querySelectorAll('.li').forEach(x=>x.classList.remove('sel'));
        b.classList.add('sel');
        sellNft=n;
        $('step1').classList.add('done');
        $('step2').classList.remove('locked');
        msg('msgSell','','');
      };
      el.appendChild(b);
    });
  }

  // === Buy ===
  let buyNft=null;
  function initBuy() {
    $('btnBuy').onclick=()=>{
      if(!buyNft)return;
      send({action:'create_purchase_request',nft_id:buyNft.id,offer_price:Number(buyNft.price),currency:buyNft.currency||'USDT'});
      msg('msgBuy','Заявка отправлена!','ok');
      setTimeout(()=>{$('ov').classList.remove('show');},1500);
    };
    $('mCl').onclick=()=>$('ov').classList.remove('show');
    $('ov').onclick=e=>{if(e.target===$('ov'))$('ov').classList.remove('show');};
  }

  function renderMarket(items) {
    const el=$('mktL'),em=$('mktE');
    if(!el)return;
    el.innerHTML='';
    em.style.display=items.length?'none':'block';
    items.forEach(n=>{
      const c=document.createElement('button');
      c.className='mc';c.type='button';
      c.innerHTML='<div class="mci"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="mcb"><div class="mcn">'+esc(n.name||'NFT')+'</div><div class="mcr"><span class="mcl">Цена:</span><span class="mcv">'+fp(n.price,n.currency)+'</span></div><div class="mcr"><span class="mcl">Продавец:</span><span class="mcv">'+esc(n.seller_name||'')+'</span></div></div>';
      c.onclick=()=>{
        buyNft=n;
        $('mI').src=n.image_url||'';
        $('mT').textContent=n.name||'NFT';
        $('mP').textContent=fp(n.price,n.currency);
        $('mS').textContent=n.seller_name||'';
        $('mR').textContent=(n.rarity||'COMMON').toUpperCase();
        $('mRT').textContent=n.rarity||'common';
        $('mLk').textContent=n.token_link||'—';
        $('msgBuy').textContent='';
        $('ov').classList.add('show');
        $('btnBuy').disabled=false;
      };
      el.appendChild(c);
    });
  }

  // === Profile NFTs ===
  function renderProfInv(items) {
    const el=$('prInv'),em=$('prInvE');
    if(!el)return;
    el.innerHTML='';
    em.style.display=items.length?'none':'block';
    items.forEach(n=>{
      const d=document.createElement('div');
      d.className='li';
      d.innerHTML='<div class="lii"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="lib"><div class="lin">'+esc(n.name||'NFT')+'</div><div class="lis">'+(n.is_listed?'В продаже':'Не в продаже')+'</div></div>';
      el.appendChild(d);
    });
    renderSell(items);
  }

  // === Tx ===
  function renderTx(items) {
    const el=$('txL'),em=$('txE');
    if(!el)return;
    el.innerHTML='';
    em.style.display=items.length?'none':'block';
    items.forEach(tx=>{
      const d=document.createElement('div');
      d.className='txi';
      const a=Number(tx.amount)||0;
      d.innerHTML='<b>'+esc(tx.type||'—')+'</b><div class="amt">'+(a>=0?'+':'')+a.toFixed(2)+' '+esc(tx.currency||'USDT')+'</div><div class="det">'+esc(tx.details||tx.created_at||'')+'</div>';
      el.appendChild(d);
    });
  }

  // === Balance (3 currencies) ===
  function renderBalance(m) {
    $('bUsdt').textContent = (Number(m.balance)||0).toFixed(2);
    $('bStars').textContent = (Number(m.stars)||0).toFixed(0);
    $('bTon').textContent = (Number(m.ton)||0).toFixed(2);
  }

  // === Withdraw ===
  function initWithdraw() {
    const amtInput=$('wdA'), curSelect=$('wdCur'), calcEl=$('wdCalc');
    function updateCalc(){
      const a=Number(amtInput.value||0), cur=curSelect.value;
      if(a<=0){calcEl.textContent='Получите: —';return;}
      calcEl.textContent='Получите: '+(a*(1-FEE)).toFixed(2)+' '+cur;
    }
    amtInput.oninput=updateCalc;
    curSelect.onchange=updateCalc;

    $('btnWd').onclick=()=>{
      const a=Number($('wdA').value||0);
      const w=$('wdW').value||'';
      const cur=$('wdCur').value;
      if(a<=0){msg('msgWd','Введите сумму','wn');return;}
      if(!w){msg('msgWd','Укажите @username для вывода','wn');return;}
      const after=a*(1-FEE);
      send({action:'create_withdraw',amount:a,currency:cur,wallet_address:w});
      msg('msgWd','Заявка создана! К вам придет '+after.toFixed(2)+' '+cur+' на @'+w.replace('@','')+'. Менеджер @ggyyert свяжется с вами.','ok');
    };
  }

  // === Backend messages ===
  function onData(m) {
    const a=m?.action;
    if(a==='get_balance') renderBalance(m);
    if(a==='get_market') renderMarket(m.items||[]);
    if(a==='get_my_nfts') renderProfInv(m.items||[]);
    if(a==='get_transactions') renderTx(m.items||[]);
    if(a==='accept_rules') show('scrMenu');
  }

  const app=tg();
  if(app){try{app.onEvent('webapp_data',e=>{try{onData(JSON.parse(e.data));}catch{} });}catch{}}

  // === BG Particles ===
  function initBg() {
    const c=$('bgCanvas');
    if(!c)return;
    const ctx=c.getContext('2d');
    let w,h,pts=[];
    function resize(){w=c.width=innerWidth;h=c.height=innerHeight;}
    function make(){
      pts=[];
      const n=Math.floor(w*h/18000);
      for(let i=0;i<n;i++){
        pts.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.8+.4,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,o:Math.random()*.4+.08});
      }
    }
    function frame(){
      ctx.clearRect(0,0,w,h);
      for(const p of pts){
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<0)p.x=w;if(p.x>w)p.x=0;
        if(p.y<0)p.y=h;if(p.y>h)p.y=0;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle='rgba(0,136,204,'+p.o+')';ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    resize();make();frame();
    addEventListener('resize',()=>{resize();make();});
  }
})();
