const STORAGE_KEY = "fitness-tracker-v1";

const defaultState = {
  exercises: [
    { id: "bench", name: "Bench Press", sets: 3 },
    { id: "squats", name: "Squats", sets: 4 },
    { id: "deadlifts", name: "Deadlifts", sets: 3 },
    { id: "ohp", name: "Overhead Press", sets: 3 },
    { id: "rows", name: "Barbell Row", sets: 3 },
    { id: "pullups", name: "Pull-ups", sets: 4 }
  ],
  days: [
    { id: "push", name: "Push", exercises: ["bench", "ohp"] },
    { id: "pull", name: "Pull", exercises: ["rows", "pullups"] },
    { id: "legs", name: "Legs", exercises: ["squats", "deadlifts"] }
  ],
  logs: {},
  workouts: {}
};

let state = loadState();
let editingWorkoutRef = null;
let _lastDateChangeAt = 0;

const exerciseForm = document.getElementById("exercise-form");
const dayForm = document.getElementById("day-form");
const exerciseList = document.getElementById("exercise-list");
const dayList = document.getElementById("day-list");
const daySelect = document.getElementById("day-select");
const workoutList = document.getElementById("workout-list");
const workoutMeta = document.getElementById("workout-meta");
const saveWorkoutBtn = document.getElementById("save-workout-btn");
const workoutDateInput = document.getElementById("workout-date");
const workoutDateActiveInput = document.getElementById("workout-date-active");
const savedWorkoutsList = document.getElementById("saved-workouts-list");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTodayDateKey() {
  return new Date().toISOString().split("T")[0];
}

function getDateKey(dateValue) {
  return dateValue || getTodayDateKey();
}

function formatDateLabel(dateKey) {
  if (!dateKey) return "Heute";
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  // Include short weekday (Mi, Do, etc.) for clearer display in workout header
  return parsed.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function updateDateLabel() {
  const labelEl = document.getElementById("workout-date-label");
  if (!labelEl) return;
  const dateKey = getDateKey(workoutDateActiveInput.value);
  labelEl.textContent = formatDateLabel(dateKey);
}

function changeWorkoutDateBy(offsetDays) {
  // Prevent very-rapid duplicate calls (e.g. multiple handlers firing)
  const now = Date.now();
  if (now - _lastDateChangeAt < 220) return;
  _lastDateChangeAt = now;

  const current = workoutDateActiveInput.value ? new Date(`${workoutDateActiveInput.value}T00:00:00`) : new Date();
  current.setDate(current.getDate() + offsetDays);
  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, "0");
  const d = String(current.getDate()).padStart(2, "0");
  const newKey = `${y}-${m}-${d}`;
  workoutDateActiveInput.value = newKey;
  workoutDateInput.value = newKey;
  updateDateLabel();
  renderSavedWorkouts();
  renderWorkout();
}

function normalizeSets(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(12, Math.round(parsed));
}

