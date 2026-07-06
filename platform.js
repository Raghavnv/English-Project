// ===== LOGIN CHECK =====
const student      = getStudentData();
const adminSession = JSON.parse(localStorage.getItem("adminSession") || "null");

if (!student && !adminSession) {
  window.location.href = "login.html";
}

const isAdminViewing = !student && !!adminSession;
const activeUser     = student || { name: adminSession?.username || "Admin", school: "Admin View" };

// ===== LOGOUT =====
function doLogout() {
  if (isAdminViewing) {
    window.location.href = "admin.html";
  } else {
    localStorage.removeItem("student");
    window.location.href = "login.html";
  }
}

// ===== STUDENT CHIP =====
function renderStudentChip() {
  const nameEl         = document.getElementById("studentChipName");
  const schoolEl       = document.getElementById("studentChipSchool");
  const avatarEl       = document.getElementById("studentAvatar");
  const sidebarWelcome = document.getElementById("sidebarWelcome");
  const logoutBtn      = document.querySelector(".logout-btn");

  if (isAdminViewing) {
    if (nameEl)   nameEl.textContent   = adminSession.username;
    if (schoolEl) schoolEl.textContent = "Admin Preview";
    if (avatarEl) { avatarEl.textContent = "🛠"; avatarEl.style.fontSize = "0.95rem"; }
    if (sidebarWelcome) sidebarWelcome.textContent = "Admin Preview Mode";
    if (logoutBtn) {
      logoutBtn.textContent = "← Back to Admin";
      logoutBtn.onclick = () => window.location.href = "admin.html";
    }
    const banner = document.getElementById("welcomeBanner");
    if (banner) {
      banner.style.display    = "";
      banner.style.background = "rgba(188,93,45,0.08)";
      banner.style.border     = "1px solid rgba(188,93,45,0.2)";
    }
    const bannerTitle = document.getElementById("welcomeBannerTitle");
    const bannerSub   = document.getElementById("welcomeBannerSub");
    if (bannerTitle) bannerTitle.textContent = "Admin Preview Mode";
    if (bannerSub)   bannerSub.textContent   = "You are browsing as admin. Progress is not tracked in this mode.";
    const bannerStats = document.querySelector(".welcome-banner-stats");
    if (bannerStats) bannerStats.style.display = "none";
  } else {
    if (nameEl)         nameEl.textContent   = activeUser.name;
    if (schoolEl)       schoolEl.textContent = activeUser.school;
    if (avatarEl)       avatarEl.textContent = activeUser.name.charAt(0).toUpperCase();
    if (sidebarWelcome) sidebarWelcome.textContent = "Welcome, " + activeUser.name + "!";
  }
}

// Call chip render as soon as DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderStudentChip);
} else {
  renderStudentChip();
}

// ===== MOBILE SIDEBAR =====
const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
const platformSidebar     = document.getElementById("platformSidebar");
if (mobileSidebarToggle && platformSidebar) {
  mobileSidebarToggle.addEventListener("click", () => {
    platformSidebar.classList.toggle("mobile-open");
  });
}

// ===== STATE =====
let classes = [];
let allProgress = {};

const state = {
  selectedClassId:  "",
  selectedModuleId: ""
};

// ===== LOAD DATA FROM BACKEND =====
async function loadData() {
  try {
    classes = await Lessons.getClasses();

    // Map backend format to app format
    classes = classes.map(cls => ({
      id:      cls.id,
      label:   cls.label,
      modules: cls.lessons.map(l => ({
        id:          l.id,
        title:       l.title,
        description: l.description,
        questions:   l.questions
      }))
    }));

    if (!isAdminViewing && student?.id) {
      try { allProgress = await Students.getProgress(student.id); } catch {}
    }

    if (classes.length > 0) {
      state.selectedClassId  = classes[0].id;
      state.selectedModuleId = classes[0].modules[0]?.id || "";
    }

    render();
  } catch (err) {
    const moduleGrid = document.getElementById("moduleGrid");
    if (moduleGrid) moduleGrid.innerHTML =
      `<p class="empty-state">Could not connect to server. Is the backend running?<br><small>${err.message}</small></p>`;
    render();
  }
}

