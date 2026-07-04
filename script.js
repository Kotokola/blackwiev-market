(()=>{
const $=s=>document.getElementById(s);
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fp=(v,c)=>(Number(v)||0).toFixed(2)+' '+(c||'');
const FEE=0.05;

// === Telegram ===
function tgApp(){try{return window.Telegram?.WebApp||null}catch{return null}}
function tgSend(d){const a=tgApp();if(!a)return;try{a.sendData(typeof d==='string'?d:JSON.stringify(d))}catch{}}

// === State ===
let balances={usdt:0,stars:0,ton:0};
let idVisible=false,sellNft=null,sellCurrency=null;
let _profileDone=false;

function show(id){
  document.querySelectorAll('.scr').forEach(s=>s.classList.remove('act'));
  const el=$(id);if(el)el.classList.add('act');
  window.scrollTo(0,0);
}
function msg(id,t,k){const e=$(id);if(!e)return;e.textContent=t||'';e.className='ms';if(k)e.classList.add(k)}

// ===== USER PROFILE =====
// Three strategies to get user data:
// 1) Telegram initDataUnsafe.user
// 2) Parse initData URL params
// 3) URL search params (?uid=...&un=...&fn=...) injected by bot
function getUser(){
  const a=tgApp();
  if(!a)return{first_name:'Пользователь',username:'',id:0};
  // Strategy 1
  try{if(a.initDataUnsafe&&a.initDataUnsafe.user)return a.initDataUnsafe.user}catch{}
  // Strategy 2
  try{if(a.initData){const p=new URLSearchParams(a.initData);const u=p.get('user');if(u)return JSON.parse(u)}}catch{}
  // Strategy 3: URL params
  try{
    const p=new URLSearchParams(window.location.search);
    const uid=p.get('uid');
    if(uid)return{id:Number(uid),user_id:Number(uid),username:p.get('un')||'',first_name:p.get('fn')||''};
  }catch{}
  return null;
}

function applyProfile(u){
  if(!u||_profileDone)return;
  _profileDone=true;
  const av=$('av');
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ');
  $('pNm').textContent=name||'Пользователь';
  $('pUs').textContent=u.username?'@'+u.username:'—';
  $('pId').textContent=String(u.id||u.user_id||'—');
  if(u.photo_url)av.innerHTML='<img src="'+esc(u.photo_url)+'" alt="">';
  else av.textContent=(u.first_name||'?')[0].toUpperCase();
}

function loadProfile(){
  const u=getUser();
  if(u&&u.first_name&&u.id){
    applyProfile(u);
  }else{
    // Fallback: show minimal profile, try to get data from bot
    $('pNm').textContent='Пользователь';
    $('pUs').textContent='—';
    $('pId').textContent='—';
    $('av').textContent='?';
    tgSend({action:'get_balance'});
  }
}

function toggleId(){
  idVisible=!idVisible;
  $('pId').classList.toggle('show',idVisible);
  $('btnToggleId').textContent=idVisible?'Скрыть':'Показать';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded',()=>{
  const a=tgApp();
  if(a){try{a.expand()}catch{}try{a.ready()}catch{}}

  // Try profile immediately, then retry after bot responds
  loadProfile();
  setTimeout(loadProfile,500);
  setTimeout(loadProfile,1500);

  initBg();initRules();initMenu();initTabs();initSell();initBuy();initWithdraw();
  $('btnToggleId').onclick=toggleId;
  show('scrRules');
});

// ===== Rules =====
function initRules(){
  const cb=$('cbR'),btn=$('btnR');
  btn.disabled=!cb.checked;
  cb.onchange=()=>{btn.disabled=!cb.checked};
  btn.onclick=()=>{try{localStorage.setItem('bb_r','1')}catch{}show('scrMenu');tgSend({action:'accept_rules'})};
  try{if(localStorage.getItem('bb_r')==='1')show('scrMenu')}catch{}
}

// ===== Menu =====
function initMenu(){
  document.querySelectorAll('[data-go]').forEach(b=>{
    b.onclick=()=>{
      const g=b.dataset.go;
      show('scr'+g[0].toUpperCase()+g.slice(1));
      if(g==='sell'){resetSell();tgSend({action:'get_my_nfts'})}
      if(g==='buy')tgSend({action:'get_market'});
      if(g==='profile'){loadProfile();tgSend({action:'get_balance'});tgSend({action:'get_my_nfts'})}
    };
  });
  document.querySelectorAll('[data-back]').forEach(b=>{
    b.onclick=()=>show('scr'+b.dataset.back[0].toUpperCase()+b.dataset.back.slice(1));
  });
}

// ===== Tabs =====
function initTabs(){
  document.querySelectorAll('.tab').forEach(t=>{
    t.onclick=()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('act'));
      document.querySelectorAll('.tc').forEach(x=>x.classList.remove('act'));
      t.classList.add('act');
      const s=document.querySelector('.tc[data-tab="'+t.dataset.tab+'"]');
      if(s)s.classList.add('act');
      if(t.dataset.tab==='inv')tgSend({action:'get_my_nfts'});
      if(t.dataset.tab==='tx')tgSend({action:'get_transactions'});
      if(t.dataset.tab==='wd')tgSend({action:'get_balance'});
    };
  });
}

