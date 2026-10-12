const DEFAULT='external.powersource.voltage',STORAGE='f30-connect-graph-v1';
export const GAP_SECONDS=3600;
const units={'external.powersource.voltage':'V','battery.voltage':'V','external.battery.voltage':'V','can.engine.rpm':'RPM','position.speed':'km/h','can.vehicle.speed':'km/h'};
const labels={'external.powersource.voltage':'Vehicle battery','engine.ignition.status':'Ignition','can.engine.rpm':'Engine speed','position.speed':'GPS speed','can.vehicle.speed':'CAN speed','battery.voltage':'Tracker battery'};
const safeField=s=>typeof s==='string'&&s.length<=160&&/^[a-zA-Z0-9_.-]+$/.test(s)&&s!=='timestamp';
const numeric=v=>typeof v==='boolean'?Number(v):typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=t=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Vilnius'}).format(t*1000);
export function historyPoints(messages,field){
  let gap=false;const points=[];
  for(const m of [...messages].filter(m=>m&&Number.isFinite(m.timestamp)).sort((a,b)=>a.timestamp-b.timestamp)){
    const v=numeric(m[field]);if(v===null){gap=true;continue;}
    const p={t:m.timestamp,v,break:gap||!!(points.length&&m.timestamp-points.at(-1).t>GAP_SECONDS)};
    if(points.at(-1)?.t===p.t)points[points.length-1]=p;else points.push(p);
    gap=false;
  }
  return points;
}
export function plotPath(points,x,y,step=false){
  return points.map((p,i)=>!i||p.break?`M${x(p.t)},${y(p.v)}`:step?`H${x(p.t)} V${y(p.v)}`:`L${x(p.t)},${y(p.v)}`).join(' ');
}
export function setupParameterHistory({api,hasSession,telemetry,metric}){
  const el=id=>document.getElementById(id),cache=new Map(),requests=new Map();
  let saved={key:DEFAULT,label:'',unit:''};
  try{const s=JSON.parse(localStorage.getItem(STORAGE));if(safeField(s?.key))saved={key:s.key,label:String(s.label||'').slice(0,48),unit:String(s.unit||'').slice(0,16)};}catch{}
  let field=saved.key,days=1,revision=0,generation=0;
  const info=k=>({label:k===saved.key&&saved.label?saved.label:metric(k)?.label||labels[k]||k.replace(/[._]/g,' '),unit:k===saved.key?saved.unit||units[k]||'':units[k]||''});
  function isStep(k,rows){return k.endsWith('.status')||rows.some(m=>typeof m?.[k]==='boolean');}
  function valueText(v,k,step){return step&&[0,1].includes(v)?v?'ON':'OFF':`${v.toLocaleString('en-GB',{maximumFractionDigits:5})}${info(k).unit?' '+info(k).unit:''}`;}
  async function fetchSeries(k,d,force=false){
    if(!hasSession())throw new Error('Connect to Flespi to load parameter history.');
    const key=`${generation}:${k}:${d}`,hit=cache.get(key);
    if(!force&&hit&&Date.now()-hit.at<600000)return hit.data;
    if(requests.has(key))return requests.get(key);
    const g=generation;
    const request=api(`/api/parameter-history?field=${encodeURIComponent(k)}&days=${d}`).then(data=>{if(g===generation)cache.set(key,{at:Date.now(),data});return data;}).finally(()=>requests.delete(key));
    requests.set(key,request);return request;
  }
  function draw(container,data,k,interactive=false){
    const points=historyPoints(data.messages,k),step=isStep(k,data.messages),meta=info(k);
    if(!points.length){container.innerHTML='<div class="empty-chart">No recorded numeric or state readings in this range.</div>';return;}
    const lo=Math.min(...points.map(p=>p.v)),hi=Math.max(...points.map(p=>p.v)),pad=step?.2:Math.max((hi-lo)*.1,Math.abs(hi)*.01,.01);
    const W=600,H=240,L=68,R=16,T=16,B=40,from=data.from,to=data.to;
    const x=t=>L+(t-from)/(to-from)*(W-L-R),y=v=>T+(hi+pad-v)/(hi-lo+2*pad)*(H-T-B);
    const path=plotPath(points,x,y,step);
    const ticks=[lo,(lo+hi)/2,hi].filter((v,i,a)=>a.indexOf(v)===i);
    const grid=ticks.map(v=>`<line class="chart-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="2" y="${y(v)+4}">${esc(step&&[0,1].includes(v)?v?'ON':'OFF':v.toLocaleString('en-GB',{maximumFractionDigits:2}))}</text>`).join('');
    container.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(meta.label)} history${meta.unit?' in '+esc(meta.unit):''}">${grid}<path class="chart-path" fill="none" d="${path}"/>${points.map(p=>`<circle class="last-dot" cx="${x(p.t)}" cy="${y(p.v)}" r="2"/>`).join('')}<line class="history-cursor" x1="0" x2="0" y1="${T}" y2="${H-B}" hidden/><circle class="history-selected" r="5" hidden/><text x="${L}" y="${H-10}">${esc(date(from).slice(0,-3))}</text><text x="${W-R}" y="${H-10}" text-anchor="end">${esc(date(to).slice(0,-3))}</text></svg>`;
    if(!interactive)return;
    const svg=container.querySelector('svg'),cursor=svg.querySelector('.history-cursor'),dot=svg.querySelector('.history-selected'),slider=el('historyScrubber');
    slider.disabled=false;slider.max=points.length-1;slider.value=points.length-1;
    function select(i){const p=points[i];slider.value=i;cursor.removeAttribute('hidden');dot.removeAttribute('hidden');cursor.setAttribute('x1',x(p.t));cursor.setAttribute('x2',x(p.t));dot.setAttribute('cx',x(p.t));dot.setAttribute('cy',y(p.v));el('historyReading').textContent=`${valueText(p.v,k,step)} · ${date(p.t)}`;}
    slider.oninput=()=>select(Number(slider.value));
    function inspect(e){const rect=svg.getBoundingClientRect(),t=from+((e.clientX-rect.left)/rect.width*W-L)/(W-L-R)*(to-from);let closest=0;for(let i=1;i<points.length;i++)if(Math.abs(points[i].t-t)<Math.abs(points[closest].t-t))closest=i;select(closest);}
    svg.onpointerdown=e=>{svg.setPointerCapture(e.pointerId);inspect(e);};svg.onpointermove=e=>{if(e.pointerType==='mouse'||svg.hasPointerCapture(e.pointerId))inspect(e);};
    select(points.length-1);
  }
  function settings(){
    const candidates=Object.entries(telemetry()).filter(([k,v])=>safeField(k)&&numeric(v?.value)!==null).map(([k])=>k);
    const keys=[...new Set([DEFAULT,saved.key,...candidates])].sort();
    el('graphParameter').innerHTML=keys.map(k=>`<option value="${esc(k)}"${k===saved.key?' selected':''}>${esc(labels[k]||k)}${candidates.includes(k)?'':' (no current reading)'}</option>`).join('');
    el('graphLabel').value=saved.label;el('graphUnit').value=saved.unit;
  }
  function render(){
    const meta=info(saved.key);el('dashboardGraphTitle').textContent=meta.label;el('dashboardGraphSubtitle').textContent=`Recorded ${meta.unit||'values'} · last 24 hours`;el('dashboardGraphField').textContent=saved.key;
    const data=cache.get(`${generation}:${saved.key}:1`)?.data;if(data)draw(el('batteryChart'),data,saved.key);
  }
  async function loadDashboard(force=false){
    const k=saved.key,g=generation;render();
    try{const data=await fetchSeries(k,1,force);if(k!==saved.key||g!==generation)return;draw(el('batteryChart'),data,k);el('dashboardGraphStatus').textContent=data.truncated?'History limited to the latest 1,500 messages. Open history for coverage details.':'';}
    catch(e){if(k===saved.key&&g===generation)el('dashboardGraphStatus').textContent=e.message;}
  }
  async function loadViewer(force=false){
    const r=++revision,k=field,d=days,g=generation;
    el('parameterHistoryTitle').textContent=info(k).label;el('historyField').textContent=k;el('historyNotice').textContent='Loading recorded history…';el('historyScrubber').disabled=true;el('historyReading').textContent='';el('parameterHistoryChart').innerHTML='';
    for(const b of document.querySelectorAll('[data-history-days]')){b.setAttribute('aria-pressed',String(Number(b.dataset.historyDays)===d));}
    try{const data=await fetchSeries(k,d,force);if(r!==revision||g!==generation||!el('parameterHistoryDialog').open)return;
      draw(el('parameterHistoryChart'),data,k,true);
      const points=historyPoints(data.messages,k);
      el('historyNotice').textContent=`${points.length} recorded readings${points.length?' · '+date(points[0].t)+' → '+date(points.at(-1).t):''}. ${data.truncated?'Limited to the latest 1,500 messages; earlier readings may be missing. ':''}Missing readings and gaps over 1 hour are not joined. Historical availability depends on recorded device messages.`;
    }catch(e){if(r===revision&&g===generation)el('historyNotice').textContent=e.message;}
  }
  function open(k){if(!safeField(k))return;field=k;days=1;const dialog=el('parameterHistoryDialog');if(!dialog.open)dialog.showModal();loadViewer();}
  el('viewParameterHistory').onclick=()=>open(saved.key);
  el('closeParameterHistory').onclick=()=>el('parameterHistoryDialog').close();
  el('parameterHistoryDialog').addEventListener('close',()=>{revision++;});
  el('refreshParameterHistory').onclick=()=>loadViewer(true);
  for(const b of document.querySelectorAll('[data-history-days]'))b.onclick=()=>{days=Number(b.dataset.historyDays);loadViewer();};
  for(const card of document.querySelectorAll('[data-quick-card]')){
    card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','View parameter history');
    const show=()=>{const k=card.dataset.historyField;if(k)open(k);};card.onclick=show;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};
  }
  el('graphSettingsForm').onsubmit=e=>{e.preventDefault();const k=el('graphParameter').value;if(!safeField(k))return;
    const next={key:k,label:el('graphLabel').value.trim().slice(0,48),unit:el('graphUnit').value.trim().slice(0,16)};
    try{localStorage.setItem(STORAGE,JSON.stringify(next));saved=next;el('graphSettingsStatus').textContent='Saved. Your dashboard graph now uses this parameter.';el('batteryChart').innerHTML='';loadDashboard();}catch{el('graphSettingsStatus').textContent='Could not save graph settings in this browser.';}
  };
  el('graphParameter').onchange=()=>{el('graphLabel').value='';el('graphUnit').value=units[el('graphParameter').value]||'';};
  render();settings();
  return {render,settings,loadDashboard,open,reset(){generation++;revision++;cache.clear();el('batteryChart').innerHTML='';el('dashboardGraphStatus').textContent='';if(el('parameterHistoryDialog').open)el('parameterHistoryDialog').close();}};
}
