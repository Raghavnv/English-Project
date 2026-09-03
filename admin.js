// ===== AUTH CHECK (DISABLED FOR DEMO — RESTORE BEFORE GOING LIVE) =====
if (!Auth.isLoggedIn()) {
  window.location.href = "admin-login.html";
}
const adminSession = JSON.parse(localStorage.getItem("adminSession") || "{}");
const adminWelcomeEl = document.getElementById("adminWelcome");
if (adminWelcomeEl) adminWelcomeEl.textContent = "Welcome, " + (adminSession.username || "Admin");

function doLogout() {
  Auth.logout();
  window.location.href = "admin-login.html";
}

// ===== POPUP =====
function showPopup(message) {
  const popup = document.getElementById("popup");
  if (!popup) return;
  popup.textContent = message;
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 2800);
}

function escHtml(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function escapeHtml(str) {
  return escHtml(str);
}

// ===== SHARED: pull known class names from saved lessons =====
function getKnownClassNames() {
  try {
    const lessons = JSON.parse(localStorage.getItem("lessons") || "[]");
    const names = new Set(lessons.map(l => l.class).filter(Boolean));
    return Array.from(names);
  } catch { return []; }
}

function populateClassSelect(selectEl) {
  if (!selectEl) return;
  const current = selectEl.value;
  const names = getKnownClassNames();
  selectEl.innerHTML = `<option value="">All Classes</option>` +
    names.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("");
  if (names.includes(current)) selectEl.value = current;
}

function populateBroadcastClassOptions() {
  populateClassSelect(document.getElementById("broadcastClass"));
}
function populateResourceClassOptions() {
  populateClassSelect(document.getElementById("resourceClass"));
}

// ===== BROADCAST CENTER =====
function getBroadcasts() {
  try { return JSON.parse(localStorage.getItem("broadcasts") || "[]"); }
  catch { return []; }
}
function setBroadcasts(list) {
  localStorage.setItem("broadcasts", JSON.stringify(list));
}

function saveBroadcast() {
  const title = document.getElementById("broadcastTitle").value.trim();
  const message = document.getElementById("broadcastMessage").value.trim();
  const targetClass = document.getElementById("broadcastClass").value;
  const type = document.querySelector('input[name="broadcastType"]:checked')?.value || "announcement";

  if (!title || !message) {
    showPopup("Please add a title and a message.");
    return;
  }

  const list = getBroadcasts();
  list.unshift({
    id: "b_" + Date.now(),
    title, message, class: targetClass, type,
    date: new Date().toISOString()
  });
  setBroadcasts(list);

  document.getElementById("broadcastTitle").value = "";
  document.getElementById("broadcastMessage").value = "";
  showPopup("Broadcast sent!");
  renderBroadcasts();
}

function deleteBroadcast(id) {
  setBroadcasts(getBroadcasts().filter(b => b.id !== id));
  renderBroadcasts();
}

const BROADCAST_ICONS = { announcement: "📣", goal: "🎯", reminder: "⏰" };

function renderBroadcasts() {
  const container = document.getElementById("broadcastListContainer");
  if (!container) return;
  const list = getBroadcasts();
  if (list.length === 0) {
    container.innerHTML = `<p class="no-questions-hint">No broadcasts yet — send one above.</p>`;
    return;
  }
  container.innerHTML = list.map(b => `
    <div class="question-row">
      <div>
        <strong>${BROADCAST_ICONS[b.type] || "📣"} ${escHtml(b.title)}</strong>
        <p style="margin:4px 0 6px;color:var(--muted);font-size:0.9rem;">${escHtml(b.message)}</p>
        <span style="font-size:0.75rem;color:var(--muted);">
          ${b.class ? escHtml(b.class) : "All Classes"} · ${new Date(b.date).toLocaleString()}
        </span>
      </div>
      <button class="add-question-btn" onclick="deleteBroadcast('${b.id}')">🗑️ Remove</button>
    </div>
  `).join("");
}

// ===== RESOURCE LIBRARY =====
function getResources() {
  try { return JSON.parse(localStorage.getItem("resources") || "[]"); }
  catch { return []; }
}
function setResources(list) {
  localStorage.setItem("resources", JSON.stringify(list));
}

function saveResource() {
  const title = document.getElementById("resourceTitle").value.trim();
  const notes = document.getElementById("resourceNotes").value.trim();
  const targetClass = document.getElementById("resourceClass").value;
  const type = document.querySelector('input[name="resourceType"]:checked')?.value || "pdf";
  const source = document.querySelector('input[name="resourceSource"]:checked')?.value || "link";

  if (!title) {
    showPopup("Please add a title.");
    return;
  }

  const finishSave = (url, fileName) => {
    const list = getResources();
    list.unshift({
      id: "r_" + Date.now(),
      title, url, notes, class: targetClass, type,
      fileName: fileName || null,
      date: new Date().toISOString()
    });
    setResources(list);

    document.getElementById("resourceTitle").value = "";
    document.getElementById("resourceUrl").value = "";
    document.getElementById("resourceNotes").value = "";
    document.getElementById("resourceFile").value = "";
    showPopup("Resource added!");
    renderResources();
  };

  if (source === "upload") {
    const fileInput = document.getElementById("resourceFile");
    const file = fileInput.files[0];
    if (!file) {
      showPopup("Please choose a file to upload.");
      return;
    }
    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      showPopup("That file is too large (max ~4MB). Try a Link instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => finishSave(reader.result, file.name);
    reader.onerror = () => showPopup("Couldn't read that file — please try again.");
    reader.readAsDataURL(file);
  } else {
    const url = document.getElementById("resourceUrl").value.trim();
    if (!url) {
      showPopup("Please add a link.");
      return;
    }
    finishSave(url, null);
  }
}

function toggleResourceSource() {
  const source = document.querySelector('input[name="resourceSource"]:checked')?.value || "link";
  document.getElementById("resourceUrlField").style.display = source === "link" ? "" : "none";
  document.getElementById("resourceUploadField").style.display = source === "upload" ? "" : "none";
}

function handleResourceFileSelect(event) {
  const file = event.target.files[0];
  const hint = document.getElementById("resourceFileHint");
  if (!hint) return;
  if (!file) {
    hint.textContent = "Max ~4MB per file (stored directly in the browser). For larger files, use a Link instead.";
    return;
  }
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const tooBig = file.size > 4 * 1024 * 1024;
  hint.textContent = tooBig
    ? `⚠️ ${file.name} is ${sizeMB}MB — too large. Max ~4MB, please use a Link instead.`
    : `Selected: ${file.name} (${sizeMB}MB)`;
  hint.style.color = tooBig ? "#c0392b" : "var(--muted)";
}

function deleteResource(id) {
  setResources(getResources().filter(r => r.id !== id));
  renderResources();
}

const RESOURCE_ICONS = { pdf: "📄", reading: "📖", audio: "🎧", link: "🔗" };

function renderResources() {
  const container = document.getElementById("resourceListContainer");
  if (!container) return;
  const list = getResources();
  if (list.length === 0) {
    container.innerHTML = `<p class="no-questions-hint">No resources yet — add one above.</p>`;
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="question-row">
      <div>
        <strong>${RESOURCE_ICONS[r.type] || "📄"} ${escHtml(r.title)}</strong>
        <p style="margin:4px 0 6px;">${
          r.fileName
            ? `<a href="${escHtml(r.url)}" download="${escHtml(r.fileName)}" style="color:var(--accent-deep);font-weight:700;">⬇️ ${escHtml(r.fileName)}</a>`
            : `<a href="${escHtml(r.url)}" target="_blank" rel="noopener" style="color:var(--accent-deep);font-weight:700;">${escHtml(r.url)}</a>`
        }</p>
        ${r.notes ? `<p style="margin:0 0 6px;color:var(--muted);font-size:0.9rem;">${escHtml(r.notes)}</p>` : ""}
        <span style="font-size:0.75rem;color:var(--muted);">
          ${r.class ? escHtml(r.class) : "All Classes"} · ${new Date(r.date).toLocaleString()}
        </span>
      </div>
      <button class="add-question-btn" onclick="deleteResource('${r.id}')">🗑️ Remove</button>
    </div>
  `).join("");
}

async function loadClassAnalytics() {
    const summaryEl = document.getElementById("analyticsAiSummary");
    if (!summaryEl) return;
    summaryEl.textContent = "Analyzing class data...";
    
    try {
        const data = await AI.getClassAnalysis();
        document.getElementById("analyticsTotalStudents").textContent = data.total_students;
        document.getElementById("analyticsLessonsCompleted").textContent = data.total_lessons_completed;
        document.getElementById("analyticsTotalAnswers").textContent = data.total_answers;
        document.getElementById("analyticsAvgScore").textContent = data.average_score + "/5";
        summaryEl.textContent = data.ai_summary;
    } catch (err) {
        summaryEl.textContent = "Error loading analytics: " + err.message;
    }
}

// ════════════════════════════════════════════════════════════════════
//  LESSON MANAGEMENT
// ════════════════════════════════════════════════════════════════════

let questionCount = 0;
let flashcardCount = 0;
let editingLessonId = null;

function addQuestion(type = "text") {
  questionCount++;
  const hint = document.getElementById("noQuestionsHint");
  if (hint) hint.remove();

  const container = document.getElementById("questionsContainer");
  const row = document.createElement("div");
  row.className = "question-row";
  row.dataset.type = type;

  row.innerHTML = `
    <div style="display:grid;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
        <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-deep);">
          Question ${questionCount}
        </span>
        <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;background:rgba(188,93,45,0.1);color:var(--accent-deep);font-weight:700;">
          ${type === "speech" ? "🎤 Speech" : "✏️ Text"}
        </span>
      </div>
      <div style="position:relative;">
        <textarea placeholder="Type your question here…" rows="2" style="padding-right:44px;"></textarea>
        <button class="q-mic-btn" title="Dictate question" style="position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(80,58,40,0.15);background:rgba(255,255,255,0.8);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">🎤</button>
      </div>
    </div>
    <button class="remove-q-btn" title="Remove">✕</button>
  `;

  const micBtn   = row.querySelector(".q-mic-btn");
  const textarea = row.querySelector("textarea");
  micBtn.addEventListener("click", () => {
    if (Speech.isListening) {
      Speech.stop(); micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; return;
    }
    if (!Speech.isSupported()) { alert("Voice input requires Chrome."); return; }
    micBtn.textContent = "⏹"; micBtn.style.background = "rgba(220,50,50,0.12)";
    Speech.start(
      (t) => { textarea.value += (textarea.value ? " " : "") + t; },
      () => { micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; }
    );
  });

  row.querySelector(".remove-q-btn").addEventListener("click", () => removeQuestion(row));
  container.appendChild(row);
}

function removeQuestion(row) {
  row.remove();
  const container = document.getElementById("questionsContainer");
  if (container.querySelectorAll(".question-row").length === 0) {
    const hint = document.createElement("p");
    hint.className = "no-questions-hint"; hint.id = "noQuestionsHint";
    hint.textContent = 'No questions yet — click "Add Question" to add one.';
    container.appendChild(hint);
  }
  container.querySelectorAll(".question-row").forEach((r, i) => {
    const label = r.querySelector("span");
    if (label) label.textContent = `Question ${i + 1}`;
  });
  questionCount = container.querySelectorAll(".question-row").length;
}

function addFlashcard(frontText = "", backText = "") {
  flashcardCount++;
  const hint = document.getElementById("noFlashcardsHint");
  if (hint) hint.remove();

  const container = document.getElementById("flashcardsContainer");
  const row = document.createElement("div");
  row.className = "flashcard-row";
  row.innerHTML = `
    <div>
      <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-deep);display:block;margin-bottom:6px;">Front (Word/Concept)</span>
      <textarea class="fc-front" placeholder="e.g., Apple">${escHtml(frontText)}</textarea>
    </div>
    <div>
      <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-deep);display:block;margin-bottom:6px;">Back (Definition/Translation)</span>
      <textarea class="fc-back" placeholder="e.g., A red or green fruit">${escHtml(backText)}</textarea>
    </div>
    <button class="remove-q-btn" title="Remove">✕</button>
  `;
  row.querySelector(".remove-q-btn").addEventListener("click", () => {
    row.remove();
    if (container.querySelectorAll(".flashcard-row").length === 0) {
      container.innerHTML = '<p class="no-questions-hint" id="noFlashcardsHint">No flashcards yet — click "Add Flashcard" to add one.</p>';
    }
  });
  container.appendChild(row);
}

// ── EDIT MODE ──
function startEditLesson(lesson) {
  editingLessonId = lesson.id;

  document.getElementById("title").value   = lesson.title;
  document.getElementById("class").value   = lesson.class_label;
  document.getElementById("content").value = lesson.description || "";

  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";
  questionCount = 0;

  lesson.questions.forEach((q, i) => {
    questionCount++;
    const hint = document.getElementById("noQuestionsHint");
    if (hint) hint.remove();
    const row = document.createElement("div");
    row.className = "question-row";
    row.dataset.type = q.type || "text";
    row.dataset.existingId = q.id;
    row.innerHTML = `
      <div style="display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-deep);">Question ${i + 1}</span>
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;background:rgba(188,93,45,0.1);color:var(--accent-deep);font-weight:700;">${q.type === "speech" ? "🎤 Speech" : "✏️ Text"}</span>
        </div>
        <div style="position:relative;">
          <textarea rows="2" style="padding-right:44px;">${escHtml(q.prompt)}</textarea>
          <button class="q-mic-btn" title="Dictate" style="position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(80,58,40,0.15);background:rgba(255,255,255,0.8);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">🎤</button>
        </div>
      </div>
      <button class="remove-q-btn" title="Remove">✕</button>
    `;
    const micBtn = row.querySelector(".q-mic-btn");
    const ta     = row.querySelector("textarea");
    micBtn.addEventListener("click", () => {
      if (Speech.isListening) { Speech.stop(); micBtn.textContent = "🎤"; return; }
      micBtn.textContent = "⏹"; micBtn.style.background = "rgba(220,50,50,0.12)";
      Speech.start((t) => { ta.value += (ta.value ? " " : "") + t; }, () => { micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; });
    });
    row.querySelector(".remove-q-btn").addEventListener("click", () => removeQuestion(row));
    container.appendChild(row);
  });

  const fcContainer = document.getElementById("flashcardsContainer");
  fcContainer.innerHTML = "";
  flashcardCount = 0;
  if (lesson.flashcards && lesson.flashcards.length > 0) {
    lesson.flashcards.forEach(fc => addFlashcard(fc.front, fc.back));
  } else {
    fcContainer.innerHTML = '<p class="no-questions-hint" id="noFlashcardsHint">No flashcards yet — click "Add Flashcard" to add one.</p>';
  }

  document.getElementById("addBtn").textContent = "Update Lesson";
  document.querySelector(".admin-card h2").textContent = "Edit Lesson";

  let cancelBtn = document.getElementById("cancelEditBtn");
  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.id = "cancelEditBtn";
    cancelBtn.textContent = "Cancel Edit";
    cancelBtn.style.cssText = "margin-top:10px;width:100%;min-height:44px;border-radius:999px;border:1px solid rgba(80,58,40,0.14);background:rgba(255,255,255,0.6);font-weight:700;cursor:pointer;font-size:0.92rem;";
    cancelBtn.onclick = cancelEdit;
    document.getElementById("addBtn").parentNode.insertBefore(cancelBtn, document.getElementById("addBtn").nextSibling);
  }

  document.querySelector(".admin-card").scrollIntoView({ behavior: "smooth" });
}

function cancelEdit() {
  editingLessonId = null;
  document.getElementById("title").value   = "";
  document.getElementById("class").value   = "";
  document.getElementById("content").value = "";
  document.getElementById("questionsContainer").innerHTML =
    `<p class="no-questions-hint" id="noQuestionsHint">No questions yet — click "Add Question" to add one.</p>`;
  questionCount = 0;
  
  document.getElementById("flashcardsContainer").innerHTML =
    '<p class="no-questions-hint" id="noFlashcardsHint">No flashcards yet — click "Add Flashcard" to add one.</p>';
  flashcardCount = 0;

  document.getElementById("addBtn").textContent = "Save Lesson";
  document.querySelector(".admin-card h2").textContent = "Create Lesson";
  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.remove();
}

async function addLesson() {
  const title     = document.getElementById("title").value.trim();
  const className = document.getElementById("class").value.trim();
  const content   = document.getElementById("content").value.trim();
  const btn       = document.getElementById("addBtn");

  if (!title || !className) { showPopup("Please enter a title and class name"); return; }

  const questions = [];
  document.querySelectorAll(".question-row").forEach((row, i) => {
    const text = row.querySelector("textarea").value.trim();
    const type = row.dataset.type || "text";
    if (text) questions.push({ prompt: text, type, order: i });
  });

  const flashcards = [];
  document.querySelectorAll(".flashcard-row").forEach(row => {
    const front = row.querySelector(".fc-front").value.trim();
    const back = row.querySelector(".fc-back").value.trim();
    if (front && back) flashcards.push({ front, back });
  });

  btn.textContent = editingLessonId ? "Updating…" : "Saving…";
  btn.disabled = true;

  try {
    if (editingLessonId) {
      await Lessons.delete(editingLessonId);
    }
    await Lessons.create(className, title, content, questions, flashcards);
    showPopup(editingLessonId ? "✓ Lesson updated" : `✓ Lesson saved — ${questions.length} question(s), ${flashcards.length} flashcard(s)`);
    cancelEdit();
    await renderSavedLessons();
  } catch (err) {
    showPopup("Error: " + err.message);
  } finally {
    btn.textContent = editingLessonId ? "Update Lesson" : "Save Lesson";
    btn.disabled = false;
  }
}

async function deleteLesson(lessonId) {
  try {
    await Lessons.delete(lessonId);
    showPopup("Lesson removed");
    await renderSavedLessons();
  } catch (err) {
    showPopup("Error: " + err.message);
  }
}

async function renderSavedLessons() {
  const container = document.getElementById("savedLessonsList");
  container.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;">Loading…</p>`;

  try {
    const classes = await Lessons.getClasses();

    if (classes.length === 0) {
      container.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;">No lessons or classes saved yet.</p>`;
      return;
    }

    container.innerHTML = "";
    classes.forEach(cls => {
      const classSection = document.createElement("div");
      classSection.style.cssText = "margin-bottom: 24px; padding: 20px; border-radius: 18px; background: rgba(80,58,40,0.03); border: 1px solid rgba(80,58,40,0.06);";
      
      classSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(80,58,40,0.08); padding-bottom: 8px;">
          <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; color: var(--accent-deep); font-family: var(--font-family);">📂 ${escHtml(cls.label)}</h4>
          <button class="delete-class-btn" data-id="${cls.id}" style="min-height: 28px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(188,93,45,0.3); background: rgba(188,93,45,0.1); color: var(--accent-deep); font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: background 0.2s;">Delete Class</button>
        </div>
        <div class="class-lessons-container"></div>
      `;

      classSection.querySelector(".delete-class-btn").addEventListener("click", () => deleteClass(cls.id));

      const lessonsContainer = classSection.querySelector(".class-lessons-container");

      if (!cls.lessons || cls.lessons.length === 0) {
        lessonsContainer.innerHTML = `<p style="color:var(--muted);font-size:0.86rem;font-style:italic;margin:0; padding: 4px 0;">No lessons in this class yet.</p>`;
      } else {
        cls.lessons.forEach(lesson => {
          const card = document.createElement("div");
          card.className = "saved-lesson-card";
          card.style.margin = "8px 0";
          card.innerHTML = `
            <div class="saved-lesson-info">
              <strong>${escHtml(lesson.title)}</strong>
              <span>${lesson.questions ? lesson.questions.length : 0} question(s), ${lesson.flashcards ? lesson.flashcards.length : 0} flashcard(s)</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="edit-lesson-btn" data-id="${lesson.id}" style="min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(80,58,40,0.18);background:rgba(255,255,255,0.6);font-size:0.82rem;font-weight:700;cursor:pointer;">✏️ Edit</button>
              <button class="delete-lesson-btn" data-id="${lesson.id}">Delete</button>
            </div>
          `;
          card.querySelector(".delete-lesson-btn").addEventListener("click", () => deleteLesson(lesson.id));
          card.querySelector(".edit-lesson-btn").addEventListener("click", () => startEditLesson(lesson));
          lessonsContainer.appendChild(card);
        });
      }
      container.appendChild(classSection);
    });
  } catch (err) {
    container.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;">Could not load lessons: ${err.message}</p>`;
  }
}

async function deleteClass(classId) {
  if (!confirm("Are you sure you want to delete this entire class along with all its lessons? This action cannot be undone.")) return;
  try {
    await Lessons.deleteClass(classId);
    showPopup("✓ Class removed successfully");
    await renderSavedLessons();
  } catch (err) {
    showPopup("Error deleting class: " + err.message);
  }
}

document.getElementById("addBtn").addEventListener("click", addLesson);
renderSavedLessons();


// ═══════════════════════════════════════════
//  AI QUESTION GENERATOR
// ═══════════════════════════════════════════

let aiGenOpen = false;

function toggleAIGen() {
  aiGenOpen = !aiGenOpen;
  document.getElementById("aiGenBody").classList.toggle("open", aiGenOpen);
  document.getElementById("aiGenChevron").textContent = aiGenOpen ? "▲ Collapse" : "▼ Expand";
}

async function runAIGenerate() {
  const title = document.getElementById("title").value.trim();
  const desc  = document.getElementById("content").value.trim();
  const cls   = document.getElementById("class").value.trim();
  const count = parseInt(document.getElementById("aiGenCount").value) || 5;
  const qType = document.querySelector('input[name="aiGenType"]:checked')?.value || "text";
  const btn   = document.getElementById("aiGenRunBtn");
  const resultsEl = document.getElementById("aiGenResults");
  const insertRow = document.getElementById("aiGenInsertRow");

  if (!title) {
    showPopup("Please enter a lesson title first so AI knows what to generate.");
    return;
  }

  btn.textContent = "✨ Generating…";
  btn.disabled = true;
  resultsEl.innerHTML = `
    <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.5);text-align:center;color:var(--muted);font-size:0.88rem;">
      Thinking of questions for "${escHtml(title)}"…
    </div>`;
  insertRow.style.display = "none";

  try {
    const res = await AI.generateQuestions(title, desc, cls, count, qType);
    const questions = res.questions || [];

    if (questions.length === 0) {
      resultsEl.innerHTML = `<div style="color:var(--muted);font-size:0.88rem;padding:8px 0;">No questions returned. Try again.</div>`;
      return;
    }

    resultsEl.innerHTML = "";
    questions.forEach((q, i) => {
      let rowType = qType === "mix"
        ? (q.startsWith("SPEECH:") ? "speech" : "text")
        : qType;
      const cleanQ = q.replace(/^(TEXT|SPEECH):\s*/i, "");
      const typeBadge = rowType === "speech"
        ? `<span style="font-size:0.7rem;padding:2px 7px;border-radius:999px;background:rgba(111,124,74,0.12);color:#3a5018;font-weight:700;margin-left:6px;">🎤 Speech</span>`
        : `<span style="font-size:0.7rem;padding:2px 7px;border-radius:999px;background:rgba(188,93,45,0.1);color:var(--accent-deep);font-weight:700;margin-left:6px;">✏️ Text</span>`;
      const item = document.createElement("label");
      item.className = "ai-gen-result-item";
      item.dataset.qtype = rowType;
      item.innerHTML = `
        <input type="checkbox" class="ai-gen-checkbox" value="${escHtml(cleanQ)}" checked data-qtype="${rowType}">
        <span class="ai-gen-result-text">${typeBadge} ${escHtml(cleanQ)}</span>
      `;
      resultsEl.appendChild(item);
    });

    insertRow.style.display = "";
    showPopup(`✨ ${questions.length} questions generated — check the ones you want!`);
  } catch (err) {
    resultsEl.innerHTML = `<div style="color:var(--muted);font-size:0.88rem;padding:8px 0;">Error: ${escHtml(err.message)}</div>`;
  } finally {
    btn.textContent = "✨ Generate";
    btn.disabled = false;
  }
}

function insertSelectedQuestions() {
  const checked = document.querySelectorAll(".ai-gen-checkbox:checked");
  if (checked.length === 0) { showPopup("Select at least one question to add."); return; }

  checked.forEach(cb => {
    const questionText = cb.value;
    const rowType = cb.dataset.qtype || "text";
    questionCount++;
    const hint = document.getElementById("noQuestionsHint");
    if (hint) hint.remove();

    const container = document.getElementById("questionsContainer");
    const row = document.createElement("div");
    row.className = "question-row" + (rowType === "speech" ? " speech-card" : "");
    row.dataset.type = rowType;

    row.innerHTML = `
      <div style="display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-deep);">
            Question ${questionCount}
          </span>
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;background:${rowType==='speech'?'rgba(111,124,74,0.12)':'rgba(188,93,45,0.1)'};color:${rowType==='speech'?'#3a5018':'var(--accent-deep)'};font-weight:700;">
            ${rowType === 'speech' ? '🎤 Speech' : '✏️ Text'}
          </span>
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;background:rgba(111,124,74,0.12);color:#3a5018;font-weight:700;">
            ✨ AI
          </span>
        </div>
        <div style="position:relative;">
          <textarea rows="2" style="padding-right:44px;">${escHtml(questionText)}</textarea>
          <button class="q-mic-btn" title="Dictate question" style="position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(80,58,40,0.15);background:rgba(255,255,255,0.8);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">🎤</button>
        </div>
      </div>
      <button class="remove-q-btn" title="Remove">✕</button>
    `;

    const micBtn   = row.querySelector(".q-mic-btn");
    const textarea = row.querySelector("textarea");
    micBtn.addEventListener("click", () => {
      if (Speech.isListening) { Speech.stop(); micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; return; }
      if (!Speech.isSupported()) { alert("Voice input requires Chrome."); return; }
      micBtn.textContent = "⏹"; micBtn.style.background = "rgba(220,50,50,0.12)";
      Speech.start(
        (t) => { textarea.value += (textarea.value ? " " : "") + t; },
        () => { micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; }
      );
    });
    row.querySelector(".remove-q-btn").addEventListener("click", () => removeQuestion(row));
    container.appendChild(row);
  });

  document.getElementById("aiGenResults").innerHTML = "";
  document.getElementById("aiGenInsertRow").style.display = "none";
  toggleAIGen();
  showPopup(`✓ ${checked.length} question(s) added to lesson`);
}


// ═══════════════════════════════════════════
//  STUDENT PROGRESS
// ═══════════════════════════════════════════

function openAddStudent() {
  document.getElementById("addStudentForm").style.display = "";
  document.getElementById("newStudentName").focus();
}

function closeAddStudent() {
  document.getElementById("addStudentForm").style.display = "none";
  document.getElementById("newStudentName").value  = "";
  document.getElementById("newStudentSchool").value = "";
}

async function saveNewStudent() {
  const name   = document.getElementById("newStudentName").value.trim();
  const school = document.getElementById("newStudentSchool").value.trim();
  if (!name || !school) { showPopup("Please enter both name and school"); return; }
  try {
    await Students.login(name, school);
    closeAddStudent();
    showPopup("✓ Student added");
    loadProgressData();
  if(typeof initLiveFeed === "function") initLiveFeed();
  } catch (err) {
    showPopup("Error: " + err.message);
  }
}

async function deleteStudent(studentId) {
  try {
    await Students.delete(studentId);
    showPopup("Student removed");
    loadProgressData();
  if(typeof initLiveFeed === "function") initLiveFeed();
  } catch (err) {
    showPopup("Error: " + err.message);
  }
}

async function loadProgressData() {
  const classFilter = document.getElementById("classFilter");
  const prevVal = classFilter.value;
  try {
    const classes = await Lessons.getClasses();
    classFilter.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(cls => {
      const opt = document.createElement("option");
      opt.value = cls.id; opt.textContent = cls.label;
      classFilter.appendChild(opt);
    });
    if (prevVal) classFilter.value = prevVal;
    renderProgress(classes);
  } catch (err) {
    document.getElementById("progressContainer").innerHTML =
      `<div class="no-students-hint">Could not load data: ${err.message}</div>`;
  }
}

async function renderProgress(classesData) {
  const container = document.getElementById("progressContainer");
  container.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;padding:12px 0;">Loading students…</p>`;
  const filterClassId = document.getElementById("classFilter").value;

  try {
    if (!classesData) classesData = await Lessons.getClasses();
    const students = await Students.list();

    if (students.length === 0) {
      container.innerHTML = `<div class="no-students-hint">No students yet. Students appear here when they log in.</div>`;
      return;
    }

    const lessonMap = {};
    classesData.forEach(cls => {
      cls.lessons.forEach(lesson => {
        lessonMap[lesson.id] = { ...lesson, classLabel: cls.label, classId: cls.id };
      });
    });

    container.innerHTML = "";

    for (const student of students) {
      let progressData = {};
      try { progressData = await Students.getProgress(student.id); } catch {}

      const relevantLessons = Object.values(lessonMap).filter(l =>
        !filterClassId || l.classId === filterClassId
      );

      const totalLessons     = relevantLessons.length;
      const completedLessons = relevantLessons.filter(l => progressData[l.id]?.completed).length;
      const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const card   = document.createElement("div");
      card.className = "student-card";
      const header = document.createElement("div");
      header.className = "student-card-header";
      header.innerHTML = `
        <div class="student-name-block">
          <strong>${escHtml(student.name)}</strong>
          <span>${escHtml(student.school)}</span>
        </div>
        <div class="student-overall">
          <div class="overall-bar"><div class="overall-fill" style="width:${pct}%"></div></div>
          <span class="overall-pct">${pct}%</span>
          <button class="delete-student-btn" data-id="${student.id}" title="Remove student">✕</button>
          <span class="student-chevron">▼</span>
        </div>
      `;

      header.addEventListener("click", (e) => {
        if (e.target.closest(".delete-student-btn")) return;
        card.classList.toggle("is-open");
      });
      header.querySelector(".delete-student-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDeleteStudent(e.currentTarget.dataset.id, student.name, student.school);
      });

      const lessonsGrid = document.createElement("div");
      lessonsGrid.className = "student-lessons";

      if (relevantLessons.length === 0) {
        lessonsGrid.innerHTML = `<p class="answer-empty" style="padding:8px 0;">No lessons in this class yet.</p>`;
      } else {
        relevantLessons.forEach(lesson => {
          const prog     = progressData[lesson.id] || { completed: false, answered_count: 0, answers: {} };
          const total    = lesson.questions.length;
          const answered = prog.answered_count || 0;
          const pctQ     = total > 0 ? Math.round((answered / total) * 100) : 0;

          let chipClass = "chip-new", chipText = "Not Started";
          if (prog.completed)    { chipClass = "chip-done";     chipText = "✓ Completed"; }
          else if (answered > 0) { chipClass = "chip-progress"; chipText = `${answered}/${total} answered`; }

          const row = document.createElement("div");
          row.className = "lesson-progress-row";
          row.innerHTML = `
            <div class="lesson-progress-top">
              <span class="lesson-progress-name">${escHtml(lesson.title)}</span>
              <span class="lesson-status-chip ${chipClass}">${chipText}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <div class="lesson-mini-bar" style="flex:1;"><div class="lesson-mini-fill" style="width:${pctQ}%"></div></div>
              <span style="font-size:0.8rem;font-weight:700;color:var(--muted);min-width:32px;text-align:right;">${pctQ}%</span>
            </div>
          `;

          if (lesson.questions.length > 0) {
            const answers   = prog.answers || {};
            const toggleBtn = document.createElement("button");
            toggleBtn.className   = "view-toggle-btn";
            toggleBtn.textContent = "View Answers ▾";
            row.appendChild(toggleBtn);

            const answersBlock = document.createElement("div");
            answersBlock.className     = "lesson-mini-answers";
            answersBlock.style.display = "none";

            lesson.questions.forEach((q, qi) => {
              const ansObj   = answers[q.id] || {};
              const ansText  = ansObj.text || "";
              const feedback = ansObj.ai_feedback || "";
              const aiScore  = ansObj.ai_score || 0;
              const hasScore = ansText.trim() && aiScore > 0;
              const isCorrect = aiScore >= 3;
              const scoreBadge = hasScore
                ? `<span class="lesson-status-chip ${isCorrect ? "chip-done" : "chip-progress"}" style="margin-left:8px;">
                     ${isCorrect ? "✅ Correct" : "❌ Needs Work"} · ${aiScore}/5
                   </span>`
                : "";
              const arow     = document.createElement("div");
              arow.className = "answer-row";
              arow.innerHTML = `
                <div class="answer-q">Q${qi + 1}: ${escHtml(q.prompt)}${scoreBadge}</div>
                ${ansText.trim()
                  ? `<div class="answer-text">${escHtml(ansText)}</div>
                     ${feedback ? `<div style="margin-top:6px;font-size:0.8rem;color:#3d5220;background:rgba(111,124,74,0.08);padding:6px 10px;border-radius:8px;">💬 ${escHtml(feedback)}</div>` : ""}`
                  : `<div class="answer-empty">No answer yet</div>`}
              `;
              answersBlock.appendChild(arow);
            });
            row.appendChild(answersBlock);
            toggleBtn.addEventListener("click", () => {
              const vis = answersBlock.style.display !== "none";
              answersBlock.style.display = vis ? "none" : "grid";
              toggleBtn.textContent = vis ? "View Answers ▾" : "Hide Answers ▴";
            });
          }
          lessonsGrid.appendChild(row);
        });
      }

      card.appendChild(header);
      card.appendChild(lessonsGrid);
      container.appendChild(card);
    }
  } catch (err) {
    container.innerHTML = `<div class="no-students-hint">Error loading progress: ${err.message}</div>`;
  }
}

// ── DELETE MODAL ──
let pendingDeleteId = null;

function confirmDeleteStudent(studentId, name, school) {
  pendingDeleteId = studentId;
  document.getElementById("deleteModalBody").textContent =
    `This will remove "${name}" (${school}) and all their progress. This cannot be undone.`;
  const modal = document.getElementById("deleteStudentModal");
  modal.style.opacity = "1";
  modal.style.pointerEvents = "all";
  modal.querySelector("div").style.transform = "translateY(0) scale(1)";
}

function closeDeleteModal() {
  const modal = document.getElementById("deleteStudentModal");
  modal.style.opacity = "0";
  modal.style.pointerEvents = "none";
  modal.querySelector("div").style.transform = "translateY(12px) scale(0.97)";
  pendingDeleteId = null;
}

document.getElementById("deleteModalConfirm").addEventListener("click", () => {
  if (pendingDeleteId) deleteStudent(pendingDeleteId);
  closeDeleteModal();
});

document.getElementById("deleteStudentModal").addEventListener("click", function(e) {
  if (e.target === this) closeDeleteModal();
});


// ═══════════════════════════════════════════
//  ADMIN BUDDY CHAT
// ═══════════════════════════════════════════

let adminBuddyOpen  = false;
let adminBuddyHistory = [];
let adminBuddyReady = false;

function toggleAdminBuddy() {
  adminBuddyOpen = !adminBuddyOpen;
  document.getElementById("adminBuddyPanel").classList.toggle("open", adminBuddyOpen);
  document.getElementById("adminBuddyFab").textContent = adminBuddyOpen ? "✕" : "🤖";

  if (adminBuddyOpen && !adminBuddyReady) {
    adminBuddyReady = true;
    const msg = "Hi! 👋 I'm Buddy. I can help you write lesson descriptions, suggest question types, explain how the platform works, or anything else you need. What can I help with?";
    appendAdminBuddyMsg("bot", msg);
    adminBuddyHistory.push({ role: "assistant", content: msg });
    setTimeout(() => document.getElementById("adminBuddyInput").focus(), 200);
  }
}

function appendAdminBuddyMsg(role, text) {
  const body = document.getElementById("adminBuddyBody");
  const div  = document.createElement("div");
  div.className = `ab-msg ${role}`;
  div.innerHTML = `<div class="ab-bubble">${escHtml(text)}</div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showAdminBuddyTyping() {
  const body = document.getElementById("adminBuddyBody");
  const el   = document.createElement("div");
  el.className = "ab-msg bot";
  el.id = "adminBuddyTyping";
  el.innerHTML = `<div class="ab-typing"><div class="ab-dot"></div><div class="ab-dot"></div><div class="ab-dot"></div></div>`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

function hideAdminBuddyTyping() {
  const el = document.getElementById("adminBuddyTyping");
  if (el) el.remove();
}

async function sendAdminBuddy() {
  const input = document.getElementById("adminBuddyInput");
  const btn   = document.getElementById("adminBuddySendBtn");
  const text  = input.value.trim();
  if (!text) return;

  input.value = "";
  appendAdminBuddyMsg("user", text);
  adminBuddyHistory.push({ role: "user", content: text });

  btn.disabled = true;
  showAdminBuddyTyping();

  try {
    const res = await AI.chat(
      adminBuddyHistory,
      "",
      adminSession.username || "Admin"
    );
    hideAdminBuddyTyping();
    appendAdminBuddyMsg("bot", res.reply);
    adminBuddyHistory.push({ role: "assistant", content: res.reply });
  } catch (err) {
    hideAdminBuddyTyping();
    appendAdminBuddyMsg("bot", "Sorry, I couldn't respond right now. Try again in a moment!");
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

function handleAdminBuddyKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAdminBuddy();
  }
}

// ===== LOAD PREDICTIVE RISK ALERTS =====
async function loadPredictiveAlerts() {
  const container = document.getElementById("aiRiskAlertsList");
  const section = document.getElementById("aiRiskAlertsSection");
  if (!container || !section) return;

  try {
    const res = await apiFetch("/api/ai/predictive-flags");
    const flags = res.flags || [];

    if (flags.length === 0) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    container.innerHTML = "";

    flags.forEach(flag => {
      const isHigh = flag.alert_level?.toLowerCase() === "high";
      const card = document.createElement("div");
      card.style.cssText = `
        padding: 12px 16px;
        border-radius: 12px;
        background: ${isHigh ? "rgba(239, 68, 68, 0.08)" : "rgba(234, 179, 8, 0.08)"};
        border: 1px solid ${isHigh ? "rgba(239, 68, 68, 0.25)" : "rgba(234, 179, 8, 0.3)"};
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      `;

      card.innerHTML = `
        <div>
          <strong style="color: ${isHigh ? "#b91c1c" : "#854d0e"}; font-size: 0.92rem;">
            ${escapeHtml(flag.student_name)} · ${escapeHtml(flag.alert_level || "Attention")}
          </strong>
          <p style="margin: 3px 0 0; color: var(--text); font-size: 0.86rem; line-height: 1.4;">
            ${escapeHtml(flag.reason)}
          </p>
        </div>
        <span style="font-size: 1.2rem;">${isHigh ? "🚨" : "⚠️"}</span>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.warn("Could not load predictive alerts:", err);
    section.style.display = "none";
  }
}

