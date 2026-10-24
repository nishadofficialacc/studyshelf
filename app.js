import { firebaseSettings } from './firebase-config.js';
'use strict';
const $ = (selector) => document.querySelector(selector);
const refs = {
  grid: $('#productGrid'), search: $('#searchInput'), subject: $('#subjectFilter'), level: $('#levelFilter'),
  sort: $('#sortFilter'), dialog: $('#productDialog'), details: $('#dialogContent'), count: $('#resultsCount'),
  empty: $('#emptyState'), error: $('#catalogError')
};
let catalog = { store: {}, products: [] };
let activeProductId = null;
let liveUnsubscribe = null;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
const cleanString = (val, fallback='') => typeof val === 'string' ? val : fallback;
function isPayhipLink(url) {
  try { const u=new URL(url); return u.protocol==='https:' && (u.hostname==='payhip.com' || u.hostname.endsWith('.payhip.com')); }
  catch {return false;}
}
const validPreview = (path) => typeof path==='string' && /^assets\/[a-zA-Z0-9_./-]+\.pdf$/.test(path) && !path.includes('..');
const validColor = (value) => ['violet','mint','peach','blue','sand'].includes(value) ? value : 'violet';
const validCurrency = (value) => /^[A-Z]{3}$/.test(value || '') ? value : 'USD';
function priceLabel(product) {
  if (product.price === 0) return 'FREE';
  if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) return 'See Payhip price';
  try { return new Intl.NumberFormat('en-US',{ style:'currency', currency: validCurrency(catalog.store.currency) }).format(product.price); }
  catch {return 'See Payhip price';}
}
function coverHtml(p) {return `<div class="product-cover ${validColor(p.cover)}"><span class="cover-top">STUDYSHELF / REVISION SERIES</span><span class="cover-glyph">${escapeHtml(cleanString(p.symbol,'✦'))}</span><span class="cover-bottom"><span>${escapeHtml(cleanString(p.subject,'STUDY').toUpperCase())}</span><span>→</span></span></div>`;}
function cardHtml(p) {
  return `<article class="product-card"><div class="product-visual">${coverHtml(p)}${p.badge ? `<span class="product-ribbon">${escapeHtml(p.badge)}</span>`:''}</div><div class="card-main"><div class="product-topline"><span>${escapeHtml(p.subject)}</span><span>${escapeHtml(p.level)}</span></div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p><div class="card-footer"><span class="price ${p.price===0?'free':''}">${escapeHtml(priceLabel(p))}</span><button class="detail-button" type="button" data-product-id="${escapeHtml(p.id)}" aria-label="View details for ${escapeHtml(p.title)}">View details ↗</button></div></div></article>`;
}
function fillOptions(select,values, label){
  const frag=document.createDocumentFragment();
  [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach((value)=>{const opt=document.createElement('option');opt.value=value;opt.textContent=value;frag.append(opt);});
  select.append(frag);
}
function resetFilters(){refs.search.value='';refs.subject.value='all';refs.level.value='all';refs.sort.value='featured';renderProducts();}
function renderProducts(){
  const term=refs.search.value.trim().toLowerCase();
  const result=catalog.products.filter(p=>p.published &&
    (refs.subject.value==='all' || p.subject===refs.subject.value) &&
    (refs.level.value==='all' || p.level===refs.level.value) &&
    [p.title,p.subject,p.level,p.exam,p.description,...(p.includes||[])].join(' ').toLowerCase().includes(term));
  const sort=refs.sort.value;
  if(sort==='featured')result.sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)) || a.title.localeCompare(b.title));
  if(sort==='az')result.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort==='price-asc')result.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  if(sort==='price-desc')result.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity));
  refs.grid.innerHTML=result.map(cardHtml).join('');
  refs.count.textContent=`${result.length} ${result.length===1?'note':'notes'} available`;
  refs.empty.hidden=result.length>0;
}
function openProduct(p, fromHash=false){
  if(!p)return;
  activeProductId=p.id;
  const checkoutReady=isPayhipLink(p.payhipUrl);
  const previewReady=validPreview(p.preview);
  const items=(Array.isArray(p.includes)?p.includes:[]).map(s=>`<li>${escapeHtml(s)}</li>`).join('');
  refs.details.innerHTML=`<div class="dialog-layout"><div class="dialog-side">${coverHtml(p)}<button class="share-link" type="button" id="shareLink">↗ Copy product link</button></div><div class="dialog-details"><span class="dialog-kicker">${escapeHtml(p.badge||'STUDY NOTE')}</span><h2 id="dialogTitle">${escapeHtml(p.title)}</h2><p>${escapeHtml(p.description)}</p><div class="chips"><span>${escapeHtml(p.subject)}</span><span>${escapeHtml(p.level)}</span>${p.exam?`<span>${escapeHtml(p.exam)}</span>`:''}${p.pages ? `<span>${Number(p.pages)} pages</span>`:''}</div>${items?`<h3>Inside this guide</h3><ul>${items}</ul>`:''}<div class="buy-panel"><div class="buy-row"><strong class="${p.price===0?'price free':''}">${escapeHtml(priceLabel(p))}</strong>${checkoutReady?`<a href="${escapeHtml(p.payhipUrl)}" class="checkout-button" target="_blank" rel="noopener noreferrer">${p.price===0?'Get free on Payhip':'View on Payhip'} ↗</a>`:`<button class="checkout-button no-checkout" type="button" disabled>Not available yet</button>`}</div>${previewReady?`<a class="preview-link" href="${escapeHtml(p.preview)}" target="_blank" rel="noopener noreferrer">↗ Open public sample PDF</a>`:''}<small>${checkoutReady?'You will open Payhip to confirm the current product details, price, and any required checkout steps.':'Seller has not yet enabled a checkout link for this product.'}</small></div></div></div>`;
  refs.details.querySelector('#shareLink').addEventListener('click',async e=>{
    const url=new URL(window.location.href);url.hash=`note/${encodeURIComponent(p.id)}`;
    const button=e.currentTarget;
    try {await navigator.clipboard.writeText(url.href);button.textContent='✓ Link copied';}
    catch {button.textContent='Link: '+url.href;}
  });
  if(!refs.dialog.open)refs.dialog.showModal();
  if(!fromHash)history.replaceState(null,'',`#note/${encodeURIComponent(p.id)}`);
}
function handleHash(){
  let match;
  try { match=decodeURIComponent(window.location.hash.slice(1)).match(/^note\/([a-z0-9-]+)$/); }
  catch { match=null; }
  if(match){const p=catalog.products.find(x=>x.published && x.id===match[1]);if(p)openProduct(p,true);}
  else if(refs.dialog.open){refs.dialog.close();}
}
function initEvents(){
  [refs.search,refs.subject,refs.level,refs.sort].forEach(el=>el.addEventListener('input',renderProducts));
  $('#clearFilters').addEventListener('click',resetFilters);
  $('#emptyReset').addEventListener('click',resetFilters);
  refs.grid.addEventListener('click',e=>{const btn=e.target.closest('[data-product-id]');if(!btn)return;const p=catalog.products.find(x=>x.id===btn.dataset.productId);openProduct(p);});
  $('#dialogClose').addEventListener('click',()=>refs.dialog.close());
  refs.dialog.addEventListener('click',e=>{if(e.target===refs.dialog)refs.dialog.close();});
  refs.dialog.addEventListener('close',()=>{if(window.location.hash.startsWith('#note/'))history.replaceState(null,'','#catalog');activeProductId=null;});
  window.addEventListener('hashchange',handleHash);
  const toggle=$('#menuToggle'),mobile=$('#mobileLinks');
  toggle.addEventListener('click',()=>{const next=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(next));toggle.textContent=next?'✕':'☰';mobile.hidden=!next;});
  mobile.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{mobile.hidden=true;toggle.textContent='☰';toggle.setAttribute('aria-expanded','false');}));
}
function applyStore(){
  const email=cleanString(catalog.store.supportEmail).trim();
  const isValidEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const support=$('#supportLine');
  support.textContent='Seller support contact not configured yet — demonstration store.';
  if(isValidEmail){support.textContent='Seller support: ';const a=document.createElement('a');a.href='mailto:'+email;a.textContent=email;a.style.textDecoration='underline';support.append(a);}
  const testMode=catalog.store.testMode !== false;
  $('#announcement').textContent=testMode?'DEMO STORE · Product checkout is handled by Payhip':'STUDYSHELF · Digital notes and resources · Checkout through Payhip';
  $('#footerMode').textContent=testMode?'Demonstration storefront · Not ready for commercial launch':'Product details and pricing are confirmed on Payhip.';
  $('#year').textContent=String(new Date().getFullYear());
}
function showCatalogError(message){
  console.error('StudyShelf:',message);
  refs.grid.replaceChildren();
  refs.count.textContent='Library unavailable';
  refs.error.hidden=false;
}
function setProducts(products){
  if (!Array.isArray(products)) { showCatalogError('Invalid catalog products'); return; }
  const oldSubject=refs.subject.value, oldLevel=refs.level.value;
  catalog.products=products.filter(p=>p && typeof p.id==='string' && /^[a-z0-9-]+$/.test(p.id) && typeof p.title==='string' && typeof p.subject==='string' && typeof p.level==='string').map(p=>({...p,includes:Array.isArray(p.includes)?p.includes:[]}));
  for(const select of [refs.subject,refs.level]) select.replaceChildren(select.options[0]);
  const live=catalog.products.filter(p=>p.published);
  fillOptions(refs.subject,live.map(p=>p.subject));fillOptions(refs.level,live.map(p=>p.level));
  refs.subject.value=[...refs.subject.options].some(x=>x.value===oldSubject)?oldSubject:'all';
  refs.level.value=[...refs.level.options].some(x=>x.value===oldLevel)?oldLevel:'all';
  refs.error.hidden=true;
  if(activeProductId){
    const active=catalog.products.find(p=>p.published && p.id===activeProductId);
    if(!active && refs.dialog.open) refs.dialog.close();
    else if(active && refs.dialog.open) openProduct(active,true);
  }
  renderProducts();handleHash();
}
async function start(){
  initEvents();
  $('#year').textContent=String(new Date().getFullYear());
  let backup;
  try {
    const response=await fetch('data/catalog.json',{cache:'no-store'});
    if(!response.ok) throw new Error('Catalog request failed: '+response.status);
    backup=await response.json();
    if(!backup || !backup.store || !Array.isArray(backup.products)) throw new Error('Catalog format invalid');
    catalog.store=backup.store;applyStore();
  }catch(err){ showCatalogError(err);return; }
  if (!firebaseSettings.enabled) {
    // V2 remains usable during setup; no authentication or direct editing until enabled.
    setProducts(backup.products);
    return;
  }
  try {
    const [{ initializeApp }, { getFirestore, collection, query, where, onSnapshot, doc }]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
    ]);
    const db=getFirestore(initializeApp(firebaseSettings.config));
    // Do not fall back to the public static catalog once Firebase is enabled.
    // A fallback could mistakenly display previously unpublished/removed products.
    liveUnsubscribe=onSnapshot(query(collection(db,'products'),where('published','==',true)), snap=>{
      setProducts(snap.docs.map(item=>({id:item.id,...item.data()})));
    }, err=>showCatalogError('Live product database: '+err.message));
    onSnapshot(doc(db,'settings','public'),snap=>{
      if(snap.exists()){
        catalog.store={...backup.store,...snap.data()};applyStore();
      }
    },err=>console.error('StudyShelf settings:',err));
  }catch(err){showCatalogError('Firebase could not initialize: '+err.message);}
}
start();
