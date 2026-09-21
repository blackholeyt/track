import lucide from 'https://unpkg.com/lucide@0.273.0/dist/lucide.esm.js';

/* Simple UUID */
const uid = (n=8)=>Date.now().toString(36)+Math.random().toString(36).slice(2,n+2);

const STORE_KEY = 'tracker.app.v1';

const defaultState = () => ({
  meta:{version:'1.0',createdAt:new Date().toISOString()},
  settings:{defaultRest:90,units:'kg',theme:'dark'},
  exercises:[],
  routines:[],
  sessions:[]
});

/* LocalStorage wrapper */
const storage = {
  load(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){console.error('load error',e);return null}
  },
  save(state){
    localStorage.setItem(STORE_KEY,JSON.stringify(state));
  },
  export(){
    const data = storage.load()||defaultState();
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');a.href=url;a.download='app.json';a.click();URL.revokeObjectURL(url);
  }
};

let state = storage.load() || (function(){
  const s = defaultState();
  // seed data
  s.exercises.push({id:uid(),name:'Bench Press'});
  s.exercises.push({id:uid(),name:'Back Squat'});
  s.exercises.push({id:uid(),name:'Deadlift'});
  s.routines.push({id:uid(),name:'Push Day A',tags:['push'],defaultRest:90,items:[{id:uid(),exerciseId:s.exercises[0].id,sets:4,reps:'6-8',rest:90}]});
  storage.save(s);
  return s;
})();

/* Basic DOM helpers */
const $ = sel=>document.querySelector(sel);
const $$ = sel=>Array.from(document.querySelectorAll(sel));