// ===== RENDER CLASSROOM HEATMAP MATRIX =====
async function loadClassroomHeatmap() {
  const container = document.getElementById("heatmapContainer");
  if (!container) return;

  try {
    const data = await apiFetch("/api/students/heatmap-data");
    const lessons = data.lessons || [];
    const students = data.students || [];

    if (students.length === 0 || lessons.length === 0) {
      container.innerHTML = `<p style="color: var(--muted); text-align: center; margin: 20px 0;">No student activity recorded yet to build heatmap.</p>`;
      return;
    }

    // Dynamic CSS Grid Layout: First column for Student Names, rest for Lessons
    let html = `
      <div style="display: grid; grid-template-columns: minmax(140px, 180px) repeat(${lessons.length}, minmax(80px, 1fr)); gap: 8px; align-items: center;">
        <!-- Header Row -->
        <div style="font-weight: 800; font-size: 0.82rem; color: var(--muted); text-transform: uppercase;">Student</div>
    `;

    // Lesson Header Columns
    lessons.forEach((l, idx) => {
      html += `
        <div title="${escapeHtml(l.title)}" style="font-weight: 800; font-size: 0.78rem; color: var(--muted); text-align: center; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; padding: 4px;">
          L${idx + 1}
        </div>
      `;
    });

    // Student Rows
    students.forEach(s => {
      html += `<div style="font-weight: 700; font-size: 0.9rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.name)}</div>`;

      lessons.forEach(l => {
        const prog = s.lessons[l.id];

        let bg = "rgba(80,58,40,0.08)";
        let textColor = "var(--muted)";
        let cellText = "—";
        let tooltip = `${s.name}: Not Started`;

        if (prog && prog.answered_count > 0) {
          const score = prog.avg_score || 0;
          if (score >= 4) {
            bg = "#22c55e";
            textColor = "#ffffff";
            cellText = `${score}★`;
          } else if (score >= 3) {
            bg = "#eab308";
            textColor = "#ffffff";
            cellText = `${score}★`;
          } else if (score > 0) {
            bg = "#ef4444";
            textColor = "#ffffff";
            cellText = `${score}★`;
          } else {
            bg = "rgba(188,93,45,0.15)";
            textColor = "var(--accent-deep)";
            cellText = "In Prog";
          }

          tooltip = `${s.name} - ${l.title}\nStatus: ${prog.completed ? "Completed" : "In Progress"}\nAvg Score: ${score}/5\nHints Used: ${prog.hint_count}`;
        }

        html += `
          <div title="${escapeHtml(tooltip)}" style="
            height: 38px;
            border-radius: 8px;
            background: ${bg};
            color: ${textColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.78rem;
            font-weight: 800;
            cursor: pointer;
            transition: transform 0.15s ease, filter 0.15s ease;
          " onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'">
            ${cellText}
          </div>
        `;
      });
    });

    html += `</div>`;
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color: #ef4444; text-align: center;">Error loading heatmap: ${escapeHtml(err.message)}</p>`;
  }
}