// ===== Sell =====
function resetSell(){
  sellNft=null;sellCurrency=null;
  if($('step1'))$('step1').classList.remove('done');
  if($('step2'))$('step2').classList.add('locked');
  if($('step3'))$('step3').classList.add('locked');
  if($('sellS'))$('sellS').textContent='—';
  if($('sellP'))$('sellP').value='';
  document.querySelectorAll('.curbtn').forEach(b=>b.classList.remove('sel'));
  msg('msgSell','','');
}
function initSell(){
  document.querySelectorAll('.curbtn').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.curbtn').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');sellCurrency=btn.dataset.cur;
      if($('step3'))$('step3').classList.remove('locked');
      if(sellNft&&$('sellS'))$('sellS').textContent=sellNft.name+' ('+sellCurrency+')';
    };
  });
  if($('btnSell'))$('btnSell').onclick=()=>{
    if(!sellNft||!sellCurrency){msg('msgSell','Выберите NFT и валюту','wn');return}
    const p=Number($('sellP').value);
    if(!p||p<=0){msg('msgSell','Введите цену','wn');return}
    tgSend({action:'list_nft',nft_id:sellNft.id,price:p,currency:sellCurrency});
    msg('msgSell','Выставлено!','ok');setTimeout(resetSell,2000);
  };
}
function renderSell(items){
  const el=$('sellL'),em=$('sellE');if(!el)return;
  el.innerHTML='';em.style.display=items.length?'none':'block';
  items.forEach(n=>{
    const b=document.createElement('button');b.className='li';b.type='button';
    b.innerHTML='<div class="lii"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="lib"><div class="lin">'+esc(n.name||'NFT')+'</div><div class="lis">'+esc(n.rarity||'')+'</div></div>';
    b.onclick=()=>{el.querySelectorAll('.li').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');sellNft=n;
      if($('step1'))$('step1').classList.add('done');if($('step2'))$('step2').classList.remove('locked');msg('msgSell','','')};
    el.appendChild(b);
  });
}

// ===== Buy =====
let buyNft=null;
function initBuy(){
  if($('btnBuy'))$('btnBuy').onclick=()=>{
    if(!buyNft)return;
    tgSend({action:'create_purchase_request',nft_id:buyNft.id,offer_price:Number(buyNft.price),currency:buyNft.currency||'USDT'});
    msg('msgBuy','Заявка отправлена!','ok');setTimeout(()=>$('ov').classList.remove('show'),1500);
  };
  if($('mCl'))$('mCl').onclick=()=>$('ov').classList.remove('show');
  if($('ov'))$('ov').onclick=e=>{if(e.target===$('ov'))$('ov').classList.remove('show')};
}
function renderMarket(items){
  const el=$('mktL'),em=$('mktE');if(!el)return;
  el.innerHTML='';em.style.display=items.length?'none':'block';
  items.forEach(n=>{
    const c=document.createElement('button');c.className='mc';c.type='button';
    c.innerHTML='<div class="mci"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="mcb"><div class="mcn">'+esc(n.name||'NFT')+'</div><div class="mcr"><span class="mcl">Цена:</span><span class="mcv">'+fp(n.price,n.currency)+'</span></div><div class="mcr"><span class="mcl">Продавец:</span><span class="mcv">'+esc(n.seller_name||'')+'</span></div></div>';
    c.onclick=()=>{buyNft=n;$('mI').src=n.image_url||'';$('mT').textContent=n.name||'NFT';
      $('mP').textContent=fp(n.price,n.currency);$('mS').textContent=n.seller_name||'';
      $('mR').textContent=(n.rarity||'COMMON').toUpperCase();$('mRT').textContent=n.rarity||'common';
      $('mLk').textContent=n.token_link||'—';$('msgBuy').textContent='';$('ov').classList.add('show');$('btnBuy').disabled=false};
    el.appendChild(c);
  });
}

