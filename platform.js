// ===== LOGIN CHECK (DISABLED FOR DEMO — RESTORE BEFORE GOING LIVE) =====
const student      = getStudentData();
const adminSession = JSON.parse(localStorage.getItem("adminSession") || "null");

if (!student && !adminSession) {
  window.location.href = "login.html";
}
if (student && !getStudentToken()) {
  localStorage.removeItem("student");
  window.location.href = "login.html";
}

const isAdminViewing = !student && !!adminSession;
const activeUser     = student || { name: adminSession?.username || "Guest", school: "Demo View" };

// ===== LOGOUT =====
function doLogout() {
  if (isAdminViewing) {
    window.location.href = "admin.html";
  } else {
    localStorage.removeItem("student");
    localStorage.removeItem("studentId");
    clearStudentToken();
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
let studentProfile = null;

const state = {
  selectedClassId:  "",
  selectedModuleId: ""
};

// ===== LOAD DATA FROM BACKEND =====
async function loadData() {
  try {
    classes = await Lessons.getClasses();

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
      try { 
        allProgress = await Students.getProgress(student.id); 
        studentProfile = await Students.getProfile(student.id);
        student.streak_days = studentProfile.streak_days;
      } catch (err) {
        console.error("Error fetching progress/profile", err);
      }
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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getModuleProgress(moduleId) {
  const p = allProgress[moduleId];
  if (!p) return { completed: false, answeredCount: 0, answers: {} };
  const answers = p.answers || {};
  const derived = Object.values(answers).filter(a => {
    const text = typeof a === "string" ? a : a?.text;
    return text && text.trim().length > 0;
  }).length;
  return {
    completed:     p.completed,
    answeredCount: p.answered_count > 0 ? p.answered_count : derived,
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
  
  const streakEl = document.getElementById("streakCount");
  if (streakEl) {
    const streak = studentProfile?.streak_days || student?.streak_days || 0;
    streakEl.textContent = streak > 0 ? `🔥 ${streak}` : "0";
  }
  
  if (progressValueEl)   progressValueEl.textContent   = percent + "%";
  if (progressFillEl)    progressFillEl.style.width    = percent + "%";
  if (activeClassPillEl) activeClassPillEl.textContent = selectedClass.label;
  if (classHeadingEl)    classHeadingEl.textContent    = selectedClass.label + " — Learning Path";
  if (classSummaryEl)    classSummaryEl.textContent    = `${total} lesson${total !== 1 ? "s" : ""} · ${completed} completed`;
}

// ===== BADGES & ACHIEVEMENTS =====
function renderBadges() {
  const badgesGrid = document.getElementById("badgesGrid");
  const badgeCountPill = document.getElementById("badgeCountPill");
  if (!badgesGrid) return;
  
  if (isAdminViewing || !studentProfile || !studentProfile.badges || studentProfile.badges.length === 0) {
    if (badgeCountPill) badgeCountPill.textContent = "0";
    badgesGrid.innerHTML = `<p class="empty-state" style="grid-column: 1 / -1; padding: 12px; margin-top: 10px;">No badges yet. Start learning to earn some!</p>`;
    return;
  }

  const badges = studentProfile.badges;
  if (badgeCountPill) badgeCountPill.textContent = badges.length;
  badgesGrid.innerHTML = "";
  
  badges.forEach(b => {
    const card = document.createElement("div");
    card.className = "badge-card";
    card.title = b.description;
    card.innerHTML = `
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
    `;
    badgesGrid.appendChild(card);
  });
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

  const sortedModules = [...selectedClass.modules].sort((a, b) => (a.order || 0) - (b.order || 0));

  sortedModules.forEach((module, idx) => {
    const prevModule   = idx > 0 ? sortedModules[idx - 1] : null;
    const prevComplete = prevModule ? getModuleProgress(prevModule.id).completed : true;
    const isActuallyLocked = module.locked && !prevComplete;
    const progress   = getModuleProgress(module.id);
    const total      = module.questions?.length ?? 0;
    const answered   = Math.min(progress.answeredCount || 0, total);
    const isComplete = progress.completed;

    const statusText = isComplete ? "✓ Completed"
      : total > 0 ? (answered > 0 ? `${answered}/${total} answered` : `${total} question${total !== 1 ? "s" : ""}`)
      : "No questions";

    const button = document.createElement("button");
    button.className = "module-card" + (module.id === state.selectedModuleId ? " is-active" : "") + (isActuallyLocked ? " is-locked" : "");
    button.innerHTML = `
      <div class="module-card-top">
        <span class="module-meta ${isComplete ? "module-meta-done" : ""}">${statusText}</span>
      </div>
      <h4>${module.title}</h4>
      <p>${module.description || ""}</p>
    `;
    button.onclick = () => {
      if (isActuallyLocked) return;
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
  const total      = module.questions?.length || 0;
  const answered   = progress.answeredCount || 0;
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

// ===== AI STUDENT ANALYSIS WIDGET =====
function renderLocalAnalysisStats() {
  const section = document.getElementById("aiAnalysisSection");
  if (!section) return;
  if (isAdminViewing || !student?.id) { 
    section.style.display = "none"; 
    return; 
  }
  section.style.display = "";

  let scored = 0, correct = 0, scoreSum = 0;
  
  Object.values(allProgress || {}).forEach(p => {
    if (!p.answers) return;
    Object.values(p.answers).forEach(a => {
      const text = typeof a === "string" ? a : a?.text;
      const score = typeof a === "object" ? (a.ai_score || 0) : 0;
      if (text && text.trim() && score > 0) {
        scored++;
        scoreSum += score;
        if (score >= 3) correct++;
      }
    });
  });

  const accuracy = scored > 0 ? Math.round((correct / scored) * 100) : 0;
  const avgScore = scored > 0 ? (scoreSum / scored).toFixed(1) : "0";

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("statScored", scored);
  set("statCorrect", correct);
  set("statAccuracy", accuracy + "%");
  set("statAvgScore", avgScore + "/5");
}

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("openAnalysisModalBtn");
  const closeBtn = document.getElementById("closeAnalysisModalBtn");
  const modal = document.getElementById("aiAnalysisModal");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      renderLocalAnalysisStats();
      modal.style.opacity = "1";
      modal.style.pointerEvents = "all";
      modal.querySelector("div").style.transform = "translateY(0) scale(1)";
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.style.opacity = "0";
      modal.style.pointerEvents = "none";
      modal.querySelector("div").style.transform = "translateY(16px) scale(0.97)";
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
        modal.querySelector("div").style.transform = "translateY(16px) scale(0.97)";
      }
    });
  }
});

async function getAiFeedbackAnalysis() {
  const btn = document.getElementById("getAiFeedbackBtn");
  const textEl = document.getElementById("aiAnalysisText");
  if (!student?.id || !btn || !textEl) return;
  btn.disabled = true;
  btn.textContent = "Thinking…";
  textEl.textContent = "Analysing your progress…";
  try {
    const data = await AI.getAnalysis(student.id);
    textEl.textContent = data.ai_summary || "No summary available yet.";
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("statScored", data.scored_count ?? 0);
    set("statCorrect", data.correct_count ?? 0);
    set("statAccuracy", (data.accuracy_percentage ?? 0) + "%");
    set("statAvgScore", (data.average_score ?? 0) + "/5");
  } catch (err) {
    textEl.textContent = "Could not get AI feedback right now: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Get AI Feedback";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("getAiFeedbackBtn");
  if (btn) btn.addEventListener("click", getAiFeedbackAnalysis);
});


// ===== AI PANEL (TRANSFORMED INTO AI STUDY COMPANION) =====
function renderAIPanel(module) {
  const focusEl    = document.getElementById("aiLessonFocus");
  const hintEl     = document.getElementById("aiHint");
  const hintReveal = document.getElementById("hintReveal");
  const encEl      = document.getElementById("aiEncouragement");
  const statusEl   = document.getElementById("aiStatus");
  const oldBtn     = document.getElementById("hintButton");

  if (!module) return;

  // Updated heading to Learn with AI
  if (focusEl) focusEl.innerHTML = "🧠 Learn with AI";
  if (hintEl) hintEl.textContent = "Select a lesson below to review core concepts or practice with smart flashcards.";
  
  if (statusEl) statusEl.style.display = "none"; 
  if (oldBtn) oldBtn.style.display = "none";
  
  if (encEl) encEl.textContent = "Powered by AI to help you learn faster and remember longer!";

  if (hintReveal) {
    const allLessons = classes.flatMap(c => c.modules);
    let optionsHtml = '<option value="">Select a lesson...</option>';
    
    allLessons.forEach(l => {
      const isSelected = l.id === module.id ? "selected" : "";
      optionsHtml += `<option value="${l.id}" data-title="${escapeHtml(l.title)}" data-desc="${escapeHtml(l.description || '')}" ${isSelected}>${escapeHtml(l.title)}</option>`;
    });

    hintReveal.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px; width: 100%;">
        <select id="aiStudySelect" style="width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid rgba(80,58,40,0.2); font-family: inherit; font-size: 0.95rem; background: rgba(255,255,255,0.8); color: var(--accent-deep); cursor: pointer;">
          ${optionsHtml}
        </select>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button onclick="triggerStudyHub('relearn')" style="min-height: 40px; border-radius: 10px; border: none; background: rgba(56,189,248,0.1); color: #0284c7; font-weight: 700; cursor: pointer; border: 1px solid rgba(56,189,248,0.3); transition: all 0.2s ease;">📖 Re-Learn</button>
          <button onclick="triggerStudyHub('flashcards')" style="min-height: 40px; border-radius: 10px; border: none; background: rgba(139,92,246,0.1); color: #6d28d9; font-weight: 700; cursor: pointer; border: 1px solid rgba(139,92,246,0.3); transition: all 0.2s ease;">✨ Flashcards</button>
        </div>
      </div>
    `;
  }
}

// ===== INJECT AI MODALS DYNAMICALLY =====
function injectStudyModals() {
  if (document.getElementById("modalRelearn")) return; 

  const modalsHTML = `
    <style>
      .ai-modal-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(20,15,10,0.6); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; padding: 20px; }
      .ai-modal-overlay.show { opacity: 1; pointer-events: all; }
      .ai-modal-content { width: 100%; max-width: 800px; max-height: 90vh; border-radius: 28px; box-shadow: 0 30px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column; transform: translateY(20px) scale(0.98); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
      .ai-modal-overlay.show .ai-modal-content { transform: translateY(0) scale(1); }
      .ai-modal-header { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
      .ai-modal-close { background: rgba(255,255,255,0.15); border: none; width: 36px; height: 36px; border-radius: 50%; color: #fff; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
      .ai-modal-close:hover { background: rgba(255,255,255,0.3); }
      .ai-modal-body { padding: 24px; overflow-y: auto; flex: 1; }
      .relearn-modal { background: linear-gradient(135deg, #0f2027 0%, #1a3a4a 50%, #0f2027 100%); border: 1px solid rgba(56,189,248,0.3); }
      .relearn-modal .ai-modal-header { border-bottom: 1px solid rgba(56,189,248,0.15); }
      .relearn-modal .ai-modal-title { color: #e0f2fe; font-size: 1.2rem; font-weight: 800; margin: 0; display: flex; gap: 10px; }
      .flashcard-modal { background: linear-gradient(145deg, #f5f3ff, #ede9fe); border: 1px solid rgba(139, 92, 246, 0.4); }
      .flashcard-modal .ai-modal-header { border-bottom: 1px solid rgba(139, 92, 246, 0.15); }
      .flashcard-modal .ai-modal-title { color: #4c1d95; font-size: 1.2rem; font-weight: 800; margin: 0; display: flex; gap: 10px; align-items: center; }
      .flashcard-modal .ai-modal-close { background: rgba(76, 29, 149, 0.1); color: #4c1d95; }
      .relearn-content { color: #cbd5e1; font-size: 1rem; line-height: 1.8; }
      .relearn-content .rl-section { margin-bottom: 24px; }
      .relearn-content .rl-header { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7dd3fc; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(56,189,248,0.12); }
      .relearn-content ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
      .relearn-content ul li { display: flex; gap: 10px; align-items: flex-start; }
      .relearn-content ul li::before { content: "→"; color: #38bdf8; font-weight: 800; flex-shrink: 0; margin-top: 2px; }
      .relearn-content .rl-example { background: rgba(255,255,255,0.04); border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 12px 16px; font-style: italic; color: #a5f3fc; margin-bottom: 10px; }
      .ai-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; perspective: 1000px; }
      .ai-card-wrapper { width: 100%; height: 180px; cursor: pointer; perspective: 1000px; animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards; }
      .ai-card-inner { position: relative; width: 100%; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d; border-radius: 18px; box-shadow: 0 8px 20px rgba(46, 16, 101, 0.12); }
      .ai-card-wrapper:hover .ai-card-inner { box-shadow: 0 12px 28px rgba(46, 16, 101, 0.2); transform: translateY(-3px); }
      .ai-card-inner.is-flipped { transform: rotateY(180deg); }
      .ai-card-front, .ai-card-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 18px; display: flex; align-items: center; justify-content: center; padding: 20px; font-size: 1.25rem; font-weight: 700; text-align: center; }
      .ai-card-front { background: #ffffff; border: 2px solid rgba(139, 92, 246, 0.3); color: #4c1d95; }
      .ai-card-back { background: linear-gradient(135deg, #7c3aed, #5b21b6); border: 2px solid rgba(109, 40, 217, 0.6); color: #ffffff; transform: rotateY(180deg); font-size: 1.05rem; line-height: 1.45; }
      .ai-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; gap: 16px; text-align: center; }
      .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.2); border-radius: 50%; animation: spin 0.8s linear infinite; }
      .spinner.purple { border-color: rgba(139,92,246,0.2); border-top-color: #7c3aed; }
      .spinner.blue { border-color: rgba(56,189,248,0.2); border-top-color: #38bdf8; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes popIn { 0% { opacity: 0; transform: scale(0.8) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
    </style>
    
    <!-- MODAL: RE-LEARN -->
    <div class="ai-modal-overlay" id="modalRelearn" onclick="closeStudyModals(event)">
      <div class="ai-modal-content relearn-modal">
        <div class="ai-modal-header">
          <h3 class="ai-modal-title">📖 <span id="relearnModalTitle">Lesson Recap</span></h3>
          <button class="ai-modal-close" onclick="closeStudyModals()">✕</button>
        </div>
        <div class="ai-modal-body">
          <div id="relearnContentArea"></div>
        </div>
      </div>
    </div>

    <!-- MODAL: FLASHCARDS -->
    <div class="ai-modal-overlay" id="modalFlashcards" onclick="closeStudyModals(event)">
      <div class="ai-modal-content flashcard-modal">
        <div class="ai-modal-header">
          <h3 class="ai-modal-title">✨ <span id="flashcardModalTitle">Smart Flashcards</span></h3>
          <div style="display: flex; gap: 10px;">
            <button id="regenerateFlashcardsBtn" style="padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.4); background: rgba(139, 92, 246, 0.1); color: #4c1d95; font-weight: 700; cursor: pointer; display: none; font-size: 0.85rem; transition: background 0.2s;">🔄 Generate New</button>
            <button class="ai-modal-close" onclick="closeStudyModals()">✕</button>
          </div>
        </div>
        <div class="ai-modal-body">
          <div id="flashcardContentArea" class="ai-card-grid"></div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalsHTML);
}

document.addEventListener("DOMContentLoaded", injectStudyModals);

function closeStudyModals(e) {
  if (e && e.target.classList && !e.target.classList.contains("ai-modal-overlay")) return;
  
  const modalRelearn = document.getElementById("modalRelearn");
  const modalFlashcards = document.getElementById("modalFlashcards");
  
  if (modalRelearn) modalRelearn.classList.remove("show");
  if (modalFlashcards) modalFlashcards.classList.remove("show");
  
  setTimeout(() => {
    const rArea = document.getElementById("relearnContentArea");
    const fArea = document.getElementById("flashcardContentArea");
    if (rArea) rArea.innerHTML = "";
    if (fArea) fArea.innerHTML = "";
  }, 300);
}

// ── TRIGGER AI STUDY ACTIONS ──
async function triggerStudyHub(type) {
  const selectEl = document.getElementById("aiStudySelect");
  if (!selectEl || !selectEl.value) {
    alert("Please select a lesson from the dropdown first!");
    return;
  }

  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const lessonId = selectEl.value;
  const title = selectedOption.dataset.title;
  const desc = selectedOption.dataset.desc;

  if (type === 'relearn') {
    await openRelearn(lessonId, title, desc);
  } else if (type === 'flashcards') {
    await openFlashcards(title, desc);
  }
}

async function openRelearn(lessonId, title, desc) {
  const modal = document.getElementById("modalRelearn");
  const titleEl = document.getElementById("relearnModalTitle");
  const contentArea = document.getElementById("relearnContentArea");

  if (titleEl) titleEl.textContent = title;
  if (contentArea) {
    contentArea.innerHTML = `
      <div class="ai-loading-state">
        <div class="spinner blue"></div>
        <p style="color: #7dd3fc; margin: 0; font-weight: 600;">Buddy is writing a quick summary...</p>
      </div>
    `;
  }
  if (modal) modal.classList.add("show");

  try {
    const res = await AI.getRelearn(lessonId, title, desc);
    if (res && res.content) {
      const sectionIcons = { "WHAT YOU WILL LEARN": "📚", "KEY CONCEPTS": "🔑", "HELPFUL EXAMPLES": "✏️", "QUICK TIPS": "💡" };
      const lines = res.content.split("\n").map(l => l.trim()).filter(Boolean);
      let html = "";
      let currentSection = null;
      let buffer = [];

      function flushSection() {
        if (!currentSection || !buffer.length) return;
        const icon = sectionIcons[currentSection] || "📌";
        html += `<div class="rl-section"><div class="rl-header">${icon} ${currentSection}</div>`;
        if (currentSection === "HELPFUL EXAMPLES") {
          buffer.forEach(line => {
            const clean = line.replace(/^[-•*]\s*/, "").replace(/^[""'](.+)[""']$/, "$1");
            html += `<div class="rl-example">"${escapeHtml(clean.replace(/^"|"$/g, ""))}"</div>`;
          });
        } else {
          html += `<ul>`;
          buffer.forEach(line => { html += `<li>${escapeHtml(line.replace(/^[-•*]\s*/, ""))}</li>`; });
          html += `</ul>`;
        }
        html += `</div>`;
        buffer = [];
      }

      let matchedAny = false;
      lines.forEach(line => {
        const cleanLine = line.replace(/[*#_]/g, ""); 
        const upperLine = cleanLine.toUpperCase().replace(/[📚🔑✏️💡]/gu, "").trim();
        const matchedSection = Object.keys(sectionIcons).find(k => upperLine.includes(k));
        
        if (matchedSection) {
          flushSection();
          currentSection = matchedSection;
          matchedAny = true;
        } else if (currentSection) {
          const clean = line.replace(/^[-•*\d.]\s*/, "").trim();
          if (clean.length > 2) buffer.push(clean);
        } else {
          html += `<p style="color:rgba(147,197,253,0.9); margin-bottom:12px;">${escapeHtml(line)}</p>`;
        }
      });
      flushSection();

      if (!matchedAny && !html) html = `<div style="color:#cbd5e1; font-size:0.95rem; line-height:1.8;">${escapeHtml(res.content).replace(/\n/g, '<br>')}</div>`;
      if (contentArea) contentArea.innerHTML = `<div class="relearn-content">${html}</div>`;
    } else throw new Error("Received empty response from AI");
  } catch (err) {
    if (contentArea) contentArea.innerHTML = `<div style="color: #fca5a5; text-align: center; padding: 20px;">Could not generate recap: ${escapeHtml(err.message)}</div>`;
  }
}

async function openFlashcards(title, desc) {
  const modal = document.getElementById("modalFlashcards");
  const titleEl = document.getElementById("flashcardModalTitle");
  const contentArea = document.getElementById("flashcardContentArea");
  const regenBtn = document.getElementById("regenerateFlashcardsBtn");

  if (titleEl) titleEl.textContent = title + " Deck";
  if (regenBtn) {
    regenBtn.style.display = "none"; 
    regenBtn.onclick = () => openFlashcards(title, desc); 
  }
  
  if (contentArea) {
    contentArea.innerHTML = `
      <div class="ai-loading-state" style="grid-column: 1 / -1;">
        <div class="spinner purple"></div>
        <p style="color: #6d28d9; margin: 0; font-weight: 600;">Generating smart flashcards...</p>
      </div>
    `;
  }
  if (modal) modal.classList.add("show");

  try {
    const res = await AI.generateFlashcards(title, desc, 6);
    const cards = res.flashcards || [];

    if (cards.length === 0) throw new Error("AI did not return any cards.");
    if (contentArea) {
      contentArea.innerHTML = "";
      cards.forEach((card, i) => {
        const wrapper = document.createElement("div");
        wrapper.className = "ai-card-wrapper";
        wrapper.style.animationDelay = `${i * 0.1}s`; 
        wrapper.innerHTML = `
          <div class="ai-card-inner">
            <div class="ai-card-front">${escapeHtml(card.front)}</div>
            <div class="ai-card-back">${escapeHtml(card.back)}</div>
          </div>
        `;
        wrapper.addEventListener("click", () => {
          wrapper.querySelector(".ai-card-inner").classList.toggle("is-flipped");
        });
        contentArea.appendChild(wrapper);
      });
    }
    if (regenBtn) regenBtn.style.display = "block"; // Show the generate new button once loaded
  } catch (err) {
    if (contentArea) contentArea.innerHTML = `<div style="color: #dc2626; text-align: center; padding: 20px; grid-column: 1 / -1;">Error creating deck: ${escapeHtml(err.message)}</div>`;
  }
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
    selectedClass.modules.forEach(m => { delete allProgress[m.id]; });
  } catch (err) { console.error("Reset failed:", err); }
  finally {
    if (confirmBtn) { confirmBtn.textContent = "Yes, Reset"; confirmBtn.disabled = false; }
    closeResetModal(); render();
  }
});

// ===== RELOAD ON RETURN =====
let didBlur = false;
window.addEventListener("blur",  () => { didBlur = true; });
window.addEventListener("focus", async () => {
  if (!didBlur) return;
  didBlur = false;
  if (!isAdminViewing && student?.id) {
    try { 
      allProgress = await Students.getProgress(student.id); 
      studentProfile = await Students.getProfile(student.id);
      student.streak_days = studentProfile.streak_days;
    } catch {}
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
  renderBadges();
  renderModules();
  renderLocalAnalysisStats();

  const sc = getSelectedClass();
  const m  = sc?.modules.find(mod => mod.id === state.selectedModuleId);
  if (sc && m) {
    renderLessonPanel(sc, m);
    renderAIPanel(m);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderStudentChip();
  loadData();
});