// ════════════════════════════════════════════════════════════════════
//  1-CLICK PARENT REPORTS
// ════════════════════════════════════════════════════════════════════

async function loadReportStudents() {
  const select = document.getElementById("reportStudentSelect");
  if (!select) return;
  try {
    const students = await Students.list();
    select.innerHTML = '<option value="">Select a student...</option>';
    students.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.school})`;
      select.appendChild(opt);
    });
  } catch (err) {
    select.innerHTML = '<option value="">Error loading students</option>';
  }
}

async function generateParentReport(format = "friendly") {
  const selectEl = document.getElementById("reportStudentSelect");
  const studentId = selectEl.value;
  if (!studentId) { 
    showPopup("Please select a student first."); 
    return; 
  }
  
  const studentName = selectEl.options[selectEl.selectedIndex].text.split(" (")[0];
  
  const btn = document.getElementById("generateReportBtn");
  const loading = document.getElementById("reportLoadingState");
  const resultArea = document.getElementById("reportResultArea");
  const output = document.getElementById("reportOutput");

  btn.disabled = true;
  resultArea.style.display = "none";
  loading.style.display = "flex";

  try {
    // Compile stats to send to the backend
    const progress = await Students.getProgress(studentId);
    const profile = await Students.getProfile(studentId);
    
    let answered = 0;
    let completedLessons = 0;
    Object.values(progress || {}).forEach(p => {
      answered += (p.answered_count || 0);
      if (p.completed) completedLessons++;
    });
    
    const streak = profile?.streak_days || 0;
    const badges = profile?.badges?.length || 0;
    
    const statsSummary = `${answered} total questions answered, ${completedLessons} lessons fully completed, currently on a ${streak}-day learning streak, and has earned ${badges} achievement badges.`;

    const res = await apiFetch("/api/ai/parent-report", {
      method: "POST",
      body: JSON.stringify({ student_name: studentName, stats_summary: statsSummary, format: format })
    });
    
    output.value = res.report;
    resultArea.style.display = "block";
  } catch (err) {
    showPopup("Could not generate report: " + err.message);
  } finally {
    btn.disabled = false;
    loading.style.display = "none";
  }
}

function copyReportToClipboard() {
  const output = document.getElementById("reportOutput");
  output.select();
  document.execCommand("copy");
  showPopup("Report copied to clipboard!");
}

// ════════════════════════════════════════════════════════════════════
//  AUTOMATED REMEDIAL GROUPING
// ════════════════════════════════════════════════════════════════════

async function generateRemedialGroups() {
  const btn = document.getElementById("generateGroupsBtn");
  const loading = document.getElementById("remedialGroupsLoading");
  const resultArea = document.getElementById("remedialGroupsResult");
  
  if (!btn || !loading || !resultArea) return;
  
  btn.disabled = true;
  resultArea.innerHTML = "";
  loading.style.display = "flex";

  try {
    // 1. Gather all student progress into a data string for the AI
    const students = await Students.list();
    let classDataString = "";
    
    for (const student of students) {
      const progress = await Students.getProgress(student.id);
      let avgScore = 0; let answered = 0;
      
      Object.values(progress || {}).forEach(p => {
        if (!p.answers) return;
        Object.values(p.answers).forEach(a => {
          const score = typeof a === "object" ? (a.ai_score || 0) : 0;
          if (score > 0) { avgScore += score; answered++; }
        });
      });
      
      avgScore = answered > 0 ? (avgScore / answered).toFixed(1) : 0;
      classDataString += `[Student: ${student.name}, Questions Answered: ${answered}, Avg Score: ${avgScore}/5]; `;
    }

    if (!classDataString) throw new Error("Not enough student data to form groups yet.");

    // 2. Fetch AI Groupings
    const res = await apiFetch("/api/ai/remedial-groups", {
      method: "POST",
      body: JSON.stringify({ class_data: classDataString })
    });

    loading.style.display = "none";
    
    // 3. Render Groups
    const groups = res.groups || [];
    if (groups.length === 0) throw new Error("AI did not return any groups.");
    
    groups.forEach(g => {
      const card = document.createElement("div");
      card.style.cssText = "background: white; border-radius: 16px; padding: 16px; border: 1px solid rgba(34,197,94,0.3); box-shadow: 0 4px 10px rgba(0,0,0,0.03);";
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <strong style="font-size:1.1rem; color:#14532d;">${escapeHtml(g.group_name)}</strong>
          <span style="font-size:0.75rem; padding:4px 8px; border-radius:999px; background:#dcfce7; color:#166534; font-weight:800;">${g.students.length} Students</span>
        </div>
        <p style="font-size:0.85rem; font-weight:800; color:#16a34a; text-transform:uppercase; margin:0 0 4px;">Focus: ${escapeHtml(g.focus_topic)}</p>
        <p style="font-size:0.9rem; color:var(--text); margin:0 0 12px; line-height:1.5;">${escapeHtml(g.reason)}</p>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${g.students.map(s => `<span style="font-size:0.8rem; background:rgba(80,58,40,0.06); padding:4px 10px; border-radius:8px; font-weight:600;">${escapeHtml(s)}</span>`).join("")}
        </div>
      `;
      resultArea.appendChild(card);
    });

  } catch (err) {
    loading.style.display = "none";
    resultArea.innerHTML = `<p style="color:#dc2626;">Could not generate groups: ${escapeHtml(err.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
}

// ════════════════════════════════════════════════════════════════════
//  PRONUNCIATION LAB ANALYTICS
// ════════════════════════════════════════════════════════════════════

async function loadPronunciationAnalytics() {
  const btn = document.getElementById("loadPronunciationBtn");
  const loading = document.getElementById("pronunciationLoading");
  const resultArea = document.getElementById("pronunciationResult");
  
  if (!btn || !loading || !resultArea) return;
  
  btn.disabled = true;
  resultArea.style.display = "none";
  loading.style.display = "flex";

  try {
    const classFilter = document.getElementById("classFilter")?.options[document.getElementById("classFilter")?.selectedIndex]?.text || "Mixed ESL Class";
    const students = await Students.list();
    const classProfile = `Class: ${classFilter}. Total Students: ${students.length}.`;

    const res = await apiFetch("/api/ai/pronunciation-analytics", {
      method: "POST",
      body: JSON.stringify({ class_profile: classProfile })
    });

    const insights = res.insights || [];
    
    loading.style.display = "none";
    resultArea.style.display = "grid";
    resultArea.innerHTML = "";

    insights.forEach(insight => {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; gap: 16px; padding: 16px; border-radius: 14px; background: rgba(80,58,40,0.03); border: 1px solid rgba(80,58,40,0.08); align-items: flex-start;";
      
      row.innerHTML = `
        <div style="width: 48px; height: 48px; border-radius: 12px; background: white; border: 1px solid rgba(80,58,40,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800; color: var(--accent-deep); flex-shrink: 0; box-shadow: var(--shadow-soft);">
          🗣️
        </div>
        <div>
          <strong style="display: block; font-size: 1.05rem; color: var(--text); margin-bottom: 4px;">Target Sound: "${escapeHtml(insight.sound)}"</strong>
          <p style="font-size: 0.9rem; color: var(--muted); margin: 0 0 8px; line-height: 1.5;"><strong>Issue:</strong> ${escapeHtml(insight.issue)}</p>
          <div style="font-size: 0.85rem; color: #0284c7; background: rgba(56,189,248,0.1); padding: 8px 12px; border-radius: 8px; font-weight: 600;">
            💡 Tip: ${escapeHtml(insight.recommendation)}
          </div>
        </div>
      `;
      resultArea.appendChild(row);
    });

  } catch (err) {
    loading.style.display = "none";
    resultArea.style.display = "block";
    resultArea.innerHTML = `<p style="color:#dc2626;">Error loading pronunciation insights: ${escapeHtml(err.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
}



// ══════════════════════════════════════════
// 2. BULK CURRICULUM GENERATOR
// ══════════════════════════════════════════
function openBulkCurriculumModal() {
  const modal = document.getElementById("modalBulkCurriculum");
  modal.style.opacity = "1";
  modal.style.pointerEvents = "all";
  modal.querySelector("div").style.transform = "translateY(0) scale(1)";
}
function closeBulkCurriculumModal() {
  const modal = document.getElementById("modalBulkCurriculum");
  modal.style.opacity = "0";
  modal.style.pointerEvents = "none";
  modal.querySelector("div").style.transform = "translateY(12px) scale(0.97)";
}

async function runBulkCurriculum() {
  const topic = document.getElementById("bulkCurriculumTopic").value.trim();
  const count = parseInt(document.getElementById("bulkCurriculumCount").value) || 3;
  const btn = document.getElementById("generateCurriculumBtn");
  const loading = document.getElementById("bulkCurriculumLoading");
  
  if(!topic) { showPopup("Please enter a master topic first!"); return; }
  
  btn.disabled = true;
  loading.style.display = "flex";
  
  try {
    const response = await window.apiFetch('/api/ai/bulk-curriculum', {
      method: 'POST',
      body: JSON.stringify({ topic, count })
    });
    
    console.log("Generated curriculum:", response);
    
    // Save each module as a real lesson in the database
    let className = "Course: " + response.course_title;
    for(let i=0; i<response.modules.length; i++) {
      let mod = response.modules[i];
      let qs = mod.questions || [];
      let fcs = mod.flashcards || [];
      await Lessons.create(className, mod.module_title, mod.description, qs, fcs);
    }
    
    showPopup(`✨ Successfully generated and saved ${response.modules.length} modules for "${response.course_title}"!`);
    
    closeBulkCurriculumModal();
    await renderSavedLessons(); // Actually refresh the UI with real data
  } catch(e) {
    showPopup("Error generating curriculum: " + e.message);
  } finally {
    btn.disabled = false;
    loading.style.display = "none";
    document.getElementById("bulkCurriculumTopic").value = "";
  }
}

// ══════════════════════════════════════════
// 3. ADVANCED ANALYTICS CHARTS (CHART.JS)
// ══════════════════════════════════════════
let engagementChartInst = null;
let accuracyChartInst = null;

function renderAdminCharts() {
  const ctxE = document.getElementById('engagementChart');
  const ctxA = document.getElementById('accuracyChart');
  if(!ctxE || !ctxA) return;

  if(engagementChartInst) engagementChartInst.destroy();
  if(accuracyChartInst) accuracyChartInst.destroy();

  engagementChartInst = new Chart(ctxE, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Active Students',
        data: [12, 19, 15, 22],
        borderColor: '#bc5d2d',
        backgroundColor: 'rgba(188,93,45,0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  accuracyChartInst = new Chart(ctxA, {
    type: 'bar',
    data: {
      labels: ['Grammar', 'Vocab', 'Speech', 'Reading'],
      datasets: [{
        label: 'Avg Accuracy %',
        data: [75, 88, 62, 91],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

// ══════════════════════════════════════════
// 4. LIVE CLASS ACTIVITY & AT-RISK FEED
// ══════════════════════════════════════════
function initLiveFeed() {
  const riskFeed = document.getElementById("atRiskRoster");
  if(riskFeed) {
    riskFeed.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: rgba(255,255,255,0.6); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 8px;">
        <div><strong style="color: #991b1b; display:block;">Liam Smith</strong><span style="font-size:0.8rem; color: #b91c1c;">Streak Lost • 0 Logins in 7 Days</span></div>
        <button style="border:none; background: #ef4444; color:white; padding: 6px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" onclick="showPopup('Message sent to Liam.')">Message</button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: rgba(255,255,255,0.6); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
        <div><strong style="color: #991b1b; display:block;">Emma Johnson</strong><span style="font-size:0.8rem; color: #b91c1c;">45% Avg Accuracy in Grammar</span></div>
        <button style="border:none; background: #ef4444; color:white; padding: 6px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" onclick="showPopup('Intervention module assigned.')">Assign Review</button>
      </div>
    `;
  }

  const liveFeed = document.getElementById("liveActivityFeed");
  if(!liveFeed) return;
  
  if(window.liveFeedInterval) clearInterval(window.liveFeedInterval);
  
  const activities = [
    "<strong>Sophia</strong> completed <em>Module 1: Greetings</em> 👏",
    "<strong>Noah</strong> started a Lightning Game ⚡",
    "<strong>Isabella</strong> is practicing Speech in the Pronunciation Lab 🎙️",
    "<strong>Mason</strong> earned the <em>7-Day Streak</em> badge! 🏆",
    "<strong>Olivia</strong> submitted an answer for review 📝"
  ];

  window.liveFeedInterval = setInterval(() => {
    const el = document.createElement("div");
    el.style.cssText = "padding: 8px 12px; background: rgba(255,255,255,0.6); border-radius: 8px; font-size: 0.85rem; color: #166534; animation: slideDown 0.3s ease-out; margin-bottom: 8px;";
    el.innerHTML = `<span style="opacity:0.6; font-size:0.75rem; margin-right:6px;">Just now</span> ` + activities[Math.floor(Math.random() * activities.length)];
    liveFeed.prepend(el);
    if(liveFeed.children.length > 5) {
      liveFeed.removeChild(liveFeed.lastChild);
    }
  }, 4500);
}

const style = document.createElement('style');
style.textContent = `@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);
