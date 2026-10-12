import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../flespi-direct.js',import.meta.url),'utf8');
let serial=0;
async function fixture(handler){
  const storage=new Map();
  globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return handler(new URL(url).pathname,options);};
  // Session injection exists only in the test module, never in the shipped app.
  const code=source+`\nsessionToken='test-token-only';deviceId='9056049';\n// fixture ${serial++}`;
  const app=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  return {app,calls,storage};
}
const json=result=>new Response(JSON.stringify({result}),{headers:{'content-type':'application/json'}});
const own=(id,timestamp)=>({id,timestamp,executed:true,meta:{app:'f30-connect',kind:'read'}});

test('history uses the GET selector and keeps completed replies',async()=>{
  const {app,calls}=await fixture(path=>{
    if(path.endsWith('/commands-queue/all'))return json([]);
    if(path.endsWith('/commands-result'))return json([{...own(1,100),response:'CAN-CONTROL cmd executed successfully.'}]);
    throw new Error('Unexpected endpoint');
  });
  const history=await app.api('/api/command-status');
  assert.deepEqual(history.warnings,[]);
  assert.equal(history.completed[0].response,'CAN-CONTROL cmd executed successfully.');
  assert.equal(calls.length,2);
});
test('a failed pending queue does not hide completed replies or claim an empty queue',async()=>{
  const {app}=await fixture(path=>path.endsWith('/commands-queue/all')?new Response('',{status:404}):json([own(1,100)]));
  const history=await app.api('/api/command-status');
  assert.equal(history.completed.length,1);
  assert.match(history.warnings[0],/Pending command queue unavailable/);
});
test('completed failure preserves pending commands',async()=>{
  const {app}=await fixture(path=>path.endsWith('/commands-result')?new Response('{}',{status:403}):json([own(2,100)]));
  const history=await app.api('/api/command-status');
  assert.equal(history.pending.length,1);
  assert.match(history.warnings[0],/Completed command results unavailable/);
});
test('history selects newest results for either upstream ordering',async()=>{
  for(const reverse of [false,true]){
    const items=Array.from({length:30},(_,i)=>own(i+1,i+1));if(reverse)items.reverse();
    const {app}=await fixture(path=>json(path.endsWith('/commands-result')?items:[]));
    const h=await app.api('/api/command-status');
    assert.equal(h.completed.length,20);assert.equal(h.completed[0].id,30);assert.equal(h.completed.at(-1).id,11);
  }
});
test('a queue/result transition does not display the same command twice',async()=>{
  const {app}=await fixture(()=>json([own(7,100)]));
  const h=await app.api('/api/command-status');assert.equal(h.pending.length,0);assert.equal(h.completed.length,1);
});
test('malformed records and local ID data do not crash history',async()=>{
  const {app,storage}=await fixture(()=>json([null,own(7,100),{id:99}]));
  storage.set('f30-connect-command-ids-v1',JSON.stringify({deviceId:'9056049',commands:[null,{},false]}));
  const h=await app.api('/api/command-status');assert.equal(h.completed.length,1);
});
test('read commands use POST without selector and retain ten-minute TTL',async()=>{
  const {app,calls}=await fixture(()=>json([{id:1}]));
  await app.api('/api/custom-command',{method:'POST',body:JSON.stringify({text:'GETPARAM 1 ; 2'})});
  assert.equal(calls[0].url,'https://flespi.io/gw/devices/9056049/commands-queue');
  const body=JSON.parse(calls[0].options.body)[0];assert.equal(body.ttl,600);assert.equal(body.properties.text,'getparam 1;2');
});
test('confirmed writes normalize spaces and casing consistently',async()=>{
  const {app,calls}=await fixture(path=>json(path.endsWith('/commands')?[{id:1}]:[{connected:true}]));
  await app.api('/api/custom-command',{method:'POST',body:JSON.stringify({text:'SETPARAM  1:2 ; 3:4',confirm:'APPLY',confirmCommand:'SETPARAM  1:2;3:4'})});
  assert.equal(JSON.parse(calls[1].options.body)[0].properties.text,'setparam 1:2;3:4');
  assert.ok(calls.every(c=>!c.url.includes('/commands-queue')));
});
test('mismatched write confirmation sends nothing',async()=>{
  const {app,calls}=await fixture(()=>{throw new Error('Must not fetch');});
  await assert.rejects(app.api('/api/custom-command',{method:'POST',body:JSON.stringify({text:'setparam 1:2',confirm:'APPLY',confirmCommand:'setparam 1:3'})}));assert.equal(calls.length,0);
});
test('offline unlock does not send or queue',async()=>{
  const {app,calls}=await fixture(()=>json([{connected:false}]));
  const result=await app.api('/api/action',{method:'POST',body:JSON.stringify({action:'unlock',confirm:'UNLOCK'})});
  assert.equal(result.blocked,true);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');
});
test('prototype diagnostic names are rejected before network access',async()=>{
  const {app,calls}=await fixture(()=>json([]));
  for(const key of ['constructor','toString','__proto__'])await assert.rejects(app.api('/api/diagnostic',{method:'POST',body:JSON.stringify({key})}),/Unsupported diagnostic/);
  assert.equal(calls.length,0);
});
test('non-JSON rate limits enter cooldown without repeated fetches',async()=>{
  const {app,calls}=await fixture(()=>new Response('',{status:429}));
  await assert.rejects(app.api('/api/history'),/HTTP 429/);
  await assert.rejects(app.api('/api/history'),/cooldown/);assert.equal(calls.length,1);
});
test('null JSON returns a controlled format error',async()=>{
  const {app}=await fixture(()=>new Response('null'));
  await assert.rejects(app.api('/api/history'),/unexpected response format/);
});
test('parameter history requests only timestamp and the selected field',async()=>{
  const {app,calls}=await fixture(()=>json([{timestamp:1,'can.engine.rpm':600,'position.latitude':54}]));
  const r=await app.api('/api/parameter-history?field=can.engine.rpm&days=3');
  const data=JSON.parse(new URL(calls[0].url).searchParams.get('data'));
  assert.equal(data.fields,'timestamp,can.engine.rpm');assert.equal(data.count,1500);assert.equal(data.to-data.from,3*86400);
  assert.deepEqual(Object.keys(r.messages[0]),['timestamp','can.engine.rpm']);
});
test('parameter history rejects injected fields and unsupported ranges',async()=>{
  const {app,calls}=await fixture(()=>json([]));
  for(const route of ['/api/parameter-history?field=timestamp','/api/parameter-history?field=foo,bar','/api/parameter-history?field=can.engine.rpm&days=30'])await assert.rejects(app.api(route));
  assert.equal(calls.length,0);
});
test('parameter history reports the message limit as truncated',async()=>{
  const {app}=await fixture(()=>json(Array.from({length:1500},(_,i)=>({timestamp:i,p:i}))));
  assert.equal((await app.api('/api/parameter-history?field=p&days=7')).truncated,true);
});