// ===== Profile NFTs =====
function renderProfInv(items){
  const el=$('prInv'),em=$('prInvE');if(!el)return;
  el.innerHTML='';em.style.display=items.length?'none':'block';
  items.forEach(n=>{
    const d=document.createElement('div');d.className='li';
    d.innerHTML='<div class="lii"><img src="'+esc(n.image_url||'')+'" onerror="this.style.display=\'none\'"></div><div class="lib"><div class="lin">'+esc(n.name||'NFT')+'</div><div class="lis">'+(n.is_listed?'В продаже':'Не в продаже')+'</div></div>';
    el.appendChild(d);
  });
  renderSell(items);
}

// ===== Tx =====
function renderTx(items){
  const el=$('txL'),em=$('txE');if(!el)return;
  el.innerHTML='';em.style.display=items.length?'none':'block';
  items.forEach(tx=>{
    const d=document.createElement('div');d.className='txi';
    const a=Number(tx.amount)||0;
    d.innerHTML='<b>'+esc(tx.type||'—')+'</b><div class="amt">'+(a>=0?'+':'')+a.toFixed(2)+' '+esc(tx.currency||'USDT')+'</div><div class="det">'+esc(tx.details||tx.created_at||'')+'</div>';
    el.appendChild(d);
  });
}

// ===== Balance =====
function renderBalance(m){
  balances.usdt=Number(m.balance)||0;balances.stars=Number(m.stars)||0;balances.ton=Number(m.ton)||0;
  if($('bUsdt'))$('bUsdt').textContent=balances.usdt.toFixed(2);
  if($('bStars'))$('bStars').textContent=balances.stars.toFixed(0);
  if($('bTon'))$('bTon').textContent=balances.ton.toFixed(2);
  // Bot sends user_id — use it for profile
  if(m.user_id&&m.first_name&&!_profileDone){
    applyProfile({id:m.user_id,user_id:m.user_id,first_name:m.first_name,username:m.username||''});
  }
}

// ===== Withdraw =====
function initWithdraw(){
  const ai=$('wdA'),cs=$('wdCur'),cl=$('wdCalc');
  if(!ai||!cs||!cl)return;
  function uc(){const a=Number(ai.value||0),c=cs.value;if(a<=0){cl.textContent='Получите: —';return}cl.textContent='Получите: '+(a*(1-FEE)).toFixed(2)+' '+c}
  ai.oninput=uc;cs.onchange=uc;
  $('btnWd').onclick=()=>{
    const a=Number($('wdA').value||0),w=$('wdW').value||'',cur=$('wdCur').value;
    if(a<=0){msg('msgWd','Введите сумму','wn');return}
    if(!w){msg('msgWd','Укажите @username для вывода','wn');return}
    const mm={USDT:1,STARS:50,TON:0.5};
    if(a<mm[cur]){msg('msgWd','Минимум: '+mm[cur]+' '+cur,'wn');return}
    if(cur==='USDT'&&a>balances.usdt){msg('msgWd','Недостаточно. Баланс: '+balances.usdt.toFixed(2)+' USDT','wn');return}
    if(cur==='STARS'&&a>balances.stars){msg('msgWd','Недостаточно. Баланс: '+balances.stars+' Stars','wn');return}
    if(cur==='TON'&&a>balances.ton){msg('msgWd','Недостаточно. Баланс: '+balances.ton.toFixed(2)+' TON','wn');return}
    tgSend({action:'create_withdraw',amount:a,currency:cur,wallet_address:w});
    msg('msgWd','Заявка! К вам придет '+(a*(1-FEE)).toFixed(2)+' '+cur+' на @'+w.replace('@','')+'. @ggyyert свяжется.','ok');
  };
}

// ===== Backend =====
function onData(m){
  const a=m?.action;
  if(a==='get_balance')renderBalance(m);
  if(a==='get_market')renderMarket(m.items||[]);
  if(a==='get_my_nfts')renderProfInv(m.items||[]);
  if(a==='get_transactions')renderTx(m.items||[]);
  if(a==='accept_rules')show('scrMenu');
}
const app=tgApp();
if(app){try{app.onEvent('webapp_data',e=>{try{onData(JSON.parse(e.data))}catch{}})}catch{}}

// ===== BG =====
function initBg(){
  const c=$('bgCanvas');if(!c)return;const ctx=c.getContext('2d');let w,h,pts=[];
  function r(){w=c.width=innerWidth;h=c.height=innerHeight}
  function m(){pts=[];for(let i=0,n=Math.floor(w*h/18000);i<n;i++)pts.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.8+.4,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,o:Math.random()*.4+.08})}
  function f(){ctx.clearRect(0,0,w,h);for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(0,136,204,'+p.o+')';ctx.fill()}requestAnimationFrame(f)}
  r();m();f();addEventListener('resize',()=>{r();m()});
}
})();
