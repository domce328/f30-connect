import {setupPhotoSettings} from './personalize.js';
import {api,connect,setupConnectionUI,hasSession} from './flespi-direct.js';
/* F30 Connect — privacy-first, framework-free PWA. Real Flespi data only. */
const el=id=>document.getElementById(id);
const state={device:null,telemetry:{},history:[],range:1,screen:'dashboard',lastHistoryFrom:0,historyTruncated:false,online:false,user:'',pendingAction:null,loading:false};
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>{const v=Number(x);return x===null||x===undefined||x===''||!Number.isFinite(v)?null:v;};
const fmtDate=ts=>ts?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Vilnius'}).format(ts*1000):'—';
const fmtTime=ts=>ts?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Vilnius'}).format(ts*1000):'—';
const fmtAgo=ts=>{if(!ts)return 'No timestamp';let seconds=Math.max(0,Math.round(Date.now()/1000-ts));return seconds<60?'just now':seconds<3600?`${Math.floor(seconds/60)} min ago`:seconds<86400?`${Math.floor(seconds/3600)} h ago`:`${Math.floor(seconds/86400)} days ago`;};
const fmtN=(v,d=1)=>n(v)===null?'—':Number(v).toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const setText=(id,value)=>{const node=el(id);if(node)node.textContent=String(value);};
const truth=x=>x===true||x===1||x==='1'||x==='true';
function notice(text){el('notice').hidden=!text;el('notice').textContent=text||'';}
function result(id,text){const target=el(id);target.hidden=!text;target.textContent=text||'';}
const tele=k=>state.telemetry?.[k]?.value;
const teleTime=k=>state.telemetry?.[k]?.ts;
function first(keys){for(const k of keys) if(tele(k)!==undefined&&tele(k)!==null)return {value:tele(k),ts:teleTime(k)};return {value:null,ts:null};}
function metric(valueId,timeId,keys,format){const {value,ts}=first(keys);setText(valueId,value===null?'—':format(value));setText(timeId,ts?fmtAgo(ts):'No reading');}
// Six stable home cards. Labels and selections are local UI preferences, never tracker configuration.
const QUICK_METRIC_KEY='f30-connect-quick-metrics-v1';
const QUICK_DEFAULTS=[
  {key:'external.powersource.voltage',label:'External Voltage'},
  {key:'engine.ignition.status',label:'Ignition'},
  {key:'can.engine.rpm',label:'CAN Engine Speed'},
  {key:'position.speed',label:'GPS Speed'},
  {key:'can.vehicle.odometer',label:'CAN Odometer'},
  {key:'gsm.signal.level',label:'GSM Signal'}
];
function loadQuickMetrics(){
  try{
    const raw=JSON.parse(localStorage.getItem(QUICK_METRIC_KEY)||'null');
    if(!Array.isArray(raw)||raw.length!==6)return QUICK_DEFAULTS.map(x=>({...x}));
    return raw.map((x,i)=>({key:typeof x?.key==='string'&&x.key.length<=160?x.key:QUICK_DEFAULTS[i].key,label:typeof x?.label==='string'?x.label.slice(0,48):QUICK_DEFAULTS[i].label}));
  }catch{return QUICK_DEFAULTS.map(x=>({...x}));}
}
let quickMetrics=loadQuickMetrics();
function fallbackLabel(key){return String(key||'Unused').replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function formatQuickValue(key,raw){
  if(raw===null||raw===undefined)return {value:'—',unit:''};
  if(key==='engine.ignition.status')return {value:truth(raw)?'ON':'OFF',unit:''};
  if(typeof raw==='boolean')return {value:raw?'TRUE':'FALSE',unit:''};
  const units={'external.powersource.voltage':'V','external.battery.voltage':'V','battery.voltage':'V','can.engine.rpm':'RPM','position.speed':'km/h','can.vehicle.speed':'km/h'};
  const unit=units[key]||'';
  if(typeof raw==='number'&&Number.isFinite(raw)){
    const digits=/voltage/.test(key)?3:/latitude|longitude/.test(key)?5:/speed|rpm/.test(key)?0:2;
    return {value:raw.toLocaleString('en-GB',{maximumFractionDigits:digits}),unit};
  }
  if(typeof raw==='string')return {value:raw.slice(0,80)||'—',unit};
  return {value:JSON.stringify(raw).slice(0,80),unit};
}
function renderQuickMetrics(){
  quickMetrics.forEach((item,i)=>{
    const k=item.key,reading=state.telemetry?.[k],isPresent=reading&&Object.prototype.hasOwnProperty.call(reading,'value');
    const {value,unit}=formatQuickValue(k,isPresent?reading.value:null);
    setText(`quickMetricTitle${i+1}`,(item.label.trim()||fallbackLabel(k)).toUpperCase());
    setText(`quickMetricValue${i+1}`,value);
    setText(`quickMetricUnit${i+1}`,unit);
    setText(`quickMetricTime${i+1}`,isPresent&&reading.ts?fmtAgo(reading.ts):'No recent reading');
  });
}
function renderQuickMetricSettings(){
  const container=el('quickMetricsSettings');if(!container)return;
  const allKeys=Object.keys(state.telemetry||{}).sort((a,b)=>a.localeCompare(b));
  const keys=[...new Set([...allKeys,...quickMetrics.map(x=>x.key).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  container.innerHTML=quickMetrics.map((item,i)=>`<div class="quick-settings-row">
    <div class="quick-settings-heading">Card ${i+1}</div>
    <label class="field-label" for="quickKey${i}">Raw telemetry parameter</label>
    <select class="filter-input" id="quickKey${i}" data-quick-key="${i}">
      <option value="">— No parameter —</option>
      ${keys.map(k=>`<option value="${esc(k)}"${k===item.key?' selected':''}>${esc(k)}${allKeys.includes(k)?'':' (not in latest telemetry)'}</option>`).join('')}
    </select>
    <label class="field-label" for="quickLabel${i}">Displayed name (optional)</label>
    <input class="filter-input" id="quickLabel${i}" maxlength="48" placeholder="e.g. Battery voltage" value="${esc(item.label)}" autocomplete="off">
  </div>`).join('');
  const msg=el('quickMetricsStatus');
  if(!allKeys.length){msg.hidden=false;msg.textContent='No telemetry loaded yet. Connect to Flespi, then return here to see available parameter names.';}
  else{msg.hidden=true;msg.textContent='';}
}
function saveQuickMetrics(){
  const result=QUICK_DEFAULTS.map((defaultItem,i)=>({
    key:el(`quickKey${i}`).value,
    label:el(`quickLabel${i}`).value.trim().slice(0,48)
  }));
  try{localStorage.setItem(QUICK_METRIC_KEY,JSON.stringify(result));}
  catch{const msg=el('quickMetricsStatus');msg.hidden=false;msg.textContent='Could not save card settings in this browser.';return;}
  quickMetrics=result;renderQuickMetrics();
  const msg=el('quickMetricsStatus');msg.hidden=false;msg.textContent='Saved. The six Home screen cards now use your selected telemetry fields and names.';
}
function renderStatus(){const pill=el('statusChip');pill.className='status-pill '+(state.device?' '+(state.online?'live':'offline'):'error');pill.querySelector('span').textContent=state.device?(state.online?'Connected':'Offline'):'Not ready';}

function currentVehicleVisualState(){
  if(!state.online)return 'sleeping';
  const ignition=truth(first(['engine.ignition.status']).value)||(n(first(['can.engine.rpm']).value)||0)>0;
  return ignition?'ignition':'online';
}
function renderHeroVisual(){
  const scene=el('carFrontScene');
  if(!scene)return;
  const visual=currentVehicleVisualState();
  scene.classList.remove('state-sleeping','state-online','state-ignition');
  scene.classList.add(`state-${visual}`);
  const caption=el('vehicleStateText');
  if(caption)caption.textContent=visual==='ignition'?'Ignition ON · short beams + angel eyes':'online'===visual?'Online · angel eyes active':'Sleeping / offline';
}
function renderDashboard(){
  state.online=state.device?.connected===true;
  renderStatus();
  renderHeroVisual();
  renderQuickMetrics();
  const lat=n(first(['position.latitude']).value),lon=n(first(['position.longitude']).value);
  const loc=el('locationText');loc.textContent=lat!==null&&lon!==null?`${lat.toFixed(5)}, ${lon.toFixed(5)}`:'Location unavailable';
  const map=el('lastLocationMap');map.hidden=lat===null||lon===null;if(!map.hidden)map.dataset.point=`${lat},${lon}`;
  const lastSeen=state.device?.last_active||first(['server.timestamp','timestamp']).value;
  setText('lastSeen',fmtAgo(n(lastSeen)));
  if(!state.device)notice('No device data loaded. Open Flespi connection and unlock your token.');else notice('');
  renderDeviceDetails();renderTelemetry();renderChart();
}
async function loadDashboard(){el('refreshDashboard').disabled=true;try{const data=await api('/api/dashboard');state.device=data.device;state.telemetry=data.telemetry||{};state.user=data.user||'';renderDashboard();}catch(err){state.device=null;renderStatus();notice(err.message);}finally{el('refreshDashboard').disabled=false;}}
function recentVoltage(){return state.history.filter(m=>n(m['external.powersource.voltage'])!==null&&n(m.timestamp)!==null).sort((a,b)=>a.timestamp-b.timestamp).map(m=>({t:m.timestamp,v:n(m['external.powersource.voltage'])}));}
function renderChart(){const pts=recentVoltage().filter(p=>p.t>=Date.now()/1000-86400);const box=el('batteryChart');if(pts.length<2){box.innerHTML='<div class="empty-chart">Waiting for at least two voltage readings</div>';return;}
  const data=pts.length>250?pts.filter((_,i)=>i%Math.ceil(pts.length/250)===0):pts;
  const min=Math.min(...data.map(x=>x.v)),max=Math.max(...data.map(x=>x.v));const pad=Math.max(.06,(max-min)*.15);const lo=min-pad,hi=max+pad;
  const W=460,H=160,L=30,R=8,T=10,B=25;
  const x=t=>L+(t-data[0].t)/(data.at(-1).t-data[0].t||1)*(W-L-R);
  const y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  const d=data.map((p,i)=>`${i?'L':'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area=`${d} L${x(data.at(-1).t).toFixed(1)},${H-B} L${x(data[0].t).toFixed(1)},${H-B} Z`;
  const ticks=[0,.5,1].map(f=>lo+(hi-lo)*f);
  const lines=ticks.map(v=>`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="0" y="${y(v)+3}">${v.toFixed(2)}</text>`).join('');
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" aria-label="Voltage line chart" role="img">${lines}<path class="chart-area" d="${area}"/><path class="chart-path" d="${d}"/><circle class="last-dot" cx="${x(data.at(-1).t)}" cy="${y(data.at(-1).v)}" r="4"/><text x="${L}" y="${H-5}">${esc(fmtTime(data[0].t))}</text><text x="${W-R}" y="${H-5}" text-anchor="end">${esc(fmtTime(data.at(-1).t))}</text></svg>`;
}
async function loadHistory(days=1){if(state.loading)return;state.loading=true;const now=Math.floor(Date.now()/1000);const from=now-days*86400;const url=`/api/history?from=${from}&to=${now}`;el('refreshTrips').disabled=true;el('refreshEvents').disabled=true;
  try{const data=await api(url);state.history=(data.messages||[]).slice().sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));state.lastHistoryFrom=from;state.historyTruncated=!!data.truncated;renderChart();renderTrips();renderEvents();}
  catch(err){el('tripsList').innerHTML=`<div class="empty-state">${esc(err.message)}</div>`;el('eventsList').innerHTML=`<div class="empty-state">${esc(err.message)}</div>`;}
  finally{state.loading=false;el('refreshTrips').disabled=false;el('refreshEvents').disabled=false;}}
function distance(a,b){const r=Math.PI/180,lat1=a.lat*r,lat2=b.lat*r,dLat=lat2-lat1,dLon=(b.lon-a.lon)*r;const q=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
function pos(m){const lat=n(m['position.latitude']),lon=n(m['position.longitude']);if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||(!lat&&!lon))return null;return {lat,lon,t:n(m.timestamp),speed:n(m['position.speed'])||0};}
function analyzeTrips(messages){
  const positions=messages.map(pos).filter(Boolean).sort((a,b)=>a.t-b.t);const out=[];let current=[];
  function flush(){if(current.length<3){current=[];return;}
    const duration=current.at(-1).t-current[0].t;
    let km=0;for(let i=1;i<current.length;i++){const dt=current[i].t-current[i-1].t;const segment=distance(current[i-1],current[i]);if(dt<=900&&dt>0&&segment/(dt/3600)<210)km+=segment;}
    if(duration>=150&&km>=.4)out.push({start:current[0].t,end:current.at(-1).t,km,top:Math.max(...current.map(x=>x.speed)),pts:current});current=[];
  }
  for(const p of positions){const last=current.at(-1);if(last&&(p.t-last.t>720||(p.speed<4&&last.speed<4&&p.t-last.t>150)))flush();
    // Stationary observations should not create spurious trips. A first stationary point can anchor a journey.
    if(p.speed>=5||current.length&&p.t-current.at(-1).t<180) current.push(p);
    else if(!current.length)current=[p];
  }flush();return out.reverse();
}
function routeSvg(points){const valid=points.filter(Boolean);if(valid.length<2)return '';
  const minLat=Math.min(...valid.map(p=>p.lat)),maxLat=Math.max(...valid.map(p=>p.lat)),minLon=Math.min(...valid.map(p=>p.lon)),maxLon=Math.max(...valid.map(p=>p.lon));const dlat=maxLat-minLat||.01,dlon=maxLon-minLon||.01;
  const xy=p=>[(16+(p.lon-minLon)/dlon*328).toFixed(1),(75-(p.lat-minLat)/dlat*66).toFixed(1)];const path=valid.map((p,i)=>`${i?'L':'M'}${xy(p).join(' ')}`).join(' ');
  return `<svg viewBox="0 0 360 83" role="img" aria-label="Relative route sketch, not a street map"><path d="${path}"/><circle cx="${xy(valid[0])[0]}" cy="${xy(valid[0])[1]}" r="4"/><circle cx="${xy(valid.at(-1))[0]}" cy="${xy(valid.at(-1))[1]}" r="4"/></svg>`;
}
function renderTrips(){const trips=analyzeTrips(state.history);const dist=trips.reduce((t,v)=>t+v.km,0);setText('tripTotal',`${fmtN(dist,1)} km`);setText('tripCount',`${trips.length} detected trip${trips.length===1?'':'s'}`);
  if(!trips.length){el('tripsList').innerHTML='<div class="empty-state">No completed trips identified in the selected range.</div>';return;}
  el('tripsList').innerHTML=trips.map((t,i)=>`<article class="trip-item"><div class="item-head"><b>${esc(fmtDate(t.start))} → ${esc(fmtTime(t.end))}</b><span>${fmtN(t.km,1)} km</span></div><div class="route-preview">${routeSvg(t.pts)}</div><div class="trip-badges"><span>Duration ${Math.round((t.end-t.start)/60)} min</span><span>Peak GNSS ${fmtN(t.top,0)} km/h</span></div><div class="item-secondary">Route sketch is approximate. Tap the destination to view it in Maps.</div><button class="map-button" data-point="${t.pts.at(-1).lat},${t.pts.at(-1).lon}">Open destination in Apple Maps ↗</button></article>`).join('');
  if(state.historyTruncated)el('tripsList').insertAdjacentHTML('beforeend','<div class="notice">History limit reached: some trips may be missing. Try a shorter range.</div>');
}
function eventsFromMessages(messages){const matches=[];let last=-Infinity;let previousCounter=null;
  for(const m of messages){const ts=n(m.timestamp);if(ts===null)continue;
    const code=n(m['crash.event.enum']);const triggerCode=code!==null&&code!==0&&code!==5;
    const count=n(m['crash.events.number']);const increased=count!==null&&previousCounter!==null&&count>previousCounter;
    if(count!==null)previousCounter=count;
    const occurred=triggerCode||(truth(m['crash.event'])&&code!==5)||increased;
    if(!occurred||ts-last<45)continue;last=ts;
    matches.push({ts,code,count,speed:n(m['position.speed']),lat:n(m['position.latitude']),lon:n(m['position.longitude']),impact:n(m['crash.impact.acceleration'])});
  }return matches.reverse();
}
function renderEvents(){const events=eventsFromMessages(state.history);setText('eventsCount',events.length);setText('eventsRange',`${state.range}-day history window`);
  if(!events.length){el('eventsList').innerHTML='<div class="empty-state">No crash scenario triggers found in the selected range.</div>';return;}
  el('eventsList').innerHTML=events.map((e,i)=>`<article class="event-item"><div class="item-head"><b><span class="event-icon">⚠</span> Detection ${events.length-i}</b><span>${esc(fmtDate(e.ts))}</span></div><div class="item-secondary">${e.code===7?'Device classified as road shock / pothole': 'Crash scenario triggered — collision not confirmed'}${e.code!==null?` · Event code ${e.code}`:''}</div><div class="trip-badges"><span>GNSS ${e.speed===null?'—':fmtN(e.speed,0)} km/h</span>${e.impact!==null?`<span>Impact ${fmtN(e.impact,2)} g</span>`:''}${e.count!==null?`<span>Counter ${esc(e.count)}</span>`:''}</div>${e.lat!==null&&e.lon!==null?`<button class="map-button" data-point="${e.lat},${e.lon}">View detection location ↗</button>`:''}</article>`).join('');
  if(state.historyTruncated)el('eventsList').insertAdjacentHTML('beforeend','<div class="notice">History is truncated. Event count may be incomplete.</div>');
}
function renderDeviceDetails(){const d=state.device;const rows=[['Flespi device ID',d?.id],['Name',d?.name],['Connection',d?state.online?'TCP connected':'Disconnected':'—'],['Last connection activity',d?.last_active?fmtDate(d.last_active):'—'],['User',state.user||'—'],['CAN engine RPM',first(['can.engine.rpm']).value],['CAN program',first(['can.program.number']).value]];el('deviceDetails').innerHTML=rows.map(([k,v])=>`<div class="detail-row"><span>${esc(k)}</span><strong>${esc(v??'—')}</strong></div>`).join('');}
function renderTelemetry(){const q=el('telemetryFilter').value.toLowerCase();const keys=Object.keys(state.telemetry||{}).filter(k=>k.toLowerCase().includes(q)).sort();el('rawTelemetry').innerHTML=keys.length?keys.slice(0,200).map(k=>{const v=state.telemetry[k]||{};return `<div class="detail-row"><span title="${esc(k)}">${esc(k)}</span><strong>${esc(typeof v.value==='object'?JSON.stringify(v.value):v.value)}<br><small style="color:#8097b0;font-weight:400">${esc(fmtAgo(v.ts))}</small></strong></div>`;}).join(''):'<div class="empty-state">No matching telemetry values</div>';}
async function refreshCommands(){
  el('refreshCommands').disabled=true;
  try{
    const data=await api('/api/command-status');
    const rows=[...(data.pending||[]).map(v=>({...v,status:'Queued'})),
      ...(data.completed||[]).map(v=>({...v,status:v.executed?'Device replied':'Processed / unconfirmed'}))]
      .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    const entries=rows.slice(0,20).map(v=>{
      const response=v.response===null||v.response===undefined?'':String(v.response);
      const reply=response?`<div style="margin-top:7px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;color:#bde8fc;max-height:180px;overflow:auto">${esc(response.slice(0,3000))}</div>`:'';
      return `<div class="detail-row"><span>${esc(v.meta?.kind||v.meta?.action||v.name||'Command')} · ${esc(fmtDate(v.timestamp))}</span><strong>${esc(v.status)}${reply}</strong></div>`;
    }).join('');
    const warnings=(data.warnings||[]).map(x=>`<div class="notice" style="margin:8px 0">${esc(x)}</div>`).join('');
    const empty='<div class="empty-state">No F30 Connect command results returned yet. Check again after device execution.</div>';
    el('commandHistory').innerHTML=(entries||empty)+warnings;
  }catch(err){el('commandHistory').textContent=err.message;}
  finally{el('refreshCommands').disabled=false;}
}
async function diagnostic(key){const button=document.querySelector(`[data-diag="${key}"]`);button.disabled=true;result('diagnosticResult','Submitting read-only diagnostic…');try{const data=await api('/api/diagnostic',{method:'POST',body:JSON.stringify({key})});result('diagnosticResult',`Queued successfully. ID: ${data.command?.id??'not returned'}. Wait for the next device connection, then refresh command history.`);await refreshCommands();}catch(err){result('diagnosticResult',err.message);}finally{button.disabled=false;}}
function openConfirm(action){state.pendingAction=action;setText('dialogTitle',action==='lock'?'Lock BMW doors?':'Unlock BMW doors?');setText('dialogIcon',action==='lock'?'🔒':'🔓');setText('confirmWord',action.toUpperCase());setText('dialogDesc',action==='unlock'?'Unlocking grants access to the vehicle. This sends an immediate GPRS command only while the tracker is connected. No queued unlocking.':'This sends a door lock command only while the tracker is connected. It will not be queued for later.');el('confirmInput').value='';el('dialogSubmit').disabled=true;el('commandDialog').showModal();el('confirmInput').focus();}
async function executeAction(){const action=state.pendingAction;if(!action)return;el('dialogSubmit').disabled=true;el('commandDialog').close();result('remoteResult',`Sending ${action} command…`);
  try{const data=await api('/api/action',{method:'POST',body:JSON.stringify({action,confirm:action.toUpperCase()})});
    if(data.blocked) result('remoteResult',data.reason);
    else result('remoteResult',`Device response: ${data.command?.response||'Command accepted; no explicit response shown.'}\n${data.note}`);
  }catch(err){result('remoteResult',`Command NOT confirmed: ${err.message}`);}
  finally{state.pendingAction=null;await loadDashboard();}}
function navigate(name){state.screen=name;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===`${name}Screen`));document.querySelectorAll('.bottom-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.nav===name);if(b.dataset.nav===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});window.scrollTo({top:0,behavior:'smooth'});if(name==='diagnostics')refreshCommands();if(name==='settings')renderQuickMetricSettings();}
function exportCsv(filename,rows){
  if(!rows.length){alert('No records in the currently loaded period.');return;}
  const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
  const cell=value=>`"${String(value??'').replace(/"/g,'""')}"`;
  const body=[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const savedShortcutsKey='f30-connect-read-shortcuts-v1';
let pendingWrite=null;
function isReadCommand(text){
  const v=String(text||'').trim();
  return /^(getinfo|getstatus)$/i.test(v)||/^getparam [0-9]{1,6}(?:\s*;\s*[0-9]{1,6}){0,29}$/i.test(v)||/^readio [0-9]{1,6}$/i.test(v);
}
function isWriteCommand(text){return /^setparam [0-9]{1,6}:[+-]?[0-9]{1,12}(?:\s*;\s*[0-9]{1,6}:[+-]?[0-9]{1,12}){0,15}$/i.test(String(text||'').trim());}
function readShortcuts(){try{const v=JSON.parse(localStorage.getItem(savedShortcutsKey)||'[]');return Array.isArray(v)?v.filter(isReadCommand).slice(0,8):[];}catch{return [];}}
function renderShortcuts(){const list=readShortcuts();const box=el('savedShortcuts');box.hidden=!list.length;
  box.innerHTML=list.length?`<div class="field-label">Saved read commands</div><div class="console-shortcuts">${list.map((v,i)=>`<button type="button" data-saved="${i}" title="${esc(v)}">${esc(v)}</button>`).join('')}</div><button class="inline-link" id="clearShortcuts" type="button">Clear saved shortcuts</button>`:'';
  box.querySelectorAll('[data-saved]').forEach(b=>b.addEventListener('click',()=>{el('customCommand').value=list[Number(b.dataset.saved)];commandChanged();}));
  box.querySelector('#clearShortcuts')?.addEventListener('click',()=>{try{localStorage.removeItem(savedShortcutsKey);}catch{}renderShortcuts();});
}
function commandChanged(){el('saveCommandShortcut').disabled=!isReadCommand(el('customCommand').value);}
function openWriteConfirm(text){pendingWrite=text.trim().replace(/\s*;\s*/g,';');el('writePreview').textContent=pendingWrite;el('writeConfirmInput').value='';el('writeSubmit').disabled=true;el('writeDialog').showModal();el('writeConfirmInput').focus();}
async function submitCustom(text,write=false){
  const btn=el('sendCustomCommand');btn.disabled=true;
  result('customCommandResult',write?'Sending confirmed configuration write…':'Submitting read command…');
  try{
    const body={text,...(write?{confirm:'APPLY',confirmCommand:text}:{})};
    const data=await api('/api/custom-command',{method:'POST',body:JSON.stringify(body)});
    if(data.blocked)result('customCommandResult',data.reason);
    else result('customCommandResult',`${write?'Command sent':'Read command queued'}. ID: ${data.command?.id??'not provided'}.\n${data.command?.response?'Response: '+JSON.stringify(data.command.response)+'\n':''}${data.note}`);
    if(write){el('customCommand').value='';commandChanged();}
    await refreshCommands();
  }catch(err){result('customCommandResult',`Command not confirmed: ${err.message}`);}
  finally{btn.disabled=false;}
}
function bind(){document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.nav)));
  el('refreshDashboard').addEventListener('click',async()=>{await loadDashboard();await loadHistory(state.range);});
  el('refreshTrips').addEventListener('click',()=>loadHistory(state.range));el('refreshEvents').addEventListener('click',()=>loadHistory(state.range));
  document.querySelectorAll('[data-range]').forEach(btn=>btn.addEventListener('click',()=>{const days=Number(btn.dataset.range);state.range=days;document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('selected',x===btn));loadHistory(days);}));
  document.querySelectorAll('[data-command]').forEach(btn=>btn.addEventListener('click',()=>openConfirm(btn.dataset.command)));
  el('confirmInput').addEventListener('input',e=>el('dialogSubmit').disabled=e.target.value.trim().toUpperCase()!==state.pendingAction?.toUpperCase());
  el('dialogSubmit').addEventListener('click',executeAction);el('commandDialog').addEventListener('close',()=>{state.pendingAction=null;});
  document.querySelectorAll('[data-diag]').forEach(btn=>btn.addEventListener('click',()=>diagnostic(btn.dataset.diag)));
  el('refreshCommands').addEventListener('click',refreshCommands);el('refreshDiagnostics').addEventListener('click',loadDashboard);
  el('openSettings').addEventListener('click',()=>navigate('settings'));
  el('openConnection').addEventListener('click',()=>setupConnectionUI(true));
  el('backFromSettings').addEventListener('click',()=>navigate('dashboard'));
  el('quickMetricsForm').addEventListener('submit',e=>{e.preventDefault();saveQuickMetrics();});
  el('resetQuickMetrics').addEventListener('click',()=>{quickMetrics=QUICK_DEFAULTS.map(x=>({...x}));try{localStorage.removeItem(QUICK_METRIC_KEY);}catch{}renderQuickMetricSettings();renderQuickMetrics();const msg=el('quickMetricsStatus');msg.hidden=false;msg.textContent='Restored the six default dashboard cards.';});
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{el('customCommand').value=button.dataset.preset;commandChanged();el('customCommand').focus();}));
  el('customCommand').addEventListener('input',commandChanged);
  el('saveCommandShortcut').addEventListener('click',()=>{
    const command=el('customCommand').value.trim();if(!isReadCommand(command))return;
    const list=[command,...readShortcuts().filter(c=>c!==command)].slice(0,8);
    try{localStorage.setItem(savedShortcutsKey,JSON.stringify(list));}catch{}
    renderShortcuts();result('customCommandResult','Read-only shortcut saved in this browser.');
  });
  el('sendCustomCommand').addEventListener('click',()=>{
    const command=el('customCommand').value.trim();if(!command){result('customCommandResult','Enter or select a command first.');return;}
    if(isWriteCommand(command))return openWriteConfirm(command);
    if(isReadCommand(command))return submitCustom(command);
    result('customCommandResult','Unsupported command. Use getinfo, getstatus, getparam IDs, readio ID, or numeric setparam ID:VALUE.');
  });
  el('writeConfirmInput').addEventListener('input',e=>{el('writeSubmit').disabled=e.target.value.trim()!=='APPLY';});
  el('writeDialog').addEventListener('close',()=>{pendingWrite=null;});
  el('writeSubmit').addEventListener('click',()=>{
    const command=pendingWrite;if(!command)return;
    el('writeDialog').close();submitCustom(command,true);
  });
  renderShortcuts();
  el('telemetryFilter').addEventListener('input',renderTelemetry);
  el('exportHistory').addEventListener('click',()=>exportCsv('f30-telemetry-history.csv',state.history));
  el('exportEvents').addEventListener('click',()=>exportCsv('f30-crash-events.csv',eventsFromMessages(state.history)));
  document.addEventListener('click',e=>{const b=e.target.closest('[data-point]');if(!b)return;const pts=b.dataset.point.split(',').map(Number);if(pts.length!==2||pts.some(x=>!Number.isFinite(x)))return;const url=`https://maps.apple.com/?ll=${pts[0]},${pts[1]}&q=Vehicle%20location`;window.open(url,'_blank','noopener,noreferrer');});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadDashboard();});
  setInterval(()=>{if(document.visibilityState==='visible'&&state.screen==='dashboard')loadDashboard();},90000);
}
async function boot(){bind();setupPhotoSettings().catch(err=>console.warn('Photo settings:',err));connect(async()=>{await loadDashboard();await loadHistory(1);});if(hasSession()){await loadDashboard();await loadHistory(1);}if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
boot();
export const __test={eventsFromMessages,analyzeTrips,distance,routeSvg};