/* Tabs */
$$('.tab').forEach(btn=>btn.addEventListener('click',e=>{
  $$('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  $$('.panel').forEach(p=>p.classList.add('hidden'));
  $(`#${tab}`).classList.remove('hidden');
}));

/* Exercises */
const exerciseForm = $('#exerciseForm');
const exerciseList = $('#exerciseList');
const exerciseName = $('#exerciseName');

function renderExercises(){
  exerciseList.innerHTML='';
  state.exercises.forEach(ex=>{
    const li = document.createElement('li');li.className='item';
    li.innerHTML = `<span>${ex.name}</span><div class="row"><button data-id="${ex.id}" class="btn ghost edit">Edit</button><button data-id="${ex.id}" class="btn ghost del">Del</button></div>`;
    exerciseList.appendChild(li);
  });
}

exerciseForm.addEventListener('submit',e=>{
  e.preventDefault();
  const name = exerciseName.value.trim();
  if(!name) return;
  state.exercises.push({id:uid(),name});
  storage.save(state);renderExercises();populateExerciseSelects();exerciseName.value='';
});

exerciseList.addEventListener('click',e=>{
  const id = e.target.dataset.id; if(!id) return;
  if(e.target.classList.contains('del')){
    state.exercises = state.exercises.filter(x=>x.id!==id);storage.save(state);renderExercises();populateExerciseSelects();
  }
  if(e.target.classList.contains('edit')){
    const ex = state.exercises.find(x=>x.id===id);const n = prompt('Rename exercise',ex.name);if(n){ex.name=n;storage.save(state);renderExercises();populateExerciseSelects();}
  }
});

/* Routines */
const routineForm = $('#routineForm');
const routineName = $('#routineName');
const routineTag = $('#routineTag');
const routineRest = $('#routineRest');
const routineExerciseSelect = $('#routineExerciseSelect');
const routineSets = $('#routineSets');
const routineReps = $('#routineReps');
const routineItemRest = $('#routineItemRest');
const addRoutineItem = $('#addRoutineItem');
const routineItems = $('#routineItems');
const routineList = $('#routineList');

let workingItems = [];

function populateExerciseSelects(){
  [routineExerciseSelect,$('#liveRoutineSelect')].forEach(sel=>{
    if(!sel) return;sel.innerHTML='';
    state.exercises.forEach(ex=>{const opt=document.createElement('option');opt.value=ex.id;opt.textContent=ex.name;sel.appendChild(opt);});
  });
}

function renderRoutineItems(){
  routineItems.innerHTML='';
  workingItems.forEach(it=>{
    const el = document.createElement('div');el.className='item';el.innerHTML=`<div><strong>${(state.exercises.find(x=>x.id===it.exerciseId)||{}).name||'—'}</strong><div class="small">${it.sets}× ${it.reps} • rest ${it.rest||'inherit'}s</div></div><div><button data-id="${it.id}" class="btn ghost del">Remove</button></div>`;
    routineItems.appendChild(el);
  });
}

addRoutineItem.addEventListener('click',e=>{e.preventDefault();const ex=routineExerciseSelect.value; if(!ex) return;const sets=parseInt(routineSets.value)||3;const reps=routineReps.value||'8';const rest=parseInt(routineItemRest.value)||null;workingItems.push({id:uid(),exerciseId:ex,sets,reps,rest});renderRoutineItems();routineSets.value='';routineReps.value='';routineItemRest.value='';});

routineItems.addEventListener('click',e=>{const id=e.target.dataset.id; if(!id) return; workingItems = workingItems.filter(i=>i.id!==id);renderRoutineItems();});

routineForm.addEventListener('submit',e=>{e.preventDefault();const name=routineName.value.trim();if(!name) return; const tags=(routineTag.value||'').split(',').map(s=>s.trim()).filter(Boolean); const dr = parseInt(routineRest.value)||null; state.routines.push({id:uid(),name,tags,defaultRest:dr,items:workingItems}); workingItems=[]; renderRoutines(); storage.save(state); routineForm.reset(); populateExerciseSelects();});

function renderRoutines(){
  routineList.innerHTML='';
  $('#liveRoutineSelect').innerHTML='';
  state.routines.forEach(r=>{
    const el=document.createElement('div');el.className='item';el.innerHTML=`<div><strong>${r.name}</strong><div class="small">${r.tags.join(', ')} • ${r.items.length} items</div></div><div class="row"><button data-id="${r.id}" class="btn ghost start">Start</button><button data-id="${r.id}" class="btn ghost del">Delete</button></div>`;
    routineList.appendChild(el);
    const opt=document.createElement('option');opt.value=r.id;opt.textContent=r.name;$('#liveRoutineSelect').appendChild(opt);
  });
}

routineList.addEventListener('click',e=>{const id=e.target.dataset.id; if(!id) return; if(e.target.classList.contains('del')){state.routines=state.routines.filter(r=>r.id!==id);storage.save(state);renderRoutines();} if(e.target.classList.contains('start')){startWorkoutById(id);} });

/* Live workout */
const startWorkout = $('#startWorkout');
const workoutArea = $('#workoutArea');

function startWorkoutById(id){const r = state.routines.find(x=>x.id===id); if(!r) return; openWorkout(r);} 

startWorkout.addEventListener('click',()=>{const id = $('#liveRoutineSelect').value; if(!id) return; startWorkoutById(id);});

function openWorkout(routine){
  workoutArea.innerHTML=''; workoutArea.classList.remove('hidden');
  const wrapper = document.createElement('div'); wrapper.className='col';
  routine.items.forEach((it,idx)=>{
    const ex = state.exercises.find(e=>e.id===it.exerciseId) || {name:'—'};
    const card = document.createElement('div');card.className='workout-item';
    const title = document.createElement('div'); title.innerHTML = `<strong>${ex.name}</strong><div class='small'>${it.sets}× ${it.reps}</div>`;
    const setsRow = document.createElement('div'); setsRow.className='sets-row';
    for(let s=1;s<=it.sets;s++){
      const btn = document.createElement('button'); btn.className='set-btn'; btn.textContent = `${s}`;
      btn.dataset.exerciseId = it.exerciseId; btn.dataset.setIndex = s-1; btn.dataset.routineId = routine.id; btn.addEventListener('click',onSetClick);
      setsRow.appendChild(btn);
    }
    card.appendChild(title);card.appendChild(setsRow);wrapper.appendChild(card);
  });
  workoutArea.appendChild(wrapper);
}

/* Timer + PR detection */
let activeTimer = null;
function onSetClick(e){
  const btn = e.currentTarget;
  if(btn.classList.contains('done')) return;
  // mark done and open input for weight/reps
  btn.classList.add('done');
  const weight = prompt('Weight (numeric)')||'';
  const reps = prompt('Reps')||'';
  // save session entry
  const sess = {id:uid(),date:new Date().toISOString(),entries:[{exerciseId:btn.dataset.exerciseId,setIndex:btn.dataset.setIndex,weight:Number(weight)||null,reps:reps}]};
  state.sessions.push(sess); storage.save(state);
  // PR detection: check max weight for this exercise
  const exEntries = state.sessions.flatMap(s=>s.entries).filter(en=>en.exerciseId===btn.dataset.exerciseId && en.weight);
  const max = Math.max(...exEntries.map(e=>e.weight||0));
  if(Number(weight) && Number(weight)>=max){
    showPR(exEntries.length?max:Number(weight));
  }
  // start rest timer
  const parentRoutine = state.routines.find(r=>r.id===btn.dataset.routineId);
  const item = parentRoutine.items.find(it=>it.exerciseId===btn.dataset.exerciseId);
  const rest = (item && item.rest) || parentRoutine.defaultRest || state.settings.defaultRest || 60;
  startRestTimer(rest, btn);
}

function startRestTimer(seconds, refBtn){
  if(activeTimer) {clearInterval(activeTimer.id); activeTimer = null;}
  const ring = createRing(seconds);
  refBtn.appendChild(ring.container);
  let t = seconds;
  const id = setInterval(()=>{
    t--; updateRing(ring,t/seconds);
    if(t<=0){clearInterval(id); ring.container.remove(); activeTimer=null; buzz();}
  },1000);
  activeTimer = {id};
}

function buzz(){try{if(navigator.vibrate) navigator.vibrate(200);}catch(e){} const a = new Audio(); const ctx = new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=880; g.gain.value=0.0001; o.start(); g.gain.exponentialRampToValueAtTime(0.05,ctx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.3); o.stop(ctx.currentTime+0.35);
}

function createRing(seconds){
  const ns = document.createElement('div'); ns.className='ring';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox','0 0 36 36'); svg.style.width='56px'; svg.style.height='56px';
  const bg = document.createElementNS(svgNS,'path'); bg.setAttribute('d','M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32'); bg.setAttribute('fill','none'); bg.setAttribute('stroke','rgba(255,255,255,0.04)'); bg.setAttribute('stroke-width','2');
  const fg = document.createElementNS(svgNS,'path'); fg.setAttribute('d','M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32'); fg.setAttribute('fill','none'); fg.setAttribute('stroke',getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()); fg.setAttribute('stroke-width','2'); fg.setAttribute('stroke-linecap','round'); fg.style.transition='stroke-dashoffset 1s linear'; fg.style.strokeDasharray='100'; fg.style.strokeDashoffset='0';
  svg.appendChild(bg); svg.appendChild(fg); ns.appendChild(svg);
  return {container:ns, fg};
}
function updateRing(ring,ratio){ const v = Math.max(0,Math.min(1,ratio)); ring.fg.style.strokeDashoffset = '' + (100 - Math.round(v*100)); }

function showPR(val){
  const c=document.createElement('div');c.className='confetti'; c.innerHTML = `<div style="position:fixed;left:50%;top:20%;transform:translateX(-50%);background:linear-gradient(90deg,var(--accent),var(--accent-2));padding:12px 20px;border-radius:12px;box-shadow:var(--shadow);">New PR: ${val}</div>`;
  document.body.appendChild(c); setTimeout(()=>c.remove(),2200);
}

/* Stats */
const statsRange = $('#statsRange');
const statsChartEl = $('#statsChart');
let statsChart = null;

function computeVolume(days){
  const entries = state.sessions.flatMap(s=>s.entries.map(en=>({...en,date:new Date(s.date)})));
  const cutoff = days==='all'?new Date(0):new Date(Date.now()- (parseInt(days)||30)*24*60*60*1000);
  const filtered = entries.filter(e=>e.date>=cutoff && e.weight && e.reps);
  // group by day
  const map = {};
  filtered.forEach(e=>{
    const d = e.date.toISOString().slice(0,10);
    map[d] = (map[d]||0) + ( (e.weight||0) * (parseInt(String(e.reps))||1) );
  });
  const labels = Object.keys(map).sort();
  const data = labels.map(l=>map[l]);
  return {labels,data};
}

function renderStats(){
  const range = statsRange.value;
  const v = computeVolume(range);
  if(statsChart) statsChart.destroy();
  statsChart = new Chart(statsChartEl.getContext('2d'),{
    type:'line',data:{labels:v.labels,datasets:[{label:'Volume',data:v.data,backgroundColor:'rgba(110,231,255,0.08)',borderColor:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),tension:0.25,fill:true}]},options:{responsive:true,plugins:{legend:{display:false}}}
  });
}

