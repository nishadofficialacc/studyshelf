import { firebaseSettings } from '../firebase-config.js';

'use strict';
const $ = selector => document.querySelector(selector);
const form = $('#productForm');
const settingsForm = $('#settingsForm');
const status = $('#appStatus');
const defaults = () => ({id:'',title:'',subject:'',level:'',exam:'',description:'',includes:[],pages:0,price:null,cover:'violet',symbol:'✦',badge:'',preview:'',payhipUrl:'',featured:false,published:false});
const esc = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const slug = v => String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72)||'new-product';
const isPayhip = value => {try{const u=new URL(value);return u.protocol==='https:' && u.hostname==='payhip.com' && /^\/b\/[a-z0-9_-]+\/?$/i.test(u.pathname) && !u.search && !u.hash;}catch{return false;}};
const isPreview = path => !path || (/^assets\/[a-zA-Z0-9_./-]+\.pdf$/.test(path)&&!path.includes('..'));
const setStatus = (msg,bad=false) => {status.textContent=msg;status.classList.toggle('error',bad);};
let auth,db,api,authApi,currentUser,unsubscribeProducts=null,unsubscribeSettings=null;
let catalog=[],selectedId=null,draft=null,newDraft=false,dirty=false,baselineUpdatedAt=null;
let savedStore={name:'StudyShelf',currency:'USD',supportEmail:'',testMode:true};
let storeDirty=false, loading=false;

