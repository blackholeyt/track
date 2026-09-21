// app.js — Exercise & Routine Manager with localStorage persistence
(() => {
  const STORAGE_KEY = 'tracker.app.v1';

  // Schema:
  // {
  //   exercises: [{id,name}],
  //   routines: [{id,name,days:[{id,name,exercises:[{id,exerciseId,sets,reps,rest}]},...]}]
  // }

  function uid(prefix = '') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function loadApp() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {exercises:[], routines:[]};
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load app state', e);
      return {exercises:[], routines:[]};
    }
  }

  function saveApp(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let app = loadApp();

  // --- Exercises CRUD ---
  function addExercise(name) {
    name = String(name || '').trim();
    if (!name) return null;
    const ex = { id: uid('ex_'), name };
    app.exercises.push(ex);
    saveApp(app);
    renderExercises();
    renderRoutines();
    return ex;
  }

  function renameExercise(id, newName) {
    const ex = app.exercises.find(e => e.id === id);
    if (!ex) return false;
    ex.name = String(newName||'').trim() || ex.name;
    saveApp(app);
    renderExercises();
    renderRoutines();
    return true;
  }

  function deleteExercise(id) {
    if (!confirm('Übung löschen? Alle Referenzen in Routinen werden entfernt.')) return false;
    app.exercises = app.exercises.filter(e => e.id !== id);
    // remove from routines
    app.routines.forEach(r => {
      r.days.forEach(d => {
        d.exercises = d.exercises.filter(x => x.exerciseId !== id);
      });
    });
    saveApp(app);
    renderExercises();
    renderRoutines();
    return true;
  }

  // --- Routines & Days ---
  function createRoutine(name) {
    name = String(name||'').trim();
    if (!name) return null;
    const r = { id: uid('rt_'), name, days: [] };
    app.routines.push(r);
    saveApp(app);
    renderRoutines();
    return r;
  }

  function renameRoutine(id, newName) {
    const r = app.routines.find(x=>x.id===id); if(!r) return false;
    r.name = String(newName||'').trim() || r.name; saveApp(app); renderRoutines(); return true;
  }

  function deleteRoutine(id) {
    if (!confirm('Routine löschen?')) return false;
    app.routines = app.routines.filter(r=>r.id!==id); saveApp(app); renderRoutines(); return true;
  }

  function addDayToRoutine(routineId, dayName) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return null;
    const d = { id: uid('day_'), name: String(dayName||'Tag').trim(), exercises: [] };
    r.days.push(d); saveApp(app); renderRoutines(); return d;
  }

  function removeDay(routineId, dayId) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return false;
    r.days = r.days.filter(d=>d.id!==dayId); saveApp(app); renderRoutines(); return true;
  }

  function addExerciseToDay(routineId, dayId, exerciseId, sets=3, reps=8, rest=90) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return null;
    const d = r.days.find(x=>x.id===dayId); if(!d) return null;
    const item = { id: uid('item_'), exerciseId, sets: Number(sets)||0, reps: Number(reps)||0, rest: Number(rest)||0 };
    d.exercises.push(item); saveApp(app); renderRoutines(); return item;
  }

  function updateExerciseInDay(routineId, dayId, itemId, fields) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return false;
    const d = r.days.find(x=>x.id===dayId); if(!d) return false;
    const it = d.exercises.find(x=>x.id===itemId); if(!it) return false;
    Object.assign(it, fields); saveApp(app); renderRoutines(); return true;
  }

  function removeExerciseFromDay(routineId, dayId, itemId) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return false;
    const d = r.days.find(x=>x.id===dayId); if(!d) return false;
    d.exercises = d.exercises.filter(x=>x.id!==itemId); saveApp(app); renderRoutines(); return true;
  }

  // --- Rendering & UI helpers (lightweight, uses prompts for complex input) ---
  function renderExercises() {
    const container = document.querySelector('#exercises .card .list');
    if (!container) return;
    // top controls
    let controls = document.getElementById('exerciseControls');
    if (!controls) {
      controls = document.createElement('div'); controls.id = 'exerciseControls'; controls.style.display='flex'; controls.style.gap='8px'; controls.style.marginBottom='10px';
      const input = document.createElement('input'); input.placeholder='Neue Übung (z.B. Kniebeuge)'; input.style.flex='1'; input.id='exerciseInput'; input.className='';
      const btn = document.createElement('button'); btn.textContent='Hinzufügen'; btn.className='btn'; btn.addEventListener('click', ()=>{ const v=input.value.trim(); if(v) { addExercise(v); input.value=''; input.focus(); }});
      controls.appendChild(input); controls.appendChild(btn);
      container.parentElement.insertBefore(controls, container);
    }

    container.innerHTML = '';
    app.exercises.forEach(ex => {
      const li = document.createElement('li');
      const left = document.createElement('div'); left.className='list-left';
      const meta = document.createElement('div'); meta.className='meta'; meta.textContent = ex.name;
      left.appendChild(meta);
      const right = document.createElement('div'); right.className='list-right';
      const edit = document.createElement('button'); edit.className='btn ghost'; edit.textContent='Umbenennen'; edit.style.marginRight='6px';
      edit.addEventListener('click', ()=>{
        const n = prompt('Neuer Name für Übung', ex.name); if (n) renameExercise(ex.id, n);
      });
      const del = document.createElement('button'); del.className='btn ghost'; del.textContent='Löschen'; del.addEventListener('click', ()=>{ deleteExercise(ex.id); });
      right.appendChild(edit); right.appendChild(del);
      li.appendChild(left); li.appendChild(right);
      container.appendChild(li);
    });
  }

  function renderRoutines() {
    const grid = document.querySelector('#routines .panel-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // top add routine control
    const addBox = document.createElement('div'); addBox.className='card';
    const h = document.createElement('h3'); h.className='card-title'; h.textContent='Neue Routine';
    const inp = document.createElement('input'); inp.placeholder='Routine Name (z.B. Push Day)'; inp.style.width='100%'; inp.style.marginTop='8px';
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Erstellen'; btn.style.marginTop='8px'; btn.addEventListener('click', ()=>{ const v=inp.value.trim(); if(v){ createRoutine(v); inp.value=''; }});
    addBox.appendChild(h); addBox.appendChild(inp); addBox.appendChild(btn);
    grid.appendChild(addBox);

    app.routines.forEach(r => {
      const box = document.createElement('div'); box.className='card routine';
      const title = document.createElement('h3'); title.className='card-title'; title.textContent = r.name;
      const meta = document.createElement('p'); meta.className='muted'; meta.textContent = `${r.days.length} Trainingstag(e)`;
      const actions = document.createElement('div'); actions.className='routine-actions';
      const addDayBtn = document.createElement('button'); addDayBtn.className='btn'; addDayBtn.textContent='Tag hinzufügen'; addDayBtn.addEventListener('click', ()=>{
        const dn = prompt('Name des Trainingstages (z.B. Push)'); if(dn) addDayToRoutine(r.id, dn);
      });
      const editBtn = document.createElement('button'); editBtn.className='btn ghost'; editBtn.textContent='Umbenennen'; editBtn.addEventListener('click', ()=>{ const n=prompt('Neuer Name', r.name); if(n) renameRoutine(r.id,n); });
      const delBtn = document.createElement('button'); delBtn.className='btn ghost'; delBtn.textContent='Löschen'; delBtn.addEventListener('click', ()=>{ deleteRoutine(r.id); });
      actions.appendChild(addDayBtn); actions.appendChild(editBtn); actions.appendChild(delBtn);

      box.appendChild(title); box.appendChild(meta); box.appendChild(actions);

      // days
      if (r.days.length) {
        r.days.forEach(d => {
          const dayBox = document.createElement('div'); dayBox.style.marginTop='12px';
          const dayHeader = document.createElement('div'); dayHeader.style.display='flex'; dayHeader.style.justifyContent='space-between';
          const dn = document.createElement('div'); dn.innerHTML = `<strong>${d.name}</strong>`;
          const dayActions = document.createElement('div');
          const addEx = document.createElement('button'); addEx.className='btn'; addEx.textContent='Übung hinzufügen'; addEx.addEventListener('click', ()=>{ addExerciseToDayPrompt(r.id,d.id); });
          const remDay = document.createElement('button'); remDay.className='btn ghost'; remDay.textContent='Tag löschen'; remDay.addEventListener('click', ()=>{ if(confirm('Tag löschen?')) removeDay(r.id,d.id); });
          dayActions.appendChild(addEx); dayActions.appendChild(remDay);
          dayHeader.appendChild(dn); dayHeader.appendChild(dayActions);
          dayBox.appendChild(dayHeader);

          // exercises in day
          if (d.exercises.length) {
            const ul = document.createElement('ul'); ul.style.margin='8px 0 0 16px'; ul.style.padding='0'; ul.style.listStyle='none';
            d.exercises.forEach(it => {
              const li = document.createElement('li'); li.style.display='flex'; li.style.justifyContent='space-between'; li.style.alignItems='center'; li.style.padding='6px 0';
              const ex = app.exercises.find(e=>e.id===it.exerciseId);
              const left = document.createElement('div'); left.innerHTML = `<div><strong>${ex?ex.name:'[gelöschte Übung]'}</strong></div><div class='muted'>${it.sets}x${it.reps} • Pause ${it.rest}s</div>`;
              const right = document.createElement('div');
              const edit = document.createElement('button'); edit.className='btn ghost'; edit.textContent='Edit'; edit.addEventListener('click', ()=>{ editExerciseItemPrompt(r.id,d.id,it.id); });
              const del = document.createElement('button'); del.className='btn ghost'; del.textContent='Entfernen'; del.addEventListener('click', ()=>{ if(confirm('Übung entfernen?')) removeExerciseFromDay(r.id,d.id,it.id); });
              right.appendChild(edit); right.appendChild(del);
              li.appendChild(left); li.appendChild(right); ul.appendChild(li);
            });
            dayBox.appendChild(ul);
          }

          box.appendChild(dayBox);
        });
      }

      grid.appendChild(box);
    });
  }

  // --- Prompt helpers for adding exercises to days and editing items ---
  function addExerciseToDayPrompt(routineId, dayId) {
    if (!app.exercises.length) { alert('Keine Übungen vorhanden. Bitte zuerst Übungen hinzufügen.'); return; }
    const list = app.exercises.map((e,i)=>`${i+1}. ${e.name}`).join('\n');
    const pick = prompt('Wähle Übung (Nummer):\n' + list);
    const idx = Number(pick) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= app.exercises.length) return;
    const ex = app.exercises[idx];
    const sets = Number(prompt('Sätze (z.B. 3)', '3')) || 3;
    const reps = Number(prompt('Wiederholungen pro Satz (z.B. 8)', '8')) || 8;
    const rest = Number(prompt('Pause in Sekunden (z.B. 90)', '90')) || 90;
    addExerciseToDay(routineId, dayId, ex.id, sets, reps, rest);
  }

  function editExerciseItemPrompt(routineId, dayId, itemId) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return;
    const d = r.days.find(x=>x.id===dayId); if(!d) return;
    const it = d.exercises.find(x=>x.id===itemId); if(!it) return;
    const sets = Number(prompt('Sätze', String(it.sets))) || it.sets;
    const reps = Number(prompt('Wiederholungen', String(it.reps))) || it.reps;
    const rest = Number(prompt('Pause in Sekunden', String(it.rest))) || it.rest;
    updateExerciseInDay(routineId, dayId, itemId, {sets,reps,rest});
  }

  // ensure history exists
  app.history = app.history || [];

  // --- Live Workout / Gym Mode ---
  let workoutSession = null; // {id, routineId, dayId, items:[{item,exercise,setsLeft,currentSet}], index}
  let restTimerId = null;

  function getLastPerformance(exerciseId) {
    // return last entry for this exercise
    const entries = app.history.filter(h => h.exerciseId === exerciseId).sort((a,b)=>b.t - a.t);
    return entries.length ? entries[0] : null;
  }

  function recordPerformance(exerciseId, weight, reps, sets) {
    const entry = { exerciseId, weight: Number(weight)||0, reps: Number(reps)||0, sets: Number(sets)||0, volume: (Number(weight)||0)*Number(reps)||0, t: Date.now() };
    app.history.push(entry); saveApp(app);
    detectPR(entry);
  }

  function detectPR(entry) {
    // check by weight and by volume
    const prev = app.history.filter(h=>h.exerciseId===entry.exerciseId && h.t < entry.t);
    const maxWeight = prev.reduce((m,c)=>Math.max(m,c.weight||0),0);
    const maxVolume = prev.reduce((m,c)=>Math.max(m,c.volume||0),0);
    if (entry.weight > maxWeight || entry.volume > maxVolume) {
      showPRGlow(entry.exerciseId);
    }
  }

  function showPRGlow(exerciseId) {
    // find any visible element with exercise name and add glow
    const els = Array.from(document.querySelectorAll('.live-exercise-name'));
    els.forEach(el=>{
      if (el.dataset && el.dataset.exerciseId === exerciseId) {
        el.classList.add('pr-glow');
        setTimeout(()=>el.classList.remove('pr-glow'), 2200);
      }
    });
  }

  function renderLiveUI() {
    const livePanel = document.getElementById('live');
    if (!livePanel) return;
    const card = livePanel.querySelector('.live-card');
    if (!card) return;

    // build workout controls area
    let ctrl = document.getElementById('workoutControls');
    if (!ctrl) {
      ctrl = document.createElement('div'); ctrl.id='workoutControls'; ctrl.style.marginTop='12px';
      const top = document.createElement('div'); top.style.display='flex'; top.style.gap='8px';

      const routineSelect = document.createElement('select'); routineSelect.id='workoutRoutineSelect'; routineSelect.style.flex='1';
      const emptyOpt = document.createElement('option'); emptyOpt.value=''; emptyOpt.textContent='Wähle eine Routine zum Starten...'; routineSelect.appendChild(emptyOpt);
      app.routines.forEach(r=>{ const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; routineSelect.appendChild(o); });

      const start = document.createElement('button'); start.className='btn'; start.id='workoutStartBtn'; start.textContent='Workout starten';
      start.addEventListener('click', ()=>{
        const rid = routineSelect.value; if(!rid) { alert('Bitte Routine wählen'); return; }
        startWorkoutFromRoutine(rid);
      });

      top.appendChild(routineSelect); top.appendChild(start);
      ctrl.appendChild(top);

      // workout display area
      const wdisplay = document.createElement('div'); wdisplay.id='workoutDisplay'; wdisplay.style.marginTop='14px';
      ctrl.appendChild(wdisplay);

      card.appendChild(ctrl);
    }

    // update routine select options when routines change
    const sel = document.getElementById('workoutRoutineSelect'); if (sel) {
      const current = sel.value;
      sel.innerHTML=''; const emptyOpt = document.createElement('option'); emptyOpt.value=''; emptyOpt.textContent='Wähle eine Routine zum Starten...'; sel.appendChild(emptyOpt);
      app.routines.forEach(r=>{ const o=document.createElement('option'); o.value=r.id; o.textContent=r.name; sel.appendChild(o); });
      sel.value = current;
    }
  }

  function startWorkoutFromRoutine(routineId) {
    const r = app.routines.find(x=>x.id===routineId); if(!r) return alert('Routine nicht gefunden');
    // flatten first day for demo (could choose day selection). If no days, alert.
    if(!r.days.length) return alert('Routine hat keine Trainingstage');
    const day = r.days[0];
    const items = day.exercises.map(it => ({ item: it, exercise: app.exercises.find(e=>e.id===it.exerciseId) }));
    if(!items.length) return alert('Dieser Trainingstag enthält keine Übungen');

    workoutSession = { id: uid('ws_'), routineId, dayId: day.id, items: items.map(i=>({ ...i, setsLeft: i.item.sets, currentSet: 1 })), index: 0 };
    renderWorkoutState();
  }

  function renderWorkoutState() {
    const display = document.getElementById('workoutDisplay'); if(!display) return;
    display.innerHTML = '';
    if(!workoutSession) return;
    const cur = workoutSession.items[workoutSession.index]; if(!cur) return;

    const exName = document.createElement('div'); exName.className='live-exercise-name'; exName.dataset.exerciseId = cur.exercise ? cur.exercise.id : '';
    exName.innerHTML = `<div style="font-weight:800;font-size:1.1rem">${cur.exercise?cur.exercise.name:'[gelöscht]'}</div>`;
    display.appendChild(exName);

    // last performance hint
    const last = cur.exercise ? getLastPerformance(cur.exercise.id) : null;
    const hint = document.createElement('div'); hint.className='muted'; hint.style.marginTop='6px';
    hint.textContent = last ? `Letzte: ${last.weight}kg × ${last.reps}` : 'Keine Referenz vorhanden';
    display.appendChild(hint);

    // controls: weight, reps, complete set
    const form = document.createElement('div'); form.style.display='flex'; form.style.gap='8px'; form.style.marginTop='12px';
    const weight = document.createElement('input'); weight.type='number'; weight.id='liveWeight'; weight.placeholder = last ? `${last.weight} kg` : 'Gewicht (kg)'; weight.style.flex='1';
    const reps = document.createElement('input'); reps.type='number'; reps.id='liveReps'; reps.placeholder = last ? `${last.reps} Wdh` : 'Wdh'; reps.style.width='88px';
    form.appendChild(weight); form.appendChild(reps);
    display.appendChild(form);

    const info = document.createElement('div'); info.style.marginTop='8px'; info.innerHTML = `<div class='muted'>Satz ${cur.currentSet} von ${cur.item.sets}</div>`;
    display.appendChild(info);

    const controls = document.createElement('div'); controls.style.display='flex'; controls.style.gap='8px'; controls.style.marginTop='10px';
    const completeBtn = document.createElement('button'); completeBtn.className='btn'; completeBtn.textContent='Satz abgeschlossen';
    completeBtn.addEventListener('click', ()=>{ completeSet(); });
    const skipBtn = document.createElement('button'); skipBtn.className='btn ghost'; skipBtn.textContent='Nächste Übung'; skipBtn.addEventListener('click', ()=>{ nextExercise(); });
    controls.appendChild(completeBtn); controls.appendChild(skipBtn);
    display.appendChild(controls);

    // timer display (reuse #timer)
    const timerEl = document.getElementById('timer'); if (timerEl) timerEl.textContent = formatTime(cur.item.rest || 0);
  }

  function completeSet() {
    if (!workoutSession) return;
    const cur = workoutSession.items[workoutSession.index]; if(!cur) return;
    const weightEl = document.getElementById('liveWeight'); const repsEl = document.getElementById('liveReps');
    const weight = Number(weightEl.value) || Number((getLastPerformance(cur.exercise.id)||{}).weight) || 0;
    const reps = Number(repsEl.value) || Number((getLastPerformance(cur.exercise.id)||{}).reps) || 0;
    // record this set
    recordPerformance(cur.exercise.id, weight, reps, cur.item.sets);

    // decrement sets left and start rest timer
    cur.setsLeft = Math.max(0, cur.setsLeft - 1);
    cur.currentSet += 1;
    startRestCountdown(cur.item.rest || 60, ()=>{
      // after rest, if setsLeft>0 continue same exercise, else advance
      if (cur.setsLeft > 0) {
        renderWorkoutState();
      } else {
        nextExercise();
      }
    });
    renderWorkoutState();
  }

  function nextExercise() {
    if (!workoutSession) return;
    if (workoutSession.index < workoutSession.items.length - 1) {
      workoutSession.index += 1; renderWorkoutState();
    } else {
      alert('Workout abgeschlossen!'); workoutSession = null; renderWorkoutState();
    }
  }

  function startRestCountdown(seconds, cb) {
    clearInterval(restTimerId);
    const timerEl = document.getElementById('timer'); if (!timerEl) { if(cb) cb(); return; }
    let remaining = Number(seconds) || 0;
    timerEl.dataset.resting = 'true';
    timerEl.textContent = formatTime(remaining);
    restTimerId = setInterval(()=>{
      remaining -= 1; if (remaining <= 0) { clearInterval(restTimerId); timerEl.dataset.resting=''; if(cb) cb(); }
      timerEl.textContent = formatTime(Math.max(0,remaining));
    },1000);
  }

  function formatTime(s) { const mm = String(Math.floor(s/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return `${mm}:${ss}`; }

  // --- Statistics (Chart rendering) & Export/Import ---
  let statsChart = null;

  function computeVolumeByDay(days) {
    const now = new Date();
    const msPerDay = 24*60*60*1000;
    const labels = [];
    const volumes = [];
    for (let i = days-1; i>=0; i--) {
      const d = new Date(now.getTime() - i*msPerDay);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + msPerDay;
      labels.push(d.toLocaleDateString());
      const vol = app.history.reduce((sum, h)=>{
        if (h.t >= dayStart && h.t < dayEnd) return sum + (h.volume||0);
        return sum;
      },0);
      volumes.push(vol);
    }
    return { labels, volumes };
  }

  function renderStatsChart(days=30) {
    const canvas = document.getElementById('statsChart'); if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = computeVolumeByDay(Number(days)||30);
    const gradient = ctx.createLinearGradient(0,0,0,canvas.height);
    gradient.addColorStop(0,'rgba(110,231,183,0.28)');
    gradient.addColorStop(1,'rgba(110,231,183,0.02)');

    const cfg = {
      type: 'line',
      data: { labels: data.labels, datasets: [{ label: 'Volumen (kg)', data: data.volumes, backgroundColor: gradient, borderColor: 'rgba(110,231,183,0.9)', fill:true, tension:0.25 }] },
      options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true, ticks:{color:'rgba(255,255,255,0.8)'}}, x:{ticks:{color:'rgba(255,255,255,0.8)'}}}, plugins:{legend:{labels:{color:'rgba(255,255,255,0.9)'}}}}
    };

    if (statsChart) { statsChart.data.labels = cfg.data.labels; statsChart.data.datasets = cfg.data.datasets; statsChart.update(); }
    else statsChart = new Chart(ctx, cfg);
  }

  function exportData() {
    const filename = `tracker-export-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(app, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function importDataFromText(text) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('Ungültiges Format');
      // basic validation: must have exercises and routines
      parsed.exercises = parsed.exercises || [];
      parsed.routines = parsed.routines || [];
      parsed.history = parsed.history || [];
      if (!confirm('Daten importieren und aktuellen Speicher ersetzen?')) return;
      app = parsed; saveApp(app); renderAll();
      alert('Import erfolgreich');
    } catch (e) {
      alert('Import fehlgeschlagen: ' + e.message);
    }
  }

  function renderStatsUI() {
    const statsPanel = document.getElementById('stats'); if(!statsPanel) return;
    const range = document.getElementById('statsRange'); const exportBtn = document.getElementById('exportBtn'); const importBtn = document.getElementById('importBtn'); const importFile = document.getElementById('importFile');
    if (range) range.addEventListener('change', ()=> renderStatsChart(range.value));
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn && importFile) { importBtn.addEventListener('click', ()=> importFile.click()); importFile.addEventListener('change', (e)=>{
      const f = e.target.files && e.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = ()=> importDataFromText(reader.result); reader.readAsText(f);
    }); }

    // initial chart
    renderStatsChart(Number((range && range.value) || 30));
  }

  // render on load
  function renderAll(){ renderExercises(); renderRoutines(); renderLiveUI(); renderStatsUI(); }

  // Initialize UI when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else renderAll();

  // Expose API for debugging
  window.trackerApp = {
    loadApp, saveApp, addExercise, renameExercise, deleteExercise,
    createRoutine, addDayToRoutine, addExerciseToDay, updateExerciseInDay, removeExerciseFromDay,
    startWorkoutFromRoutine, recordPerformance, exportData, importDataFromText,
    get state(){ return app; }
  };

})();