statsRange.addEventListener('change',renderStats);

/* Export/Import */
$('#exportBtn').addEventListener('click',()=>storage.export());
$('#importBtn').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',async(e)=>{
  const f = e.target.files[0]; if(!f) return; const txt = await f.text(); try{ const d=JSON.parse(txt); localStorage.setItem(STORE_KEY,JSON.stringify(d)); location.reload(); }catch(err){alert('Invalid JSON')}
});

/* Settings */
$('#defaultRestInput').value = state.settings.defaultRest;
$('#unitsSelect').value = state.settings.units;
$('#themeSelect').value = state.settings.theme;
$('#defaultRestInput').addEventListener('change',()=>{state.settings.defaultRest = parseInt($('#defaultRestInput').value)||60; storage.save(state);});
$('#unitsSelect').addEventListener('change',()=>{state.settings.units=$('#unitsSelect').value;storage.save(state);});
$('#themeSelect').addEventListener('change',()=>{state.settings.theme=$('#themeSelect').value;storage.save(state);});

$('#clearData').addEventListener('click',()=>{ if(confirm('Clear all data?')){ localStorage.removeItem(STORE_KEY); location.reload(); }});

/* Init */
function init(){ renderExercises(); populateExerciseSelects(); renderRoutines(); renderStats(); }

document.addEventListener('DOMContentLoaded',init);
