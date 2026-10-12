/* F30 Connect Free Edition: direct Flespi browser access.
   Token encrypted at rest with a user passphrase. NO token is bundled or shared with the site host.
   Warning: browser runtime secrets are weaker than a vetted server-side backend and can be exposed by XSS/extensions.
*/
const STORAGE='f30-connect-flespi-credentials-v1';
const BASE='https://flespi.io';
let sessionToken=null, deviceId=null, readyCallback=null, bound=false;
const el=id=>document.getElementById(id);
const bytes=a=>Uint8Array.from(atob(a),c=>c.charCodeAt(0));
const b64=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer)));
const ascii=/^[\x20-\x7E]{12,256}$/;
const isDevice=x=>/^\d{1,16}$/.test(String(x));
function stored(){try{return JSON.parse(localStorage.getItem(STORAGE)||'null');}catch{return null;}}
export function hasSession(){return !!(sessionToken&&deviceId);}
async function keyFor(pass,salt){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(token,pass){
  const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFor(pass,salt);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(token));
  return {salt:b64(salt),iv:b64(iv),ciphertext:b64(encrypted)};
}
async function decrypt(config,pass){
  const key=await keyFor(pass,bytes(config.salt));
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(config.iv)},key,bytes(config.ciphertext));
  return new TextDecoder().decode(raw);
}
async function queryFlespi(path,init={},token=sessionToken){
  if(!token)throw new Error('No Flespi token unlocked. Open the connection dialog.');
  let response;
  try{response=await fetch(`${BASE}${path}`,{method:init.method||'GET',headers:{Authorization:`FlespiToken ${token}`,'Content-Type':'application/json'},body:init.body===undefined?undefined:JSON.stringify(init.body),cache:'no-store',signal:AbortSignal.timeout(init.timeout||45000)});}
  catch(err){throw new Error(`Cannot reach Flespi: ${err.message||'network or browser-origin restriction'}. Verify token Allowed origins for this website.`);}
  let value;try{value=await response.json();}catch{throw new Error(`Flespi returned non-JSON response (HTTP ${response.status})`);}
  if(!response.ok || (Array.isArray(value.errors)&&value.errors.length&&!value.result?.length)){
    throw new Error(`Flespi: ${String(value.errors?.[0]?.reason||value.reason||`HTTP ${response.status}`).slice(0,250)}`);
  }
  return value;
}
function endpoint(){if(!isDevice(deviceId))throw new Error('Invalid device ID');return `/gw/devices/${deviceId}`;}
async function liveDevice(){const r=await queryFlespi(`${endpoint()}?fields=id,name,connected,last_active`);return r.result?.[0]||null;}
function thin(m){const fields=['timestamp','server.timestamp','position.latitude','position.longitude','position.speed','position.direction','position.altitude','external.powersource.voltage','battery.voltage','engine.ignition.status','movement.status','can.engine.rpm','can.vehicle.speed','can.vehicle.mileage','can.vehicle.odometer','crash.event','crash.event.enum','crash.events.number','crash.impact.acceleration','crash.max.acceleration','crash.duration','gnss.satellites','gsm.signal.level'];const r={};for(const k of fields)if(m[k]!==undefined)r[k]=m[k];return r;}
async function sendNow(text,kind){
  const d=await liveDevice();if(!d||d.connected!==true)return {blocked:true,reason:'Tracker is offline. No command was sent or queued. Retry when the device connects.'};
  const r=await queryFlespi(`${endpoint()}/commands`,{method:'POST',body:[{name:'custom',properties:{text},timeout:15,meta:{app:'f30-connect',kind}}],timeout:30000});
  return {blocked:false,command:r.result?.[0]||null,note:'Real-time command only, never an offline queue. A device response does not independently verify the physical vehicle state.'};
}
function validateCommand(input){
  if(typeof input!=='string'||input.length>240||!input.trim()||/[^\x20-\x7e]/.test(input))throw new Error('One ASCII command, max 240 characters');
  const s=input.trim().replace(/[ \t]+/g,' ');
  if(/^(getinfo|getstatus)$/i.test(s))return {kind:'read',text:s.toLowerCase()};
  if(/^getparam [0-9]{1,6}(?:\s*;\s*[0-9]{1,6}){0,29}$/i.test(s)||/^readio [0-9]{1,6}$/i.test(s))return {kind:'read',text:s.replace(/\s*;\s*/g,';')};
  if(/^setparam [0-9]{1,6}:[+-]?[0-9]{1,12}(?:\s*;\s*[0-9]{1,6}:[+-]?[0-9]{1,12}){0,15}$/i.test(s))return {kind:'write',text:s.replace(/\s*;\s*/g,';')};
  throw new Error('Allowed: getinfo, getstatus, getparam IDs, readio ID, setparam ID:VALUE.');
}
async function queueRead(text,kind){
  const r=await queryFlespi(`${endpoint()}/commands-queue`,{method:'POST',body:[{name:'custom',properties:{text},ttl:600,max_attempts:1,meta:{app:'f30-connect',kind}}]});
  return {queued:true,command:r.result?.[0]||null,note:'Queued for up to ten minutes, pending device connectivity.'};
}
export async function api(route,opts={}){
  if(!hasSession())throw new Error('Connect to Flespi first. Use the connection button in the header.');
  const url=new URL(route,'https://app.local');const path=url.pathname;
  if(path==='/api/dashboard'){
    const [d,t]=await Promise.all([queryFlespi(`${endpoint()}?fields=id,name,connected,last_active`),queryFlespi(`${endpoint()}/telemetry`)]);
    return {device:d.result?.[0]||null,telemetry:t.result?.[0]?.telemetry||{},user:'This browser'};
  }
  if(path==='/api/history'){
    const now=Math.floor(Date.now()/1000),to=Number(url.searchParams.get('to')||now),from=Number(url.searchParams.get('from')||to-86400);
    if(!Number.isFinite(from)||!Number.isFinite(to)||from>=to||to>now+3600||to-from>7*86400)throw new Error('Invalid date range (maximum 7 days)');
    const query=encodeURIComponent(JSON.stringify({from:Math.floor(from),to:Math.floor(to),reverse:true,count:3500}));
    const r=await queryFlespi(`${endpoint()}/messages?data=${query}`);const msgs=Array.isArray(r.result)?r.result:[];
    return {messages:msgs.map(thin),from,to,truncated:msgs.length>=3500};
  }
  if(path==='/api/command-status'){
    const [p,c]=await Promise.all([queryFlespi(`${endpoint()}/commands-queue`),queryFlespi(`${endpoint()}/commands-result`)]);
    const own=x=>x?.meta?.app==='f30-connect';const clean=x=>({id:x.id,timestamp:x.timestamp,name:x.name,executed:x.executed,response:x.response??null,meta:x.meta??{},properties:x.properties??{}});
    return {pending:(p.result||[]).filter(own).slice(-15).map(clean),completed:(c.result||[]).filter(own).slice(-20).map(clean)};
  }
  if(opts.method!=='POST')throw new Error('Unsupported API operation');
  let body;try{body=JSON.parse(opts.body);}catch{throw new Error('Invalid JSON request body');}
  if(path==='/api/action'){
    if(!['lock','unlock'].includes(body?.action)||body.confirm!==body.action.toUpperCase())throw new Error('Type LOCK or UNLOCK to confirm');
    return sendNow(body.action==='lock'?'lvcanclosealldoors':'lvcanopenalldoors',body.action);
  }
  if(path==='/api/diagnostic'){
    const allowed={getinfo:'getinfo',getstatus:'getstatus',crashSettings:'getparam 11400;11401;11402;11406;11410;11412',sleepSettings:'getparam 101;102;103;1000;60110'};
    if(!allowed[body?.key])throw new Error('Unsupported diagnostic');return queueRead(allowed[body.key],body.key);
  }
  if(path==='/api/custom-command'){
    const spec=validateCommand(body?.text);
    if(spec.kind==='read')return {...(await queueRead(spec.text,'custom-read')),kind:'read'};
    if(body.confirm!=='APPLY'||body.confirmCommand!==spec.text)throw new Error('Configuration change requires APPLY and the original command');
    return {...(await sendNow(spec.text,'custom-write')),kind:'write'};
  }
  throw new Error('Unsupported request');
}
export function setupConnectionUI(force=false){
  const dialog=el('connectionDialog');if(!dialog)return;
  const config=stored();
  el('flespiToken').value='';el('flespiPassphrase').value='';el('connectError').hidden=true;
  el('flespiDeviceId').value=config?.deviceId||'9056049';
  el('connectMessage').textContent=config?'Enter your passphrase to unlock this browser, or enter a new restricted token to replace saved credentials.':'Paste a restricted token and choose a passphrase. The token is encrypted and stored only in this browser.';
  el('saveConnection').textContent=config?'Unlock / Replace':'Connect';
  if(!dialog.open)dialog.showModal();
}
export function connect(callback){
  readyCallback=callback;
  if(!bound){bound=true;
    el('closeConnection').addEventListener('click',()=>el('connectionDialog').close());
    el('forgetConnection').addEventListener('click',()=>{
      if(!confirm('Remove the saved encrypted Flespi token from this browser?'))return;
      localStorage.removeItem(STORAGE);sessionToken=null;deviceId=null;el('flespiToken').value='';el('flespiPassphrase').value='';el('connectMessage').textContent='Saved credentials removed. Create a new restricted Flespi token connection.';el('saveConnection').textContent='Connect';
    });
    el('saveConnection').addEventListener('click',async()=>{
      const button=el('saveConnection'),error=el('connectError');button.disabled=true;error.hidden=true;
      try{
        if(!globalThis.crypto?.subtle)throw new Error('Secure HTTPS required for encrypted credentials');
        const config=stored(),enteredToken=el('flespiToken').value.trim(),pass=el('flespiPassphrase').value,id=el('flespiDeviceId').value.trim();
        if(!isDevice(id))throw new Error('Device ID must contain digits only');
        if(pass.length<10)throw new Error('Passphrase must be at least 10 characters');
        let token;
        if(enteredToken){if(!ascii.test(enteredToken))throw new Error('Token contains invalid characters');token=enteredToken;}
        else {if(!config)throw new Error('Paste a restricted Flespi token');if(id!==config.deviceId)throw new Error('To change device ID, enter a new restricted token');try{token=await decrypt(config,pass);}catch{throw new Error('Incorrect passphrase or damaged local credentials');}}
        const test=await queryFlespi(`/gw/devices/${id}?fields=id,name,connected,last_active`,{},token);
        if(!test.result?.length)throw new Error('Token cannot access this device ID. Check Flespi ACL.');
        if(enteredToken){const secured=await encrypt(token,pass);localStorage.setItem(STORAGE,JSON.stringify({deviceId:id,...secured}));}
        sessionToken=token;deviceId=id;
        el('flespiToken').value='';el('flespiPassphrase').value='';el('connectionDialog').close();
        if(readyCallback)await readyCallback();
      }catch(ex){error.textContent=String(ex.message||ex);error.hidden=false;}
      finally{button.disabled=false;}
    });
  }
  if(!hasSession())setupConnectionUI();
}
export const __test={validateCommand,thin,isDevice};