// ===== HELPERS =====
function getSelectedClass() { return classes.find(c => c.id === state.selectedClassId); }

function getModuleProgress(moduleId) {
  const p = allProgress[moduleId];
  if (!p) return { completed: false, answeredCount: 0, answers: {} };
  const answers = p.answers || {};
  // Derive count from answers map if answered_count is missing or zero but answers exist
  const derivedCount = Object.values(answers).filter(a => {
    const text = typeof a === "string" ? a : a?.text;
    return text && text.trim().length > 0;
  }).length;
  const answeredCount = p.answered_count > 0 ? p.answered_count : derivedCount;
  return {
    completed:     p.completed,
    answeredCount,
    answers
  };
}

// ===== WELCOME BANNER =====
function renderWelcomeBanner() {
  const banner = document.getElementById("welcomeBanner");
  if (!banner || isAdminViewing) return;
  if (classes.length === 0) { banner.style.display = "none"; return; }

  banner.style.display = "";
  const selectedClass = getSelectedClass();
  const total     = selectedClass?.modules.length || 0;
  const completed = selectedClass
    ? selectedClass.modules.filter(m => getModuleProgress(m.id).completed).length
    : 0;

  const titleEl = document.getElementById("welcomeBannerTitle");
  const subEl   = document.getElementById("welcomeBannerSub");
  const lEl     = document.getElementById("bannerLessonCount");
  const cEl     = document.getElementById("bannerCompletedCount");

  if (titleEl) titleEl.textContent = "Welcome back, " + activeUser.name + "!";
  if (subEl) {
    if (total === 0)          subEl.textContent = "No lessons yet — your teacher will add them soon.";
    else if (completed === 0) subEl.textContent = "You haven't started yet — pick a lesson below.";
    else if (completed === total) subEl.textContent = "You've completed all lessons. Great work!";
    else                      subEl.textContent = `${completed} of ${total} lessons completed. Keep going!`;
  }
  if (lEl) lEl.textContent = total;
  if (cEl) cEl.textContent = completed;
}

// ===== CLASS LIST =====
function renderClassList() {
  const classListEl = document.getElementById("classList");
  classListEl.innerHTML = "";

  if (classes.length === 0) {
    classListEl.innerHTML = `<p class="empty-state">No classes right now — your teacher hasn't added any yet.</p>`;
    return;
  }

  classes.forEach(courseClass => {
    const button = document.createElement("button");
    button.className = "class-button" + (courseClass.id === state.selectedClassId ? " is-active" : "");
    button.innerHTML = `<strong>${courseClass.label}</strong>`;
    button.onclick = () => {
      state.selectedClassId  = courseClass.id;
      state.selectedModuleId = courseClass.modules[0]?.id || "";
      platformSidebar?.classList.remove("mobile-open");
      render();
    };
    classListEl.appendChild(button);
  });
}

// ===== PROGRESS SIDEBAR =====
function renderProgress() {
  const selectedClass     = getSelectedClass();
  const lessonCountEl     = document.getElementById("lessonCount");
  const completedCountEl  = document.getElementById("completedCount");
  const progressValueEl   = document.getElementById("overallProgressValue");
  const progressFillEl    = document.getElementById("overallProgressFill");
  const activeClassPillEl = document.getElementById("activeClassPill");
  const classHeadingEl    = document.getElementById("classHeading");
  const classSummaryEl    = document.getElementById("classSummary");

  if (!selectedClass) {
    if (lessonCountEl)     lessonCountEl.textContent    = "0";
    if (completedCountEl)  completedCountEl.textContent = "0";
    if (progressValueEl)   progressValueEl.textContent  = "0%";
    if (progressFillEl)    progressFillEl.style.width   = "0%";
    if (activeClassPillEl) activeClassPillEl.textContent = "—";
    if (classHeadingEl)    classHeadingEl.textContent   = "No class yet";
    if (classSummaryEl)    classSummaryEl.textContent   = "Your teacher hasn't added any classes yet.";
    return;
  }

  const total     = selectedClass.modules.length;
  const completed = selectedClass.modules.filter(m => getModuleProgress(m.id).completed).length;
  const percent   = total ? Math.round((completed / total) * 100) : 0;

  if (lessonCountEl)     lessonCountEl.textContent     = total;
  if (completedCountEl)  completedCountEl.textContent  = completed;
  if (progressValueEl)   progressValueEl.textContent   = percent + "%";
  if (progressFillEl)    progressFillEl.style.width    = percent + "%";
  if (activeClassPillEl) activeClassPillEl.textContent = selectedClass.label;
  if (classHeadingEl)    classHeadingEl.textContent    = selectedClass.label + " — Learning Path";
  if (classSummaryEl)    classSummaryEl.textContent    = `${total} lesson${total !== 1 ? "s" : ""} · ${completed} completed`;
}