function getExerciseSetCount(exercise) {
  if (!exercise) return 1;
  return normalizeSets(exercise.sets || 1);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) {
      return clone(defaultState);
    }

    const exercises = Array.isArray(saved.exercises)
      ? saved.exercises.map((exercise) => ({
          ...exercise,
          sets: normalizeSets(exercise.sets || 1)
        }))
      : clone(defaultState.exercises);

    return {
      exercises,
      days: Array.isArray(saved.days) ? saved.days : clone(defaultState.days),
      logs: saved.logs && typeof saved.logs === "object" ? saved.logs : {},
      workouts: saved.workouts && typeof saved.workouts === "object" ? saved.workouts : {}
    };
  } catch {
    return clone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getExerciseById(id) {
  return state.exercises.find((exercise) => exercise.id === id);
}

function getDayById(id) {
  return state.days.find((day) => day.id === id);
}

function getDayWorkoutsForDate(dateKey) {
  const workouts = state.workouts[dateKey];
  if (!Array.isArray(workouts)) return [];
  return workouts
    .slice()
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

function getLatestWorkoutForDay(dateKey, dayId) {
  const workouts = getDayWorkoutsForDate(dateKey).filter((entry) => entry.dayId === dayId);
  return workouts[0] || null;
}

function getCurrentWorkoutValues(dateKey, dayId) {
  const key = `${dateKey}:${dayId}`;
  if (state.logs[key] && typeof state.logs[key] === "object") {
    return clone(state.logs[key]);
  }

  const latest = getLatestWorkoutForDay(dateKey, dayId);
  return latest ? clone(latest.entries) : {};
}

function normalizeWorkoutValue(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return Number(value);
}

function captureWorkoutEntries(dayId) {
  const day = getDayById(dayId);
  if (!day) return {};

  const entries = {};

  day.exercises.forEach((exerciseId) => {
    const exercise = getExerciseById(exerciseId);
    const setCount = getExerciseSetCount(exercise);
    const weights = Array.from({ length: setCount }, (_, setIndex) => {
      const input = document.querySelector(
        `input[data-day-id="${dayId}"][data-exercise-id="${exerciseId}"][data-set-index="${setIndex}"]`
      );
      return input ? normalizeWorkoutValue(input.value) : "";
    });

    entries[exerciseId] = weights;
  });

  return entries;
}

function renderExercises() {
  if (!state.exercises.length) {
    exerciseList.innerHTML = '<li class="empty">Keine Übungen vorhanden.</li>';
    return;
  }

  exerciseList.innerHTML = state.exercises
    .map(
      (exercise) => `
        <li>
          <div>
            <span>${escapeHtml(exercise.name)}</span>
            <small class="exercise-meta">Sets: ${getExerciseSetCount(exercise)}</small>
          </div>
          <button class="danger small" type="button" data-delete-exercise="${exercise.id}">
            Löschen
          </button>
        </li>
      `
    )
    .join("");
}

function renderDays() {
  if (!state.days.length) {
    dayList.innerHTML = '<div class="empty-state">Noch keine Trainings-Tage erstellt.</div>';
    return;
  }

  dayList.innerHTML = state.days
    .map((day) => {
      const availableExercises = state.exercises.filter(
        (exercise) => !day.exercises.includes(exercise.id)
      );

      return `
        <div class="day-card">
          <div class="day-header">
            <h3>${escapeHtml(day.name)}</h3>
            <button class="danger small" type="button" data-delete-day="${day.id}">
              Entfernen
            </button>
          </div>

          <ul class="day-exercise-list">
            ${
              day.exercises.length
                ? day.exercises
                    .map((exerciseId) => {
                      const exercise = getExerciseById(exerciseId);
                      const name = exercise ? exercise.name : "Unbekannt";
                      return `
                        <li>
                          <span>${escapeHtml(name)}</span>
                          <button
                            class="small"
                            type="button"
                            data-remove-day-exercise="${day.id}"
                            data-exercise-id="${exerciseId}"
                          >
                            Entfernen
                          </button>
                        </li>
                      `;
                    })
                    .join("")
                : '<li class="empty">Keine Übungen zugewiesen.</li>'
            }
          </ul>

          <div class="day-toolbar">
            <select data-add-exercise-select="${day.id}">
              <option value="">Übung hinzufügen</option>
              ${availableExercises
                .map(
                  (exercise) =>
                    `<option value="${exercise.id}">${escapeHtml(exercise.name)}</option>`
                )
                .join("")}
            </select>
            <button class="secondary" type="button" data-add-exercise-btn="${day.id}">
              Hinzufügen
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDaySelect() {
  const selected = daySelect.value || state.days[0]?.id || "";

  daySelect.innerHTML = state.days.length
    ? state.days
        .map(
          (day) =>
            `<option value="${day.id}" ${selected === day.id ? "selected" : ""}>${escapeHtml(day.name)}</option>`
        )
        .join("")
    : "<option value=''>Keine Tage</option>";

  if (!state.days.length) {
    daySelect.value = "";
    return;
  }

  if (!selected || !state.days.some((day) => day.id === selected)) {
    daySelect.value = state.days[0].id;
  } else {
    daySelect.value = selected;
  }
}

function updateWorkoutMeta(dayId) {
  const dateKey = getDateKey(workoutDateActiveInput.value);
  const latest = getLatestWorkoutForDay(dateKey, dayId);

  if (!dayId || !state.days.some((day) => day.id === dayId)) {
    workoutMeta.textContent = "";
    return;
  }

  if (latest) {
    const saved = new Date(latest.savedAt);
    workoutMeta.textContent = `Letztes Workout für ${formatDateLabel(dateKey)}: ${saved.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    return;
  }

  workoutMeta.textContent = `Noch kein Workout für ${formatDateLabel(dateKey)} gespeichert.`;
}

function renderWorkout() {
  const selectedDayId = daySelect.value;
  const dateKey = getDateKey(workoutDateActiveInput.value);
  const day = getDayById(selectedDayId);

  if (!day) {
    workoutList.innerHTML = '<div class="empty-state">Kein Tag ausgewählt.</div>';
    workoutMeta.textContent = "";
    return;
  }

  if (!day.exercises.length) {
    workoutList.innerHTML = '<div class="empty-state">Dieser Tag hat noch keine Übungen.</div>';
    updateWorkoutMeta(selectedDayId);
    return;
  }

  const currentEntries = getCurrentWorkoutValues(dateKey, day.id);

  workoutList.innerHTML = day.exercises
    .map((exerciseId) => {
      const exercise = getExerciseById(exerciseId);
      if (!exercise) return "";

      const setCount = getExerciseSetCount(exercise);
      const current = Array.isArray(currentEntries[exerciseId])
        ? currentEntries[exerciseId]
        : Array.from({ length: setCount }, () => "");

      const setInputs = Array.from({ length: setCount }, (_, setIndex) => {
        const value = current[setIndex] ?? "";
        return `
          <label>
            Set ${setIndex + 1}
            <input
              type="number"
              min="0"
              step="0.5"
              value="${value}"
              data-day-id="${day.id}"
              data-exercise-id="${exerciseId}"
              data-set-index="${setIndex}"
              placeholder="0"
            />
          </label>
        `;
      }).join("");

      return `
        <div class="workout-row">
          <div class="exercise-name">${escapeHtml(exercise.name)} <small>(${setCount} Sets)</small></div>
          <div class="inputs">
            ${setInputs}
          </div>
        </div>
      `;
    })
    .join("");

  updateWorkoutMeta(day.id);
}

function renderSavedWorkouts() {
  const dateKey = getDateKey(workoutDateInput.value);
  const workouts = getDayWorkoutsForDate(dateKey);

  if (!workouts.length) {
    savedWorkoutsList.innerHTML = '<div class="empty-state">Keine gespeicherten Workouts für dieses Datum.</div>';
    return;
  }

  savedWorkoutsList.innerHTML = workouts
    .map((entry) => {
      const day = getDayById(entry.dayId);
      const savedDayName = day ? day.name : "Unbekannter Tag";
      const isEditing = editingWorkoutRef && editingWorkoutRef.dateKey === dateKey && editingWorkoutRef.workoutId === entry.id;

      return `
        <div class="saved-workout-item">
          <div>
            <strong>${escapeHtml(savedDayName)}</strong>
            <small>${formatDateLabel(dateKey)} • ${new Date(entry.savedAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit"
            })}</small>
          </div>
          <div class="saved-workout-actions">
            <button type="button" class="secondary small" data-load-workout-id="${entry.id}" data-load-workout-date="${dateKey}">
              Laden
            </button>
            <button type="button" class="secondary small" data-edit-workout-id="${entry.id}" data-edit-workout-date="${dateKey}">
              ${isEditing ? "Bearbeitet" : "Bearbeiten"}
            </button>
            <button type="button" class="danger small" data-delete-workout-id="${entry.id}" data-delete-workout-date="${dateKey}">
              Löschen
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAll() {
  renderExercises();
  renderDays();
  renderDaySelect();
  renderSavedWorkouts();
  renderWorkout();
}

function saveSelectedWorkout() {
  const selectedDayId = daySelect.value;
  const dateKey = getDateKey(workoutDateActiveInput.value);
  const day = getDayById(selectedDayId);

  if (!day) return;

  const workoutEntries = captureWorkoutEntries(selectedDayId);

  if (editingWorkoutRef && editingWorkoutRef.dateKey === dateKey && editingWorkoutRef.workoutId) {
    const workout = state.workouts[dateKey]?.find((entry) => entry.id === editingWorkoutRef.workoutId);

    if (workout) {
      workout.dayId = selectedDayId;
      workout.savedAt = new Date().toISOString();
      workout.entries = clone(workoutEntries);
      state.logs[`${dateKey}:${selectedDayId}`] = clone(workoutEntries);
      editingWorkoutRef = null;
      saveState();
      renderSavedWorkouts();
      renderWorkout();
      return;
    }
  }

  const workout = {
    id: uid(),
    dayId: selectedDayId,
    savedAt: new Date().toISOString(),
    entries: workoutEntries
  };

  if (!Array.isArray(state.workouts[dateKey])) {
    state.workouts[dateKey] = [];
  }

  state.workouts[dateKey].push(workout);
  state.logs[`${dateKey}:${selectedDayId}`] = clone(workout.entries);
  editingWorkoutRef = null;
  saveState();
  renderSavedWorkouts();
  renderWorkout();
}

function loadWorkoutEntry(dateKey, workoutId) {
  const workouts = getDayWorkoutsForDate(dateKey);
  const selectedWorkout = workouts.find((entry) => entry.id === workoutId);

  if (!selectedWorkout) return;

  editingWorkoutRef = null;
  daySelect.value = selectedWorkout.dayId;
  workoutDateActiveInput.value = dateKey;
  state.logs[`${dateKey}:${selectedWorkout.dayId}`] = clone(selectedWorkout.entries);

  renderWorkout();
  renderSavedWorkouts();
}

function editWorkoutEntry(dateKey, workoutId) {
  const workouts = getDayWorkoutsForDate(dateKey);
  const selectedWorkout = workouts.find((entry) => entry.id === workoutId);

  if (!selectedWorkout) return;

  editingWorkoutRef = { dateKey, workoutId };
  daySelect.value = selectedWorkout.dayId;
  workoutDateActiveInput.value = dateKey;
  state.logs[`${dateKey}:${selectedWorkout.dayId}`] = clone(selectedWorkout.entries);

  renderWorkout();
  renderSavedWorkouts();
}

function deleteWorkoutEntry(dateKey, workoutId) {
  const workouts = getDayWorkoutsForDate(dateKey);
  const filtered = workouts.filter((entry) => entry.id !== workoutId);

  if (!filtered.length) {
    delete state.workouts[dateKey];
  } else {
    state.workouts[dateKey] = filtered;
  }

  if (editingWorkoutRef && editingWorkoutRef.dateKey === dateKey && editingWorkoutRef.workoutId === workoutId) {
    editingWorkoutRef = null;
  }

  saveState();
  renderSavedWorkouts();
  renderWorkout();
}

exerciseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = document.getElementById("exercise-name");
  const setsInput = document.getElementById("exercise-sets");
  const name = input.value.trim();
  const sets = normalizeSets(setsInput.value);

  if (!name) return;

  const exists = state.exercises.some(
    (exercise) => exercise.name.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    input.value = "";
    setsInput.value = "3";
    return;
  }

  state.exercises.push({
    id: uid(),
    name,
    sets
  });

  saveState();
  input.value = "";
  setsInput.value = "3";
  renderAll();
});

dayForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = document.getElementById("day-name");
  const name = input.value.trim();

  if (!name) return;

  const exists = state.days.some((day) => day.name.toLowerCase() === name.toLowerCase());

  if (exists) {
    input.value = "";
    return;
  }

  state.days.push({
    id: uid(),
    name,
    exercises: []
  });

  saveState();
  input.value = "";
  renderAll();
});

exerciseList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const id = target.dataset.deleteExercise;
  if (!id) return;

  state.exercises = state.exercises.filter((exercise) => exercise.id !== id);

  state.days = state.days.map((day) => ({
    ...day,
    exercises: day.exercises.filter((exerciseId) => exerciseId !== id)
  }));

  Object.keys(state.workouts).forEach((dateKey) => {
    state.workouts[dateKey] = (state.workouts[dateKey] || []).map((entry) => ({
      ...entry,
      entries: Object.fromEntries(
        Object.entries(entry.entries || {}).filter(([exerciseId]) => exerciseId !== id)
      )
    }));
  });

  Object.keys(state.logs).forEach((key) => {
    if (key.includes(`:${id}`)) {
      delete state.logs[key];
    }
  });

  saveState();
  renderAll();
});

dayList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const deleteDayId = target.dataset.deleteDay;
  if (deleteDayId) {
    state.days = state.days.filter((day) => day.id !== deleteDayId);

    Object.keys(state.workouts).forEach((dateKey) => {
      state.workouts[dateKey] = (state.workouts[dateKey] || []).filter(
        (entry) => entry.dayId !== deleteDayId
      );
    });

    Object.keys(state.logs).forEach((key) => {
      if (key.includes(`:${deleteDayId}`)) {
        delete state.logs[key];
      }
    });

    saveState();
    renderAll();
    return;
  }

  const addExerciseBtnId = target.dataset.addExerciseBtn;
  if (addExerciseBtnId) {
    const select = document.querySelector(
      `select[data-add-exercise-select="${addExerciseBtnId}"]`
    );

    if (!select) return;

    const exerciseId = select.value;
    if (!exerciseId) return;

    const day = getDayById(addExerciseBtnId);
    if (!day) return;

    if (!day.exercises.includes(exerciseId)) {
      day.exercises.push(exerciseId);
      saveState();
      renderAll();
    }

    select.value = "";
    return;
  }

  const exerciseId = target.dataset.exerciseId;
  const dayId = target.dataset.removeDayExercise;
  if (exerciseId && dayId) {
    const day = getDayById(dayId);
    if (!day) return;

    day.exercises = day.exercises.filter((id) => id !== exerciseId);

    Object.keys(state.workouts).forEach((dateKey) => {
      state.workouts[dateKey] = (state.workouts[dateKey] || []).map((entry) => ({
        ...entry,
        entries: Object.fromEntries(
          Object.entries(entry.entries || {}).filter(([id]) => id !== exerciseId)
        )
      }));
    });

    Object.keys(state.logs).forEach((key) => {
      if (key.endsWith(`:${dayId}`)) {
        const entries = state.logs[key] || {};
        delete entries[exerciseId];
      }
    });

    saveState();
    renderAll();
  }
});

dayList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;

  const dayId = target.dataset.addExerciseSelect;
  if (!dayId) return;

  const exerciseId = target.value;
  if (!exerciseId) return;

  const day = getDayById(dayId);
  if (!day) return;

  if (!day.exercises.includes(exerciseId)) {
    day.exercises.push(exerciseId);
    saveState();
    renderAll();
  }

  target.value = "";
});

daySelect.addEventListener("change", () => {
  const dateKey = getDateKey(workoutDateActiveInput.value);
  const saved = getCurrentWorkoutValues(dateKey, daySelect.value);
  state.logs[`${dateKey}:${daySelect.value}`] = clone(saved);
  renderWorkout();
});

workoutDateInput.addEventListener("change", () => {
  workoutDateActiveInput.value = workoutDateInput.value;
  updateDateLabel();
  renderSavedWorkouts();
  renderWorkout();
});

workoutDateActiveInput.addEventListener("change", () => {
  workoutDateInput.value = workoutDateActiveInput.value;
  updateDateLabel();
  renderSavedWorkouts();
  renderWorkout();
});

// Prev/Next buttons references — use delegated handlers below to avoid duplicates
const datePrevBtn = document.getElementById("date-prev");
const dateNextBtn = document.getElementById("date-next");
// Attach dedicated click handlers to the Prev/Next buttons to avoid
// accidental duplicate invocations from delegated handlers.
const dateControls = document.querySelector(".date-controls");
if (dateControls) {
  if (datePrevBtn) {
    datePrevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      changeWorkoutDateBy(-1);
      flashDateButton('prev');
    });
  }

  if (dateNextBtn) {
    dateNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      changeWorkoutDateBy(1);
      flashDateButton('next');
    });
  }

  // Allow keyboard left/right when focus is on the date input or controls
  function flashDateButton(dir) {
    try {
      const btn = document.querySelector(`button[data-dir="${dir}"]`);
      if (!btn) return;
      btn.classList.add('active');
      window.setTimeout(() => btn.classList.remove('active'), 220);
    } catch (e) {}
  }

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const within = dateControls.contains(active) || active === workoutDateActiveInput;
    if (!within) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      changeWorkoutDateBy(-1);
      flashDateButton('prev');
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      changeWorkoutDateBy(1);
      flashDateButton('next');
    }
  });
}

savedWorkoutsList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const loadWorkoutId = target.dataset.loadWorkoutId;
  const editWorkoutId = target.dataset.editWorkoutId;
  const deleteWorkoutId = target.dataset.deleteWorkoutId;
  const dateKey = target.dataset.loadWorkoutDate || target.dataset.editWorkoutDate || target.dataset.deleteWorkoutDate;

  if (loadWorkoutId && dateKey) {
    loadWorkoutEntry(dateKey, loadWorkoutId);
    return;
  }

  if (editWorkoutId && dateKey) {
    editWorkoutEntry(dateKey, editWorkoutId);
    return;
  }

  if (deleteWorkoutId && dateKey) {
    deleteWorkoutEntry(dateKey, deleteWorkoutId);
  }
});

saveWorkoutBtn.addEventListener("click", saveSelectedWorkout);

workoutList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const dayId = target.dataset.dayId;
  const exerciseId = target.dataset.exerciseId;
  const setIndex = Number(target.dataset.setIndex);

  if (!dayId || !exerciseId || Number.isNaN(setIndex)) return;

  const dateKey = getDateKey(workoutDateActiveInput.value);
  const key = `${dateKey}:${dayId}`;

  if (!state.logs[key]) {
    state.logs[key] = {};
  }

  if (!Array.isArray(state.logs[key][exerciseId])) {
    const exercise = getExerciseById(exerciseId);
    state.logs[key][exerciseId] = Array.from({ length: getExerciseSetCount(exercise) }, () => "");
  }

  state.logs[key][exerciseId][setIndex] = target.value === "" ? "" : Number(target.value);
  saveState();
});

workoutDateInput.value = getTodayDateKey();
workoutDateActiveInput.value = getTodayDateKey();
updateDateLabel();
renderAll();

// Show a quick build/loaded timestamp to help verify the loaded assets
try {
  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = new Date().toISOString();
} catch (e) {
  // ignore
}
