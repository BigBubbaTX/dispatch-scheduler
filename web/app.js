const $ = id => document.getElementById(id);
const palette = ['#a4bb62','#6eaaa3','#c5a5ce','#d5a16d','#8da6cc','#d18f93','#9cad8d','#b8ae64'];
const color = pid => palette[(pid - 1) % palette.length];
const session = crypto.randomUUID();
let state = null, playing = false, timer = null, busy = false;
let rows = [{arrival:0,burst:5},{arrival:2,burst:3},{arrival:10,burst:2}];
let loaded = null;
const algorithms = {
  rr: {description:'Everyone gets a turn. Unfinished work returns to the queue.'},
  fifo: {label:'FIFO · non-preemptive', description:'First to arrive, first to run. Each process runs to completion.'},
  sjf: {label:'SJF · non-preemptive', description:'The shortest ready job runs to completion.'},
  srtf: {label:'SRTF · preemptive', description:'A ready job takes over if it has less time left than the current job.'}
};

function showError(error) {
  $('error').textContent = error.message;
  $('error').hidden = false;
  clearTimeout(showError.timeout);
  showError.timeout = setTimeout(() => $('error').hidden = true, 6000);
}

async function request(path, data = {}) {
  const response = await fetch('/api/' + path, {method:'POST', headers:{'Content-Type':'application/json','X-Simulation':session}, body:JSON.stringify(data)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

function editor() {
  $('editor').innerHTML = rows.map((r,i) => `<div class="editor-row"><span class="process-label"><i class="dot" style="--p:${color(i+1)}"></i>P${i+1}</span><input aria-label="Process ${i+1} arrival" type="number" min="0" max="10000" value="${r.arrival}" data-index="${i}" data-field="arrival"><input aria-label="Process ${i+1} burst" type="number" min="1" max="1000" value="${r.burst}" data-index="${i}" data-field="burst"><button class="remove" aria-label="Remove process ${i+1}" data-remove="${i}">×</button></div>`).join('');
}
$('editor').addEventListener('input', e => {
  if (e.target.dataset.field) rows[Number(e.target.dataset.index)][e.target.dataset.field] = Number(e.target.value);
});
$('editor').addEventListener('click', e => {
  if (e.target.dataset.remove !== undefined) { rows.splice(Number(e.target.dataset.remove),1); editor(); }
});
$('add-row').onclick = () => { if(rows.length >= 100) return showError(new Error('Maximum 100 processes')); rows.push({arrival:0,burst:3}); editor(); };
$('randomize').onclick = () => {
  const count = Number($('count').value), mode = $('workload').value;
  if (!Number.isInteger(count) || count < 1 || count > 20) return showError(new Error('Choose between 1 and 20 processes'));
  rows = Array.from({length:count}, (_,i) => ({arrival:i===0?0:Math.floor(Math.random()*10),burst:mode==='short'?1+Math.floor(Math.random()*3):mode==='long'?7+Math.floor(Math.random()*8):1+Math.floor(Math.random()*10)}));
  editor();
};
function algorithmInfo() {
  const algorithm = $('algorithm').value;
  $('quantum-field').hidden = algorithm !== 'rr';
  $('algorithm-description').textContent = algorithms[algorithm].description;
}
$('algorithm').onchange = algorithmInfo;

function pause() { playing=false; clearTimeout(timer); timer=null; render(); }
function schedule() { if(playing) timer=setTimeout(async()=>{await step(); if(playing) schedule();},Number($('speed').value)); }
function controls() {
  $('play').disabled = busy || !state || state.finished;
  $('step').disabled = busy || !state || state.finished;
  $('reset').disabled = busy || !loaded;
  $('apply').disabled = busy;
  $('inject-form').querySelector('button').disabled = busy || !state;
}
async function reset(useLoaded = false) {
  if(busy) return;
  pause(); busy=true; controls();
  const config = useLoaded ? loaded : {algorithm:$('algorithm').value,quantum:Number($('quantum').value),processes:rows.map(r=>({...r}))};
  try { state = await request('reset',config); loaded=structuredClone(config); render(); }
  catch(error) { showError(error); }
  finally { busy=false; controls(); }
}
$('apply').onclick = () => reset();
$('reset').onclick = () => reset(true);
$('play').onclick = () => { if(playing) pause(); else {playing=true; render(); schedule();} };
$('speed').onchange = () => {if(playing) {clearTimeout(timer);schedule();}};
// Move a process badge between the actual on-screen positions of its stations.
async function handoff(pid, from, to, returning=false) {
  if (!from || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a=from.getBoundingClientRect(), b=to.getBoundingClientRect();
  const dx=b.left+b.width/2-a.left-a.width/2, dy=b.top+b.height/2-a.top-a.height/2;
  const badge=document.createElement('div');
  badge.className='transfer-badge'; badge.textContent='P'+pid;
  badge.setAttribute('aria-hidden','true');
  badge.style.setProperty('--p',color(pid));
  badge.style.left=(a.left+a.width/2-24)+'px'; badge.style.top=(a.top+a.height/2-16)+'px';
  document.body.append(badge);
  try {
    await badge.animate([
      {transform:'translate(0,0) scale(.85)'},
      {transform:`translate(${dx*.52}px,${dy*.5+(returning?24:-12)}px) scale(1.08)`},
      {transform:`translate(${dx}px,${dy}px) scale(.92)`}
    ],{duration:Math.min(420,Math.max(110,Number($('speed').value)*.62)),easing:'ease-in-out',fill:'forwards'}).finished;
  } finally {badge.remove();}
}
async function step() {
  if(busy || !state || state.finished) return;
  busy=true; controls();
  try {
    const next=await request('tick'), pid=next.history.at(-1), cpu=$('cpu');
    const preempted = state.current!==null && pid!==state.current ? state.current : null;
    if(pid!==null && pid!==state.current) {
      const front=$('queue').querySelector('[data-pid="'+pid+'"]');
      if(front) {front.style.opacity='.18'; await handoff(pid,front,cpu);}
    }
    state=next;
    if(state.finished) {playing=false;clearTimeout(timer);}
    render();
    if(preempted!==null) {
      const dest=$('queue').querySelector('[data-pid="'+preempted+'"]');
      await handoff(preempted,cpu,dest,true);
    }
    if(pid!==null && state.current===null) {
      const returning=state.ready.includes(pid);
      const lane=$(returning?'queue':'completed');
      const dest=lane.querySelector('[data-pid="'+pid+'"]');
      if(dest) {
        const r=dest.getBoundingClientRect(), l=lane.getBoundingClientRect();
        dest.style.opacity='.18';
        try {await handoff(pid,cpu,r.right<l.left || r.left>l.right ? lane : dest,returning);}
        finally {dest.style.opacity='';}
      }
    }
  } catch(error) {pause();showError(error);}
  finally {busy=false;controls();}
}
$('step').onclick = () => {pause();step();};
$('inject-form').onsubmit = async e => {
  e.preventDefault(); if(busy || !state) return;
  busy=true; controls();
  try {state=await request('add',{arrival:state.time,burst:Number($('live-burst').value)});render();}
  catch(error) {showError(error);}
  finally {busy=false;controls();}
};

function card(p) {
  return `<div class="queue-card" data-pid="${p.pid}" style="--p:${color(p.pid)}"><strong>P${p.pid}</strong><span>${p.remaining} ticks left</span><div class="bar"><i style="width:${p.remaining/p.burst*100}%"></i></div></div>`;
}
function render() {
  if(!state) return;
  const s=state, byId=new Map(s.processes.map(p=>[p.pid,p]));
  $('clock').innerHTML = `${String(s.time).padStart(2,'0')}<span>ticks</span>`;
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  $('status').textContent = s.finished ? 'All work complete' : playing ? 'Simulation running' : s.time ? 'Paused' : 'Ready to run';
  $('status').classList.toggle('active',playing);
  $('queue-count').textContent = `${s.ready.length} waiting`;
  $('queue').innerHTML = s.ready.length ? s.ready.map(id=>card(byId.get(id))).join('') : '<span class="empty">The ready queue is clear.</span>';
  const last=s.current;
  const cpu=$('cpu'); cpu.classList.toggle('busy',last!==null);
  cpu.innerHTML = last!==null ? `<strong>P${last}</strong><small>executed tick ${s.time-1} → ${s.time}</small>` : `<strong>···</strong><small>CPU available</small>`;
  const continues = s.current!==null &&
    !(loaded.algorithm==='srtf' && s.ready.length && byId.get(s.ready[0]).remaining < byId.get(s.current).remaining);
  $('cpu-caption').textContent = continues ? `P${s.current} CONTINUES NEXT TICK` : s.current!==null ? `P${s.ready[0]} TAKES OVER NEXT TICK` : s.finished ? 'WORKLOAD COMPLETE' : s.time ? 'CPU AVAILABLE NEXT TICK' : 'AWAITING FIRST TICK';
  $('completed').innerHTML = s.processes.filter(p=>p.state==='completed').sort((a,b)=>a.end-b.end).map(p=>`<span class="finished-chip" data-pid="${p.pid}" style="--p:${color(p.pid)}">P${p.pid} ✓</span>`).join('');
  $('completed').scrollLeft=$('completed').scrollWidth;
  const future=s.processes.filter(p=>p.state==='new').length;
  $('future-count').textContent = future ? `${future} not yet arrived` : '';
  $('timeline-algorithm').textContent = algorithms[loaded.algorithm].label ?? `Round robin · q = ${loaded.quantum}`;
  // Keep the last 500 ticks visible in very long simulations.
  const offset=Math.max(0,s.history.length-500);
  $('timeline').innerHTML = s.history.length ? s.history.slice(offset).map((id,i)=>`<div class="timeline-cell ${id===null?'idle':''}" style="--p:${id===null?'#ccc':color(id)}"><strong>${id===null?'—':'P'+id}</strong><small>${offset+i}</small></div>`).join('')+`<div class="timeline-cell"><strong style="background:none">│</strong><small>${s.time}</small></div>` : '<p class="empty">Your execution timeline will appear here.</p>';
  $('timeline').scrollLeft=$('timeline').scrollWidth;
  const done=s.processes.filter(p=>p.state==='completed');
  const average=field=>done.length?(done.reduce((sum,p)=>sum+p[field],0)/done.length).toFixed(1):'—';
  $('avg-wait').textContent=average('waiting'); $('avg-turn').textContent=average('turnaround');
  $('utilization').textContent=s.time?`${Math.round(s.history.filter(id=>id!==null).length/s.time*100)}%`:'—';
  $('process-count').textContent=`${s.processes.length} processes · ${done.length} completed`;
  const value=v=>v===null?'—':v;
  $('process-table').innerHTML=s.processes.map(p=>`<tr><td><span class="process-label"><i class="dot" style="--p:${color(p.pid)}"></i>P${p.pid}</span></td><td><span class="state ${p.state}">${p.state}</span></td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.remaining}</td><td>${value(p.start)}</td><td>${value(p.end)}</td><td>${value(p.waiting)}</td><td>${value(p.turnaround)}</td><td>${value(p.response)}</td></tr>`).join('');
  controls();
}
editor(); algorithmInfo(); reset();
