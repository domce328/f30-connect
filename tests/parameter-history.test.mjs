import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../parameter-history.js',import.meta.url),'utf8');
const {historyPoints,plotPath,setupParameterHistory}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('series sorts readings, keeps zero and booleans, rejects null and nonnumeric values',()=>{
  const pts=historyPoints([{timestamp:3,p:false},{timestamp:1,p:0},{timestamp:2,p:null},{timestamp:4,p:'12.4'},{timestamp:5,p:'invalid'},{timestamp:6,p:13}], 'p');
  assert.deepEqual(pts.map(p=>p.v),[0,0,12.4,13]);assert.equal(pts[1].break,true);assert.equal(pts[3].break,true);
});
test('long reporting gaps restart paths and states use steps',()=>{
  const pts=historyPoints([{timestamp:1,p:0},{timestamp:2,p:1},{timestamp:4000,p:0}],'p');
  assert.equal(plotPath(pts,x=>x,y=>y,true),'M1,0 H2 V1 M4000,0');
});
test('duplicate timestamps yield one inspectable reading',()=>{
  const pts=historyPoints([{timestamp:1,p:12},{timestamp:1,p:13}],'p');assert.equal(pts.length,1);assert.equal(pts[0].v,13);
});
function fixture(handler){
  const nodes=new Map(),attrs=()=>({hidden:true,setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}});
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',innerHTML:'',open:false,dataset:{},setAttribute(k,v){this[k]=v;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},querySelector(){return {querySelector:()=>attrs(),getBoundingClientRect:()=>({left:0,width:600}),hasPointerCapture:()=>false,setPointerCapture(){}};}});
    return nodes.get(id);
  };
  const cards=[node('card1')];cards[0].dataset.historyField='can.engine.rpm';
  const ranges=[1,3,7].map(d=>{const n=node('range'+d);n.dataset.historyDays=String(d);return n;});
  globalThis.document={getElementById:node,querySelectorAll:q=>q==='[data-quick-card]'?cards:ranges};
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  const calls=[];
  const api=async route=>{calls.push(route);if(handler)return handler(route);const k=new URL(route,'https://local').searchParams.get('field');return {from:1,to:5,truncated:false,messages:[{timestamp:1,[k]:1},{timestamp:5,[k]:2}]};};
  const graph=setupParameterHistory({api,hasSession:()=>true,telemetry:()=>({'can.engine.rpm':{value:600},name:{value:'Car'}}),metric:()=>null});
  return {graph,node,calls,cards,storage};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('View history opens a graph, supports ranges, and exposes exact reading inspection',async()=>{
  const {node,calls}=fixture();node('viewParameterHistory').onclick();await settle();
  assert.equal(node('parameterHistoryDialog').open,true);assert.match(calls[0],/field=external.powersource.voltage&days=1/);
  assert.match(node('historyReading').textContent,/2 V/);assert.equal(node('historyScrubber').disabled,false);
  node('historyScrubber').value=0;node('historyScrubber').oninput();assert.match(node('historyReading').textContent,/1 V/);
  node('range7').onclick();await settle();assert.match(calls.at(-1),/days=7/);
});
test('metric cards open their own parameter and graph preferences persist',async()=>{
  const {node,calls,cards,storage}=fixture();cards[0].onclick();await settle();assert.match(calls[0],/field=can.engine.rpm/);
  node('graphParameter').value='can.engine.rpm';node('graphLabel').value='Engine RPM';node('graphUnit').value='RPM';
  node('graphSettingsForm').onsubmit({preventDefault(){}});await settle();
  assert.equal(node('dashboardGraphTitle').textContent,'Engine RPM');assert.equal(JSON.parse(storage.get('f30-connect-graph-v1')).key,'can.engine.rpm');
  assert.match(node('graphParameter').innerHTML,/can.engine.rpm/);assert.doesNotMatch(node('graphParameter').innerHTML,/>name</);
});
test('series requests reuse cached reads; forced refresh fetches again',async()=>{
  const {graph,calls}=fixture();await graph.loadDashboard();await graph.loadDashboard();assert.equal(calls.length,1);await graph.loadDashboard(true);assert.equal(calls.length,2);
});
test('connection reset clears series cache',async()=>{
  const {graph,calls}=fixture();await graph.loadDashboard();graph.reset();await graph.loadDashboard();assert.equal(calls.length,2);
});
test('changing range during an in-flight request discards its late result',async()=>{
  const pending=[];const {node}=fixture(route=>new Promise(resolve=>pending.push({route,resolve})));
  node('viewParameterHistory').onclick();node('range7').onclick();
  const data=v=>({from:1,to:5,messages:[{timestamp:5,'external.powersource.voltage':v}]});
  pending[1].resolve(data(7));await settle();pending[0].resolve(data(1));await settle();
  assert.match(node('historyReading').textContent,/7 V/);assert.doesNotMatch(node('historyReading').textContent,/1 V/);
});
test('concurrent requests for the same series share one fetch',async()=>{
  let resolve;const {graph,calls}=fixture(()=>new Promise(r=>resolve=r));
  const first=graph.loadDashboard(),second=graph.loadDashboard();assert.equal(calls.length,1);
  resolve({from:1,to:5,messages:[]});await Promise.all([first,second]);
});