// ===== MODULE GRID =====
function renderModules() {
  const selectedClass = getSelectedClass();
  const moduleGridEl  = document.getElementById("moduleGrid");
  moduleGridEl.innerHTML = "";

  if (!selectedClass || selectedClass.modules.length === 0) {
    moduleGridEl.innerHTML = `<p class="empty-state">No lessons in this class yet.</p>`;
    return;
  }

  selectedClass.modules.forEach(module => {
    const progress   = getModuleProgress(module.id);
    const total      = module.questions?.length ?? 0;
    const answered   = Math.min(progress.answeredCount || 0, total);
    const isComplete = progress.completed;

    const statusText = isComplete ? "✓ Completed"
      : total > 0 ? (answered > 0 ? `${answered}/${total} answered` : `${total} question${total !== 1 ? "s" : ""}`)
      : "No questions";

    const button = document.createElement("button");
    button.className = "module-card" + (module.id === state.selectedModuleId ? " is-active" : "");
    button.innerHTML = `
      <div class="module-card-top">
        <span class="module-meta ${isComplete ? "module-meta-done" : ""}">${statusText}</span>
      </div>
      <h4>${module.title}</h4>
      <p>${module.description || ""}</p>
    `;
    button.onclick = () => {
      state.selectedModuleId = module.id;
      renderModules();
      renderLessonPanel(selectedClass, module);
      renderAIPanel(module);
    };
    moduleGridEl.appendChild(button);
  });
}

// ===== LESSON PANEL =====
function renderLessonPanel(selectedClass, module) {
  const progress   = getModuleProgress(module.id);
  const total      = module.questions?.length ?? 0;
  const answered   = Math.min(progress.answeredCount || 0, total);
  const isComplete = progress.completed;
  const percent    = total > 0 ? Math.round((answered / total) * 100) : 0;

  document.getElementById("lessonTitle").textContent       = module.title;
  document.getElementById("lessonDescription").textContent = module.description || "No description provided.";

  const statusBadge       = document.getElementById("lessonStatus");
  statusBadge.textContent = isComplete ? "Completed" : (answered > 0 ? "In Progress" : "Not Started");
  statusBadge.className   = "status-badge" + (isComplete ? " status-done" : answered > 0 ? " status-progress" : "");

  const stack = document.getElementById("questionStack");
  stack.innerHTML = "";

  if (total > 0) {
    const progressRow = document.createElement("div");
    progressRow.className = "lesson-progress-row";
    progressRow.innerHTML = `
      <div class="lesson-progress-label">
        <span>${answered} of ${total} question${total !== 1 ? "s" : ""} answered</span>
        <span>${percent}%</span>
      </div>
      <div class="lesson-mini-bar"><div class="lesson-mini-fill" style="width:${percent}%"></div></div>
    `;
    stack.appendChild(progressRow);
  } else {
    const noQ = document.createElement("p");
    noQ.className = "empty-state";
    noQ.textContent = "This lesson has no questions yet.";
    stack.appendChild(noQ);
  }

  const goBtn = document.createElement("button");
  goBtn.className = "primary-action lesson-go-btn";
  goBtn.textContent = isComplete ? "Review Lesson" : (answered > 0 ? "Resume Lesson →" : "Start Lesson →");
  goBtn.onclick = () => {
    localStorage.setItem("currentLesson", JSON.stringify({
      classId:  selectedClass.id,
      moduleId: module.id
    }));
    window.location.href = "lesson.html";
  };
  stack.appendChild(goBtn);
}

