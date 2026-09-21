const STORAGE_KEY = "fitness-tracker-v1";

const defaultState = {
  exercises: [
    { id: "bench", name: "Bench Press" },
    { id: "squats", name: "Squats" },
    { id: "deadlifts", name: "Deadlifts" },
    { id: "ohp", name: "Overhead Press" },
    { id: "rows", name: "Barbell Row" },
    { id: "pullups", name: "Pull-ups" }
  ],
  days: [
    { id: "push", name: "Push", exercises: ["bench", "ohp"] },
    { id: "pull", name: "Pull", exercises: ["rows", "pullups"] },
    { id: "legs", name: "Legs", exercises: ["squats", "deadlifts"] }
  ],
  logs: {}
};

let state = loadState();

const exerciseForm = document.getElementById("exercise-form");
const dayForm = document.getElementById("day-form");
const exerciseList = document.getElementById("exercise-list");
const dayList = document.getElementById("day-list");
const daySelect = document.getElementById("day-select");
const workoutList = document.getElementById("workout-list");

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

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) {
      return clone(defaultState);
    }

    return {
      exercises: Array.isArray(saved.exercises) ? saved.exercises : clone(defaultState.exercises),
      days: Array.isArray(saved.days) ? saved.days : clone(defaultState.days),
      logs: saved.logs && typeof saved.logs === "object" ? saved.logs : {}
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

function renderExercises() {
  if (!state.exercises.length) {
    exerciseList.innerHTML = '<li class="empty">Keine Übungen vorhanden.</li>';
    return;
  }

  exerciseList.innerHTML = state.exercises
    .map(
      (exercise) => `
        <li>
          <span>${escapeHtml(exercise.name)}</span>
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

function renderWorkout() {
  const selectedDayId = daySelect.value;
  const day = getDayById(selectedDayId);

  if (!day) {
    workoutList.innerHTML = '<div class="empty-state">Kein Tag ausgewählt.</div>';
    return;
  }

  if (!day.exercises.length) {
    workoutList.innerHTML = '<div class="empty-state">Dieser Tag hat noch keine Übungen.</div>';
    return;
  }

  workoutList.innerHTML = day.exercises
    .map((exerciseId) => {
      const exercise = getExerciseById(exerciseId);
      if (!exercise) return "";

      const current = state.logs[day.id]?.[exerciseId] || { weight: "", reps: "" };

      return `
        <div class="workout-row">
          <div class="exercise-name">${escapeHtml(exercise.name)}</div>
          <div class="inputs">
            <label>
              Gewicht
              <input
                type="number"
                min="0"
                step="0.5"
                value="${current.weight}"
                data-day-id="${day.id}"
                data-exercise-id="${exerciseId}"
                data-field="weight"
                placeholder="0"
              />
            </label>
            <label>
              Reps
              <input
                type="number"
                min="0"
                step="1"
                value="${current.reps}"
                data-day-id="${day.id}"
                data-exercise-id="${exerciseId}"
                data-field="reps"
                placeholder="0"
              />
            </label>
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
  renderWorkout();
}

exerciseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = document.getElementById("exercise-name");
  const name = input.value.trim();

  if (!name) return;

  const exists = state.exercises.some(
    (exercise) => exercise.name.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    input.value = "";
    return;
  }

  state.exercises.push({
    id: uid(),
    name
  });

  saveState();
  input.value = "";
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

  Object.keys(state.logs).forEach((dayId) => {
    if (state.logs[dayId] && state.logs[dayId][id]) {
      delete state.logs[dayId][id];
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
    delete state.logs[deleteDayId];
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
    if (state.logs[day.id] && state.logs[day.id][exerciseId]) {
      delete state.logs[day.id][exerciseId];
    }

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
  renderWorkout();
});

workoutList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const dayId = target.dataset.dayId;
  const exerciseId = target.dataset.exerciseId;
  const field = target.dataset.field;

  if (!dayId || !exerciseId || !field) return;

  const value = target.value.trim();

  if (!state.logs[dayId]) {
    state.logs[dayId] = {};
  }

  if (!state.logs[dayId][exerciseId]) {
    state.logs[dayId][exerciseId] = { weight: "", reps: "" };
  }

  state.logs[dayId][exerciseId][field] = value === "" ? "" : Number(value);
  saveState();
});

renderAll();