function setDirty(value) {dirty=value;$('#changeStatus').textContent=value?'Unsaved product edits — click Save':'No unsaved product edits';}
function activeProduct(){return draft;}
function choose(id){
  if(dirty && !confirm('Discard unsaved product changes?')) return;
  const p=catalog.find(x=>x.id===id);
  if(!p)return;
  selectedId=p.id;draft={...p,includes:[...(p.includes||[])]};newDraft=false;
  baselineUpdatedAt=p.updatedAt?.toMillis?.() ?? null;
  setDirty(false);drawList();fillForm();
}
function drawList(){
  $('#productCounter').textContent=`${catalog.length} total · ${catalog.filter(p=>p.published).length} public`;
  $('#productList').innerHTML=catalog.map(p=>`<button type="button" class="product-row ${p.id===selectedId?'selected':''}" data-id="${esc(p.id)}"><strong>${esc(p.title||'(Untitled)')}</strong><small>${esc(p.subject||'No subject')} · <span class="${p.published?'live':'draft'}">${p.published?'Published':'Draft'}</span></small></button>`).join('')||'<p>No products yet. Add one or import the V2 sample.</p>';
}
function fillForm(){
  form.hidden=!draft;$('#noProduct').hidden=!!draft;
  if(!draft)return;
  for(const key of ['id','title','subject','level','exam','description','pages','cover','symbol','badge','preview','payhipUrl']) form.elements[key].value=draft[key]??'';
  form.elements.id.disabled=!newDraft;
  form.elements.includes.value=(draft.includes||[]).join('\n');
  form.elements.price.value=draft.price===null||draft.price===undefined?'':String(draft.price);
  form.elements.featured.checked=!!draft.featured;
  form.elements.published.checked=!!draft.published;
  $('#editorTitle').textContent=draft.title||'New study note';
  $('#productHint').textContent=draft.published?'Published — visible once saved (and may be seen by customers).':'Draft — only authorized editors can see this listing.';
}
function newItem(duplicate=false){
  if(dirty && !confirm('Discard unsaved product changes?'))return;
  let p=duplicate&&draft?{...draft,includes:[...(draft.includes||[])]}:defaults();
  p.id=slug(duplicate?`${p.id}-copy`:'new-study-note');
  const existing=new Set(catalog.map(x=>x.id));let base=p.id,n=2;while(existing.has(p.id))p.id=`${base}-${n++}`;
  p.title=duplicate?`${p.title} (copy)`:'New study note';p.payhipUrl='';p.published=false;p.featured=false;
  selectedId=p.id;draft=p;newDraft=true;baselineUpdatedAt=null;setDirty(true);drawList();fillForm();
  setStatus('New draft prepared. Complete the details and save it to the database.');
}
function readForm(e){
  if(!draft||!e.target.name)return;
  const key=e.target.name;
  if(key==='published'||key==='featured')draft[key]=e.target.checked;
  else if(key==='includes')draft[key]=e.target.value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,25);
  else if(key==='pages')draft[key]=e.target.value===''?0:Number(e.target.value);
  else if(key==='price')draft[key]=e.target.value===''?null:Number(e.target.value);
  else draft[key]=e.target.value;
  setDirty(true);
  if(key==='published')$('#productHint').textContent=draft.published?'Published — visible once saved.':'Draft — hidden from customers.';
  if(key==='title')$('#editorTitle').textContent=draft.title||'New study note';
}
function validate(p){
  const errors=[];
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)||p.id.length>80)errors.push('Use a lowercase product ID with hyphens.');
  for(const key of ['title','subject','level','description'])if(!String(p[key]||'').trim())errors.push(`${key} is required.`);
  if(p.title.length>140||p.subject.length>50||p.level.length>80||p.description.length>1500||p.exam.length>100||p.badge.length>40||p.symbol.length>4)errors.push('One or more fields exceed their length limits.');
  if(!Number.isInteger(p.pages)||p.pages<0||p.pages>2000)errors.push('Pages must be a whole number from 0 to 2000.');
  if(p.price!==null&&(!Number.isFinite(p.price)||p.price<0))errors.push('Price must be nonnegative, or blank when unverified.');
  if(p.payhipUrl&&!isPayhip(p.payhipUrl))errors.push('Use a direct https://payhip.com/b/... link.');
  if(p.published&&!isPayhip(p.payhipUrl))errors.push('A published product requires a working Payhip link.');
  if(!isPreview(p.preview))errors.push('Public sample must be an assets/*.pdf path without ..');
  if(!['violet','mint','peach','blue','sand'].includes(p.cover))errors.push('Choose a valid cover palette.');
  if(p.includes.length>25||p.includes.some(x=>typeof x!=='string'||x.length>200))errors.push('Use at most 25 contents bullets, each 200 characters or fewer.');
  return errors;
}
function payloadOf(p){const keys=['title','subject','level','exam','description','includes','pages','price','cover','symbol','badge','preview','payhipUrl','featured','published'];const o={};for(const key of keys)o[key]=p[key];return o;}
function sameTimestamp(a,b){return (a?.toMillis?.()??null)===b;}
async function saveProduct(e){
  e.preventDefault();
  if(!draft||loading)return;
  const p={...draft,includes:[...(draft.includes||[])]}, errors=validate(p);
  if(errors.length){setStatus(errors.slice(0,3).join(' '),true);return;}
  const id=p.id,wasNew=newDraft,old=baselineUpdatedAt;
  loading=true;$('#saveProductBtn').disabled=true;
  try{
    const ref=api.doc(db,'products',id);
    await api.runTransaction(db,async txn=>{
      const snap=await txn.get(ref);
      if(wasNew&&snap.exists())throw new Error('A product with this ID already exists. Choose another ID.');
      if(!wasNew&&(!snap.exists()||!sameTimestamp(snap.data().updatedAt,old)))throw new Error('This product was changed by someone else. Reload it and review their version before saving.');
      const updated={...payloadOf(p),updatedBy:currentUser.uid,updatedAt:api.serverTimestamp()};
      if(wasNew){updated.createdBy=currentUser.uid;updated.createdAt=api.serverTimestamp();txn.set(ref,updated);}
      else txn.update(ref,updated);
    });
    setDirty(false);newDraft=false;selectedId=id;setStatus(`${p.published?'Published':'Draft saved'}: ${p.title}. Changes will appear on the public storefront automatically if published.`);
  }catch(err){setStatus('Save failed: '+err.message,true);}
  finally{loading=false;$('#saveProductBtn').disabled=false;}
}
async function deleteProduct(){
  if(!draft||loading)return;
  if(newDraft){draft=null;selectedId=null;newDraft=false;setDirty(false);drawList();fillForm();return;}
  if(!confirm(`Permanently delete "${draft.title}"? Its public link will stop working. Use Draft instead if you only want to hide it.`))return;
  try{
    const id=selectedId,old=baselineUpdatedAt,ref=api.doc(db,'products',id);
    await api.runTransaction(db,async txn=>{
      const snap=await txn.get(ref);
      if(!snap.exists()||!sameTimestamp(snap.data().updatedAt,old))throw new Error('Product changed elsewhere. Reload it before deleting.');
      txn.delete(ref);
    });
    draft=null;selectedId=null;setDirty(false);drawList();fillForm();setStatus('Product deleted from the database.');
  }catch(err){setStatus('Delete failed: '+err.message,true);}
}
function readSettings(){
  const s={name:settingsForm.elements.name.value.trim(),currency:settingsForm.elements.currency.value,supportEmail:settingsForm.elements.supportEmail.value.trim(),testMode:settingsForm.elements.testMode.checked};
  if(!s.name||s.name.length>60)throw new Error('Store name is required (max 60 characters).');
  if(!['USD','LKR','GBP','EUR','AUD','CAD'].includes(s.currency))throw new Error('Choose a supported currency.');
  if(s.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.supportEmail))throw new Error('Enter a valid support email.');
  if(!s.testMode&&!s.supportEmail)throw new Error('Enter the client-approved support email before turning off demo mode.');
  return s;
}
function fillSettings(){
  for(const key of ['name','currency','supportEmail'])settingsForm.elements[key].value=savedStore[key]||'';
  settingsForm.elements.testMode.checked=savedStore.testMode!==false;storeDirty=false;
}
async function saveSettings(e){
  e.preventDefault();let s;
  try{s=readSettings();await api.setDoc(api.doc(db,'settings','public'),s);savedStore=s;storeDirty=false;setStatus('Store settings saved and published.');}
  catch(err){setStatus('Store settings could not be saved: '+err.message,true);}
}
function exportBackup(){
  const products=catalog.map(p=>{let out={id:p.id};Object.assign(out,payloadOf(p));return out;});
  const content=JSON.stringify({version:3,store:savedStore,products},null,2)+'\n';
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='studyshelf-catalog-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus('Backup exported. Keep it in an authorized private location.');
}
async function seed(){
  if(!confirm('Import the original Mathematics sample and store settings? This works only while the live product database is empty.'))return;
  try{
    const snapshot=await api.getDocs(api.collection(db,'products'));
    if(!snapshot.empty)throw new Error('The product database already contains items. Import canceled to prevent accidental overwrites.');
    const response=await fetch('../data/catalog.json',{cache:'no-store'});if(!response.ok)throw Error('Could not read V2 catalog.json');
    const original=await response.json();
    if(!original||!Array.isArray(original.products)||original.products.length>400)throw Error('Seed catalog invalid (max 400).');
    const batch=api.writeBatch(db);
    for(const entry of original.products){
      const p={...defaults(),...entry};const errors=validate(p);
      if(errors.length)throw Error(`Sample ${p.title}: ${errors[0]}`);
      batch.set(api.doc(db,'products',p.id),{...payloadOf(p),createdBy:currentUser.uid,updatedBy:currentUser.uid,createdAt:api.serverTimestamp(),updatedAt:api.serverTimestamp()});
    }
    const s={name:'StudyShelf',currency:'USD',supportEmail:'',testMode:true,...original.store};
    batch.set(api.doc(db,'settings','public'),s);
    await batch.commit();setStatus('V2 sample imported. The Mathematics product is now live in Firestore.');
  }catch(err){setStatus('Import failed: '+err.message,true);}
}
function showGate(message,user=null){
  $('#editor').hidden=true;$('#authGate').hidden=false;$('#authText').textContent=message;
  $('#identityInfo').hidden=!user;
  if(user){$('#identityEmail').textContent=user.email||'Signed in';$('#identityUid').textContent=user.uid;}
  $('#signInBtn').hidden=!!user || !auth;
}
function showEditor(user){
  $('#editor').hidden=false;$('#authGate').hidden=true;$('#userLabel').textContent=`Signed in: ${user.email||user.uid}`;
  if(unsubscribeProducts)unsubscribeProducts();if(unsubscribeSettings)unsubscribeSettings();
  unsubscribeProducts=api.onSnapshot(api.collection(db,'products'),snapshot=>{
    catalog=snapshot.docs.map(s=>({id:s.id,...s.data()})).sort((a,b)=>a.title.localeCompare(b.title));
    if(!dirty){
      if(selectedId){const p=catalog.find(x=>x.id===selectedId);if(p){draft={...p,includes:[...(p.includes||[])]};baselineUpdatedAt=p.updatedAt?.toMillis?.()??null;newDraft=false;} else if(!newDraft){selectedId=null;draft=null;}}
      if(!selectedId && !newDraft && catalog.length){selectedId=catalog[0].id;draft={...catalog[0],includes:[...(catalog[0].includes||[])]};baselineUpdatedAt=catalog[0].updatedAt?.toMillis?.()??null;}
      fillForm();
    } else if(!newDraft && selectedId && catalog.find(x=>x.id===selectedId)?.updatedAt?.toMillis?.()!==baselineUpdatedAt){
      setStatus('Someone may have changed this product. Saving now will detect conflicts. Copy your changes before reloading.',true);
    }
    drawList();
  },err=>setStatus('Could not read products: '+err.message,true));
  unsubscribeSettings=api.onSnapshot(api.doc(db,'settings','public'),snap=>{
    if(snap.exists()){savedStore=snap.data();if(!storeDirty)fillSettings();}
  },err=>setStatus('Could not read store settings: '+err.message,true));
  setStatus('Secure dashboard ready. Add a product or select an existing listing.');
}
function stopListening(){
  if(unsubscribeProducts){unsubscribeProducts();unsubscribeProducts=null;}
  if(unsubscribeSettings){unsubscribeSettings();unsubscribeSettings=null;}
  catalog=[];selectedId=null;draft=null;setDirty(false);
}
function bind(){
  $('#productList').addEventListener('click',e=>{const target=e.target.closest('[data-id]');if(target)choose(target.dataset.id);});
  $('#newBtn').addEventListener('click',()=>newItem());$('#duplicateBtn').addEventListener('click',()=>newItem(true));
  $('#deleteBtn').addEventListener('click',deleteProduct);
  form.addEventListener('input',readForm);form.addEventListener('change',readForm);form.addEventListener('submit',saveProduct);
  settingsForm.addEventListener('input',()=>{storeDirty=true;});settingsForm.addEventListener('change',()=>{storeDirty=true;});
  settingsForm.addEventListener('submit',saveSettings);
  $('#downloadBtn').addEventListener('click',exportBackup);$('#seedBtn').addEventListener('click',seed);
  $('#signOutBtn').addEventListener('click',()=>authApi.signOut(auth));
  $('#gateSignOutBtn').addEventListener('click',()=>authApi.signOut(auth));
  $('#copyUidBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(currentUser.uid);$('#authText').textContent='UID copied. Ask the project owner to add it to Firestore admins.';}catch{$('#authText').textContent='Copy the UID displayed below manually.';}});
  $('#signInBtn').addEventListener('click',async()=>{
    try{await authApi.signInWithPopup(auth,new authApi.GoogleAuthProvider());}
    catch(err){showGate(`Could not sign in: ${err.message}. Check Firebase Authentication Google provider and authorized domains.`);}
  });
  window.addEventListener('beforeunload',e=>{if(dirty||storeDirty){e.preventDefault();e.returnValue='';}});
}
async function initialize(){
  bind();
  if(!firebaseSettings.enabled){showGate('Firebase is not configured yet. Follow SETUP_V3.md to connect the project. The existing public V2-style store still works in demo mode.');return;}
  try{
    const [fa,fu,fs]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
    ]);
    authApi=fu;api=fs;const app=fa.initializeApp(firebaseSettings.config);auth=fu.getAuth(app);db=fs.getFirestore(app);
    fu.onAuthStateChanged(auth,async user=>{
      stopListening();currentUser=user;
      if(!user){showGate('Sign in using the Google account assigned to you for StudyShelf.');return;}
      showGate('Checking your access permissions…',user);
      try{
        const role=await fs.getDoc(fs.doc(db,'admins',user.uid));
        if(user!==auth.currentUser)return;
        if(role.exists() && ['owner','editor'].includes(role.data()?.role)){showEditor(user);}
        else showGate('This Google account is signed in, but has not been approved as an editor. Copy the UID below and ask the project owner to add admins/{UID} with role owner or editor in Firebase Firestore.',user);
      }catch(err){showGate('Could not check access: '+err.message+'. Verify Firestore security rules are installed.',user);}
    });
  }catch(err){showGate('Firebase could not start: '+err.message+'. Check firebase-config.js and browser connectivity.');}
}
initialize();