// ===== AI PANEL =====
const encouragements = [
  "Every answer you write builds your confidence. Keep going! 🌟",
  "Small steps every day lead to big progress. You've got this! 💪",
  "Don't worry about being perfect — just keep practising! 📝",
  "One lesson at a time. That's all it takes! 🎯",
  "Your effort today is building your future. Keep it up! 🌈",
];

function renderAIPanel(module) {
  const focusEl    = document.getElementById("aiLessonFocus");
  const encEl      = document.getElementById("aiEncouragement");
  const statusEl   = document.getElementById("aiStatus");

  if (!module) return;

  if (focusEl) focusEl.textContent = module.description
    ? `This lesson covers: "${module.description}". Read each question carefully before answering.`
    : `You're working on "${module.title}". Take your time with each question.`;

  if (encEl) encEl.textContent = encouragements[Math.floor(Math.random() * encouragements.length)];
}

// ===== RESET CLASS PROGRESS =====
const resetModal        = document.getElementById("resetModal");
const resetModalBody    = document.getElementById("resetModalBody");
const resetModalCancel  = document.getElementById("resetModalCancel");
const resetModalConfirm = document.getElementById("resetModalConfirm");

function openResetModal() {
  const selectedClass = getSelectedClass();
  if (!selectedClass) return;
  resetModalBody.textContent = `All progress for "${selectedClass.label}" will be cleared. This cannot be undone.`;
  resetModal.classList.add("is-open");
}

function closeResetModal() { resetModal.classList.remove("is-open"); }
document.getElementById("resetClassButton")?.addEventListener("click", openResetModal);
resetModalCancel?.addEventListener("click", closeResetModal);
resetModal?.addEventListener("click", (e) => { if (e.target === resetModal) closeResetModal(); });
resetModalConfirm?.addEventListener("click", async () => {
  const selectedClass = getSelectedClass();
  if (!selectedClass) { closeResetModal(); return; }

  const confirmBtn = document.getElementById("resetModalConfirm");
  if (confirmBtn) { confirmBtn.textContent = "Resetting…"; confirmBtn.disabled = true; }

  try {
    if (!isAdminViewing && student?.id) {
      const lessonIds = selectedClass.modules.map(m => m.id);
      await Students.resetProgress(student.id, lessonIds);
    }
    // Clear local cache for this class
    const selectedClass2 = getSelectedClass();
    selectedClass2?.modules.forEach(m => { delete allProgress[m.id]; });
  } catch (err) {
    console.error("Reset failed:", err);
  } finally {
    if (confirmBtn) { confirmBtn.textContent = "Yes, Reset"; confirmBtn.disabled = false; }
    closeResetModal();
    render();
  }
});

// ===== RELOAD ON RETURN =====
let didBlur = false;
window.addEventListener("blur",  () => { didBlur = true; });
window.addEventListener("focus", async () => {
  if (!didBlur) return;
  didBlur = false;
  // Refresh progress from server so answered counts are always fresh
  if (!isAdminViewing && student?.id) {
    try { allProgress = await Students.getProgress(student.id); } catch {}
  }
  render();
});

// ===== MAIN RENDER =====
function render() {
  const selectedClass = getSelectedClass();
  if (!state.selectedModuleId && selectedClass?.modules.length > 0) {
    state.selectedModuleId = selectedClass.modules[0].id;
  }
  renderStudentChip();
  renderWelcomeBanner();
  renderClassList();
  renderProgress();
  renderModules();

  const sc = getSelectedClass();
  const m  = sc?.modules.find(mod => mod.id === state.selectedModuleId);
  if (sc && m) {
    renderLessonPanel(sc, m);
    renderAIPanel(m);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Populate student name immediately before any API calls
  renderStudentChip();
  loadData();
});