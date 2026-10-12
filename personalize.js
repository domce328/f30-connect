/* Browser-side photo personalization. IndexedDB (local), optional private R2 sync. */
const PHOTO_KEYS=['portrait','landscape'];
const STORE='photos';
const key='f30-connect-appearance-v1';
let dbPromise=null;
let cached={portrait:null,landscape:null};
let objectUrls={portrait:null,landscape:null};
const cloudEnabled=false;
let settings={placement:'both',dim:76,blur:6};
const el=id=>document.getElementById(id);
function db(){
  if(!('indexedDB' in globalThis))return Promise.reject(new Error('IndexedDB unsupported'));
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('f30-connect-photos',1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function localRead(kind){
  const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readonly');const request=tx.objectStore(STORE).get(kind);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});
}
async function localPut(kind,blob){
  const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite');tx.objectStore(STORE).put(blob,kind);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function localRemove(kind){
  const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(kind);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
function report(msg){const node=el('photoResult');node.textContent=msg;node.hidden=!msg;}
function urlOf(kind,blob){
  if(objectUrls[kind])URL.revokeObjectURL(objectUrls[kind]);
  objectUrls[kind]=blob?URL.createObjectURL(blob):null;
  cached[kind]=blob;
  const preview=el(`${kind}Preview`);
  preview.style.backgroundImage=objectUrls[kind]?`url("${objectUrls[kind]}")`:'';
  preview.classList.toggle('ready',!!blob);
  preview.querySelector('span').textContent=blob?(kind==='portrait'?'Phone photo ready':'Desktop photo ready'):(kind==='portrait'?'No phone photo selected':'No desktop photo selected');
  refreshPhoto();
}
function isPhone(){
  // Keep phone portrait photo even if iPhone is rotated to landscape.
  const shortSide=Math.min(screen.width||innerWidth,screen.height||innerHeight);
  return (matchMedia('(pointer: coarse)').matches && shortSide<650) || innerWidth<720;
}
function refreshPhoto(){
  const kind=isPhone()?'portrait':'landscape';
  const source=objectUrls[kind]||null;
  const body=document.body;
  body.style.setProperty('--f30-photo',source?`url("${source}")`:'none');
  body.style.setProperty('--photo-dim',(settings.dim/100).toFixed(2));
  body.style.setProperty('--photo-blur',`${settings.blur}px`);
  body.classList.toggle('photo-hero',!!source && ['hero','both'].includes(settings.placement));
  body.classList.toggle('photo-wallpaper',!!source && ['wallpaper','both'].includes(settings.placement));
  setText('photoStorageStatus',`${cloudEnabled?'Private cloud photo sync enabled':'Photos saved only in this browser'} · ${isPhone()?'Phone / portrait':'Desktop / landscape'} layout active. ${source?'Personal photo loaded.':'No photo uploaded for this layout.'}`);
}
function setText(id,value){const node=el(id);if(node)node.textContent=value;}
function saveSettings(){try{localStorage.setItem(key,JSON.stringify(settings));}catch{}refreshPhoto();}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s&&['hero','both','wallpaper'].includes(s.placement)&&Number.isFinite(s.dim)&&Number.isFinite(s.blur)){
    settings={placement:s.placement,dim:Math.max(35,Math.min(92,s.dim)),blur:Math.max(0,Math.min(20,s.blur))};
  }}catch{}
  el('photoPlacement').value=settings.placement;el('photoDim').value=settings.dim;el('photoBlur').value=settings.blur;
  setText('photoDimValue',`${settings.dim}%`);setText('photoBlurValue',`${settings.blur} px`);
}
function loadImage(file){return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);const image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This image format cannot be decoded by your browser. Try a JPEG or PNG.'));};
  image.src=url;
});}
async function resizePhoto(file,kind){
  if(!file || !file.type.startsWith('image/'))throw new Error('Choose a photo file.');
  if(file.size>20*1024*1024)throw new Error('Choose a photo under 20 MB.');
  const image=await loadImage(file);
  const maxWidth=kind==='portrait'?1440:1920,maxHeight=kind==='portrait'?2160:1440;
  const factor=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas rendering not supported');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  let blob=null;
  for(const q of [.87,.75,.62]){
    blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));
    if(blob && blob.size<=4*1024*1024)break;
  }
  if(!blob || blob.size>5*1024*1024)throw new Error('Image is too large after compression.');
  return blob;
}
async function upload(kind,file){
  report('Preparing photo…');
  const blob=await resizePhoto(file,kind);
  try{await localPut(kind,blob);}catch(err){throw new Error(`Local photo storage unavailable: ${err.message}`);}
  urlOf(kind,blob);
  report(`${kind==='portrait'?'Portrait':'Landscape'} photo saved in this browser.`);
}
async function remove(kind){
  try{await localRemove(kind);}catch(err){report(`Local removal failed: ${err.message}`);return;}
  urlOf(kind,null);
  report(`Removed ${kind} photo from this browser.`);
}
export async function setupPhotoSettings(){
  loadSettings();
  for(const kind of PHOTO_KEYS){
    el(kind==='portrait'?'uploadPortrait':'uploadLandscape').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{await upload(kind,file);}catch(err){report(err.message);}finally{e.target.value='';}
    });
    el(kind==='portrait'?'removePortrait':'removeLandscape').addEventListener('click',()=>remove(kind));
    try{const blob=await localRead(kind);if(blob)urlOf(kind,blob);}catch{};
  }
  el('photoPlacement').addEventListener('change',e=>{settings.placement=e.target.value;saveSettings();});
  el('photoDim').addEventListener('input',e=>{settings.dim=Number(e.target.value);setText('photoDimValue',`${settings.dim}%`);saveSettings();});
  el('photoBlur').addEventListener('input',e=>{settings.blur=Number(e.target.value);setText('photoBlurValue',`${settings.blur} px`);saveSettings();});
  window.addEventListener('resize',refreshPhoto);
  // Free/static edition: images remain stored in this browser only.
  refreshPhoto();
}
