// ════════════════════════════════════════════════════════════════════
//  TEXT TO SPEECH (TTS) HELPER
// ════════════════════════════════════════════════════════════════════

const BuddyVoice = {
  activeButton: null,
  
  getLangCode(languageName) {
    const map = {
      "Kannada": "kn-IN", "Hindi": "hi-IN", "Tamil": "ta-IN",
      "Telugu": "te-IN", "Urdu": "ur-IN", "English": "en-IN"
    };
    return map[languageName] || "en-IN";
  },

  speak(text, language = "English", btnElement = null) {
    if (!("speechSynthesis" in window)) { alert("Audio is not supported on this browser."); return; }
    window.speechSynthesis.cancel();
    if (this.activeButton) {
      this.activeButton.style.opacity = "0.5";
      this.activeButton.classList.remove("speaking-pulse");
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.getLangCode(language);
    utterance.rate = 0.85;

    if (btnElement) {
      this.activeButton = btnElement;
      btnElement.style.opacity = "1";
      btnElement.classList.add("speaking-pulse");
      utterance.onend = () => {
        btnElement.style.opacity = "0.5";
        btnElement.classList.remove("speaking-pulse");
        this.activeButton = null;
      };
    }
    window.speechSynthesis.speak(utterance);
  },
  stop() { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }
};

// ── SPEECH RECOGNITION (MIC) HELPER ──
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const MicListener = {
  recognition: null,
  isListening: false,
  start(onResult, onEnd) {
    if (!SpeechRec) return alert("Microphone is not supported on this browser. Try Chrome.");
    this.recognition = new SpeechRec();
    this.recognition.lang = 'en-IN';
    this.recognition.interimResults = false;
    this.recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    this.recognition.onend = () => { this.isListening = false; if(onEnd) onEnd(); };
    this.isListening = true;
    this.recognition.start();
  },
  stop() { if(this.recognition) this.recognition.stop(); }
};

// ===== LOGIN CHECK =====
const student      = getStudentData();
const adminSession = JSON.parse(localStorage.getItem("adminSession") || "null");

if (!student && !adminSession) window.location.href = "login.html";
if (student && !getStudentToken()) { localStorage.removeItem("student"); window.location.href = "login.html"; }

const isAdminViewing = !student && !!adminSession;
const activeUser     = student || { name: adminSession?.username || "Guest", school: "Demo View" };

function doLogout() {
  if (isAdminViewing) window.location.href = "admin.html";
  else {
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
      id: cls.id, label: cls.label,
      modules: cls.lessons.map(l => ({ id: l.id, title: l.title, description: l.description, questions: l.questions }))
    }));

    if (!isAdminViewing && student?.id) {
      try { 
        allProgress = await Students.getProgress(student.id); 
        studentProfile = await Students.getProfile(student.id);
        student.streak_days = studentProfile.streak_days;
      } catch (err) { console.error("Error fetching progress", err); }
    }

    if (classes.length > 0) {
      state.selectedClassId  = classes[0].id;
      state.selectedModuleId = classes[0].modules[0]?.id || "";
    }
    render();
  } catch (err) {
    const moduleGrid = document.getElementById("moduleGrid");
    if (moduleGrid) moduleGrid.innerHTML = `<p class="empty-state">Could not connect to server.<br><small>${err.message}</small></p>`;
  }
}

function getSelectedClass() { return classes.find(c => c.id === state.selectedClassId); }

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    completed: p.completed,
    answeredCount: p.answered_count > 0 ? p.answered_count : derived,
    answers
  };
}

// ===== TEACHER BROADCASTS =====
const BROADCAST_ICONS = { announcement: "📣", goal: "🎯", reminder: "⏰" };

function getRelevantBroadcasts() {
  let broadcasts = [];
  try { broadcasts = JSON.parse(localStorage.getItem("broadcasts") || "[]"); } catch {}
  const selectedClass = getSelectedClass();
  return broadcasts.filter(b => !b.class || b.class === selectedClass?.label);
}

function renderBroadcasts() {
  const panel = document.getElementById("broadcastPanel");
  const list  = document.getElementById("broadcastList");
  const pill  = document.getElementById("broadcastCountPill");
  if (!panel || !list) return;

  const relevant = getRelevantBroadcasts();
  if (relevant.length === 0) { panel.style.display = "none"; }
  else {
    panel.style.display = "";
    if (pill) pill.textContent = relevant.length;
    list.innerHTML = relevant.slice(0, 5).map(b => `
      <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.6);border:1px solid rgba(80,58,40,0.1);">
        <strong style="font-size:0.85rem;">${BROADCAST_ICONS[b.type] || "📣"} ${escapeHtml(b.title)}</strong>
        <p style="margin:4px 0 0;font-size:0.82rem;color:var(--muted);line-height:1.5;">${escapeHtml(b.message)}</p>
      </div>
    `).join("");
  }

  const railBadge = document.getElementById("broadcastRailBadge");
  if (railBadge) {
    if (relevant.length > 0) { railBadge.textContent = relevant.length; railBadge.style.display = "flex"; }
    else railBadge.style.display = "none";
  }
}

window.renderBroadcastFullPage = function() {
  const container = document.getElementById("broadcastFullList");
  if (!container) return;
  const relevant = getRelevantBroadcasts();

  if (relevant.length === 0) {
    container.innerHTML = `<p class="empty-state">No broadcasts yet — your teacher hasn't sent anything to your class.</p>`;
    return;
  }

  container.innerHTML = relevant.map(b => `
    <div class="workspace-panel" style="padding:24px; border-radius:20px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="font-size:1.4rem;">${BROADCAST_ICONS[b.type] || "📣"}</span>
        <h3 style="margin:0; font-family:var(--font-family); font-weight:700; letter-spacing:-0.02em; font-size:1.25rem;">${escapeHtml(b.title)}</h3>
      </div>
      <p style="margin:0 0 10px; color: var(--text); line-height:1.7;">${escapeHtml(b.message)}</p>
      <span style="font-size:0.78rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em; font-weight:700;">
        ${b.class ? escapeHtml(b.class) : "All Classes"} · ${new Date(b.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
    </div>
  `).join("");
}

// ===== TEACHER RESOURCE LIBRARY =====
const RESOURCE_ICONS = { pdf: "📄", reading: "📖", audio: "🎧", link: "🔗" };

function getRelevantResources() {
  let resources = [];
  try { resources = JSON.parse(localStorage.getItem("resources") || "[]"); } catch {}
  const selectedClass = getSelectedClass();
  return resources.filter(r => !r.class || r.class === selectedClass?.label);
}

function renderResourceLibrary() {
  const panel = document.getElementById("resourcePanel");
  const list  = document.getElementById("resourceList");
  const pill  = document.getElementById("resourceCountPill");
  if (!panel || !list) return;

  const relevant = getRelevantResources();

  if (relevant.length === 0) { panel.style.display = "none"; }
  else {
    panel.style.display = "";
    if (pill) pill.textContent = relevant.length;
    list.innerHTML = relevant.map(r => `
      <a href="${escapeHtml(r.url)}" ${r.fileName ? `download="${escapeHtml(r.fileName)}"` : `target="_blank" rel="noopener"`} style="display:block;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.6);border:1px solid rgba(80,58,40,0.1);text-decoration:none;color:inherit;">
        <strong style="font-size:0.85rem;">${RESOURCE_ICONS[r.type] || "📄"} ${escapeHtml(r.title)}</strong>
        ${r.notes ? `<p style="margin:4px 0 0;font-size:0.8rem;color:var(--muted);line-height:1.5;">${escapeHtml(r.notes)}</p>` : ""}
      </a>
    `).join("");
  }

  const railBadge = document.getElementById("resourceRailBadge");
  if (railBadge) {
    if (relevant.length > 0) { railBadge.textContent = relevant.length; railBadge.style.display = "flex"; }
    else railBadge.style.display = "none";
  }
}

window.renderResourceFullPage = function() {
  const container = document.getElementById("resourceFullList");
  if (!container) return;
  const relevant = getRelevantResources();

  if (relevant.length === 0) {
    container.innerHTML = `<p class="empty-state">No resources yet — your teacher hasn't shared anything with your class.</p>`;
    return;
  }

  container.innerHTML = relevant.map(r => `
    <a href="${escapeHtml(r.url)}" ${r.fileName ? `download="${escapeHtml(r.fileName)}"` : `target="_blank" rel="noopener"`} class="workspace-panel" style="display:block; padding:22px; border-radius:20px; text-decoration:none; color:inherit; transition: transform 0.15s ease;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="font-size:1.4rem;">${RESOURCE_ICONS[r.type] || "📄"}</span>
        <h3 style="margin:0; font-family:var(--font-family); font-weight:700; letter-spacing:-0.02em; font-size:1.15rem;">${escapeHtml(r.title)}</h3>
      </div>
      ${r.notes ? `<p style="margin:0 0 10px; color: var(--muted); line-height:1.6; font-size:0.92rem;">${escapeHtml(r.notes)}</p>` : ""}
      <span style="font-size:0.78rem; color: var(--accent-deep); font-weight:800;">${r.fileName ? `⬇️ Download (${r.fileName})` : "Open resource →"}</span>
    </a>
  `).join("");
}

// ===== CLASS LIST =====
function renderClassList() {
  const classListEl = document.getElementById("classList");
  if (!classListEl) return;
  classListEl.innerHTML = "";

  if (classes.length === 0) {
    classListEl.innerHTML = `<p class="empty-state">No classes right now.</p>`;
    return;
  }

  classes.forEach(courseClass => {
    const button = document.createElement("button");
    button.className = "class-button" + (courseClass.id === state.selectedClassId ? " is-active" : "");
    button.innerHTML = `<strong>${escapeHtml(courseClass.label)}</strong>`;
    button.onclick = () => {
      state.selectedClassId  = courseClass.id;
      state.selectedModuleId = courseClass.modules[0]?.id || "";
      document.getElementById("platformSidebar")?.classList.remove("mobile-open");
      render();
    };
    classListEl.appendChild(button);
  });
}

// ===== PROGRESS SIDEBAR =====

function updateDailyGoal(answeredCount) {
  const goal = 5;
  const todayCount = Math.min(answeredCount, goal); 
  
  const ring = document.getElementById("dailyGoalRing");
  const text = document.getElementById("dailyGoalText");
  const sub  = document.getElementById("dailyGoalSubtitle");
  
  if (ring && text && sub) {
    text.textContent = `${todayCount}/${goal}`;
    const offset = 264 - (264 * (todayCount / goal));
    ring.style.strokeDashoffset = offset;
    
    if (todayCount >= goal) {
      sub.textContent = "Goal reached! 🔥";
      sub.style.color = "#d97706";
      sub.style.fontWeight = "700";
    } else {
      sub.textContent = "Keep your streak alive!";
      sub.style.color = "var(--muted)";
      sub.style.fontWeight = "normal";
    }
  }
}

// ===== ACHIEVEMENT SYSTEM =====
function evaluateAchievements(totalCompleted, totalAnswers, streakDays) {
  const badgesGrid = document.getElementById("badgesGrid");
  const badgeCountPill = document.getElementById("badgeCountPill");
  if (!badgesGrid || !badgeCountPill) return;

  const earnedBadges = [];

  if (totalCompleted >= 1) earnedBadges.push({ icon: "🌟", name: "First Steps" });
  if (streakDays >= 3) earnedBadges.push({ icon: "🔥", name: "On Fire" });
  if (totalAnswers >= 10) earnedBadges.push({ icon: "🎯", name: "Sharp Shooter" });

  const studentId = studentProfile?.id || student?.id || "guest";
  const wordBank = JSON.parse(localStorage.getItem(`wordBank_${studentId}`) || "[]");
  if (wordBank.length >= 5) earnedBadges.push({ icon: "🗂️", name: "Word Wizard" });
  
  const hasLightning = localStorage.getItem(`lightningBadge_${studentId}`);
  if (hasLightning) earnedBadges.push({ icon: "⚡", name: "Lightning Fast" });

  if (earnedBadges.length === 0) {
    badgesGrid.innerHTML = `<p class="empty-state" style="grid-column: 1 / -1; padding: 12px; margin-top: 10px;">No badges yet. Start learning to earn some!</p>`;
    badgeCountPill.textContent = "0";
  } else {
    badgesGrid.innerHTML = "";
    badgeCountPill.textContent = earnedBadges.length;
    
    earnedBadges.forEach(badge => {
      badgesGrid.innerHTML += `
        <div class="badge-card" style="animation: popIn 0.4s ease;">
          <div class="badge-icon">${badge.icon}</div>
          <div class="badge-name">${badge.name}</div>
        </div>
      `;
    });
  }
}

function renderProgress() {
  const selectedClass     = getSelectedClass();
  const lessonCountEl     = document.getElementById("lessonCount");
  const completedCountEl  = document.getElementById("completedCount");
  const progressValueEl   = document.getElementById("overallProgressValue");
  const progressFillEl    = document.getElementById("overallProgressFill");
  const activeClassPillEl = document.getElementById("activeClassPill");
  const classHeadingEl    = document.getElementById("classHeading");

  if (!selectedClass) {
    if (lessonCountEl) lessonCountEl.textContent = "0";
    if (completedCountEl) completedCountEl.textContent = "0";
    if (progressValueEl) progressValueEl.textContent = "0%";
    if (progressFillEl) progressFillEl.style.width = "0%";
    if (activeClassPillEl) activeClassPillEl.textContent = "—";
    if (classHeadingEl) classHeadingEl.textContent = "No class yet";
    return;
  }

  const total = selectedClass.modules.length;
  const completed = selectedClass.modules.filter(m => getModuleProgress(m.id).completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const totalAnswers = selectedClass.modules.reduce((sum, m) => sum + (getModuleProgress(m.id).answeredCount || 0), 0);

  if (lessonCountEl) lessonCountEl.textContent = total;
  if (completedCountEl) completedCountEl.textContent = completed;

  const streakEl = document.getElementById("streakCount");
  if (streakEl) {
    const streak = studentProfile?.streak_days || student?.streak_days || 0;
    streakEl.textContent = streak > 0 ? `🔥 ${streak}` : "0";
  }
  
  if (progressValueEl) progressValueEl.textContent = percent + "%";
  if (progressFillEl) progressFillEl.style.width = percent + "%";
  if (activeClassPillEl) activeClassPillEl.textContent = selectedClass.label;
  if (classHeadingEl) classHeadingEl.textContent = selectedClass.label + " — Learning Path";

  updateDailyGoal(totalAnswers);
  const currentStreak = studentProfile?.streak_days || student?.streak_days || 0;
  evaluateAchievements(completed, totalAnswers, currentStreak);
}

// ===== MODULE GRID =====
function renderModules() {
  const selectedClass = getSelectedClass();
  const moduleGridEl  = document.getElementById("moduleGrid");
  if (!moduleGridEl || !selectedClass) return;
  moduleGridEl.innerHTML = "";

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
      <h4>${escapeHtml(module.title)}</h4>
      <p>${escapeHtml(module.description || "")}</p>
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
    stack.innerHTML = `
      <div class="lesson-progress-row">
        <div class="lesson-progress-label">
          <span>${answered} of ${total} question${total !== 1 ? "s" : ""} answered</span>
          <span>${percent}%</span>
        </div>
        <div class="lesson-mini-bar"><div class="lesson-mini-fill" style="width:${percent}%"></div></div>
      </div>
    `;
  }

  const goBtn = document.createElement("button");
  goBtn.className = "primary-action lesson-go-btn";
  goBtn.textContent = isComplete ? "Review Lesson" : (answered > 0 ? "Resume Lesson →" : "Start Lesson →");
  goBtn.onclick = () => {
    localStorage.setItem("currentLesson", JSON.stringify({ classId: selectedClass.id, moduleId: module.id }));
    window.location.href = "lesson.html";
  };
  stack.appendChild(goBtn);
}

// ===== AI STUDY COMPANION PANEL & MODALS =====
function renderAIPanel(module) {
  const aiPanel = document.querySelector(".workspace-panel.ai-panel");
  if (!aiPanel || !module) return;

  const allLessons = classes.flatMap(c => c.modules);
  let optionsHtml = '<option value="">Select a lesson...</option>';
  allLessons.forEach(l => {
    const isSelected = l.id === module.id ? "selected" : "";
    optionsHtml += `<option value="${l.id}" data-title="${escapeHtml(l.title)}" data-desc="${escapeHtml(l.description || '')}" ${isSelected}>${escapeHtml(l.title)}</option>`;
  });

  aiPanel.innerHTML = `
    <div class="section-head" style="margin-bottom: 20px;">
      <div>
        <p class="panel-label" style="color: var(--accent-deep);">AI Study Companion</p>
        <h3 style="font-family: var(--font-family); font-weight: 700; letter-spacing: -0.025em; font-size: 1.8rem; color: var(--text);">Learn with Buddy</h3>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; background: rgba(34, 197, 94, 0.1); padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(34, 197, 94, 0.2);">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: ai-pulse 2s infinite;"></div>
        <span style="font-size: 0.75rem; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 0.05em;">AI Active</span>
      </div>
    </div>

    <div style="background: linear-gradient(145deg, #ffffff, #fdfbfa); border: 1px solid rgba(188,93,45,0.15); border-radius: 20px; padding: 24px; box-shadow: var(--shadow-soft);">
      <p style="font-size: 0.95rem; color: var(--muted); margin: 0 0 16px; line-height: 1.5;">Select a lesson below to generate personalized study guides or interactive memory decks.</p>
      <select id="aiStudySelect" style="width: 100%; min-height: 52px; padding: 0 16px; margin-bottom: 24px; border-radius: 14px; border: 1px solid rgba(80,58,40,0.2); font-family: inherit; font-size: 1rem; font-weight: 600; background: #fff url('data:image/svg+xml;utf8,<svg fill=%23503a28 height=24 viewBox=0 0 24 24 width=24 xmlns=http://www.w3.org/2000/svg><path d=\"M7 10l5 5 5-5z\"/></svg>') no-repeat right 16px center; -webkit-appearance: none; appearance: none; color: var(--text); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); cursor: pointer; transition: border-color 0.2s;">
        ${optionsHtml}
      </select>

      <div style="display: grid; gap: 14px;">
        <button onclick="triggerStudyHub('relearn')" style="display: flex; align-items: flex-start; gap: 16px; width: 100%; text-align: left; padding: 20px; border-radius: 16px; border: 1px solid rgba(56,189,248,0.3); background: linear-gradient(135deg, rgba(56,189,248,0.05), rgba(2,132,199,0.02)); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 20px rgba(56,189,248,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <div style="font-size: 1.8rem; background: #fff; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.06); border: 1px solid rgba(56,189,248,0.2); flex-shrink: 0;">📖</div>
          <div><strong style="display: block; font-size: 1.1rem; color: #0284c7; margin-bottom: 4px;">Lesson Recap & Quiz</strong><span style="font-size: 0.85rem; color: var(--muted); line-height: 1.45;">Get an AI-generated summary and take an infinite practice quiz.</span></div>
        </button>

        <button onclick="triggerStudyHub('flashcards')" style="display: flex; align-items: flex-start; gap: 16px; width: 100%; text-align: left; padding: 20px; border-radius: 16px; border: 1px solid rgba(139,92,246,0.3); background: linear-gradient(135deg, rgba(139,92,246,0.05), rgba(109,40,217,0.02)); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 20px rgba(139,92,246,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <div style="font-size: 1.8rem; background: #fff; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.06); border: 1px solid rgba(139,92,246,0.2); flex-shrink: 0;">✨</div>
          <div><strong style="display: block; font-size: 1.1rem; color: #6d28d9; margin-bottom: 4px;">Smart Flashcards</strong><span style="font-size: 0.85rem; color: var(--muted); line-height: 1.45;">Practice core concepts with a dynamic, interactive memory deck.</span></div>
        </button>
      </div>
    </div>
  `;
}

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
    
    <div class="ai-modal-overlay" id="modalRelearn" onclick="closeStudyModals(event)">
      <div class="ai-modal-content relearn-modal">
        <div class="ai-modal-header">
          <h3 class="ai-modal-title">📖 <span id="relearnModalTitle">Lesson Recap</span></h3>
          <button class="ai-modal-close" onclick="closeStudyModals()">✕</button>
        </div>
        <div class="ai-modal-body"><div id="relearnContentArea"></div></div>
      </div>
    </div>

    <div class="ai-modal-overlay" id="modalFlashcards" onclick="closeStudyModals(event)">
      <div class="ai-modal-content flashcard-modal">
        <div class="ai-modal-header">
          <h3 class="ai-modal-title">✨ <span id="flashcardModalTitle">Smart Flashcards</span></h3>
          <div style="display: flex; gap: 10px;">
            <button id="regenerateFlashcardsBtn" style="padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.4); background: rgba(139, 92, 246, 0.1); color: #4c1d95; font-weight: 700; cursor: pointer; display: none; font-size: 0.85rem; transition: background 0.2s;">🔄 Generate New</button>
            <button class="ai-modal-close" onclick="closeStudyModals()">✕</button>
          </div>
        </div>
        <div class="ai-modal-body"><div id="flashcardContentArea" class="ai-card-grid"></div></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalsHTML);
}
document.addEventListener("DOMContentLoaded", injectStudyModals);

window.closeStudyModals = function(e) {
  if (e && e.target.classList && !e.target.classList.contains("ai-modal-overlay")) return;
  document.getElementById("modalRelearn")?.classList.remove("show");
  document.getElementById("modalFlashcards")?.classList.remove("show");
  setTimeout(() => {
    const rArea = document.getElementById("relearnContentArea");
    const fArea = document.getElementById("flashcardContentArea");
    if (rArea) rArea.innerHTML = "";
    if (fArea) fArea.innerHTML = "";
  }, 300);
}

window.triggerStudyHub = async function(type) {
  const selectEl = document.getElementById("aiStudySelect");
  if (!selectEl || !selectEl.value) return alert("Please select a lesson first!");
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const lessonId = selectEl.value;
  const title = selectedOption.dataset.title;
  const desc = selectedOption.dataset.desc;

  if (type === 'relearn') {
    const modal = document.getElementById("modalRelearn");
    document.getElementById("relearnModalTitle").textContent = title;
    const contentArea = document.getElementById("relearnContentArea");
    contentArea.innerHTML = `<div class="ai-loading-state"><div class="spinner blue"></div><p style="color:#7dd3fc; margin:0; font-weight:600;">Buddy is preparing your lesson guide...</p></div>`;
    modal.classList.add("show");
    try {
      const res = await AI.getRelearn(lessonId, title, desc);
      const sectionIcons = { "WHAT YOU WILL LEARN": "📚", "KEY CONCEPTS": "🔑", "HELPFUL EXAMPLES": "✏️", "QUICK TIPS": "💡" };
      const lines = res.content.split("\n").map(l => l.trim()).filter(Boolean);
      let summaryHtml = ""; let currentSection = null; let buffer = [];
      function flushSection() {
        if (!currentSection || !buffer.length) return;
        const icon = sectionIcons[currentSection] || "📌";
        summaryHtml += `<div class="rl-section"><div class="rl-header">${icon} ${currentSection}</div>`;
        if (currentSection === "HELPFUL EXAMPLES") {
          buffer.forEach(line => {
            const clean = line.replace(/^[-•*]\s*/, "").replace(/^[""'](.+)[""']$/, "$1");
            summaryHtml += `<div class="rl-example">"${escapeHtml(clean.replace(/^"|"$/g, ""))}"</div>`;
          });
        } else {
          summaryHtml += `<ul>`;
          buffer.forEach(line => { summaryHtml += `<li>${escapeHtml(line.replace(/^[-•*]\s*/, ""))}</li>`; });
          summaryHtml += `</ul>`;
        }
        summaryHtml += `</div>`;
        buffer = [];
      }
      let matchedAny = false;
      lines.forEach(line => {
        const cleanLine = line.replace(/[*#_]/g, ""); 
        const upperLine = cleanLine.toUpperCase().replace(/[📚🔑✏️💡]/gu, "").trim();
        const matchedSection = Object.keys(sectionIcons).find(k => upperLine.includes(k));
        if (matchedSection) { flushSection(); currentSection = matchedSection; matchedAny = true; }
        else if (currentSection) { const clean = line.replace(/^[-•*\d.]\s*/, "").trim(); if (clean.length > 2) buffer.push(clean); }
        else { summaryHtml += `<p style="color:rgba(147,197,253,0.9); margin-bottom:12px;">${escapeHtml(line)}</p>`; }
      });
      flushSection();
      if (!matchedAny && !summaryHtml) summaryHtml = `<div style="color:#cbd5e1; font-size:0.95rem; line-height:1.8;">${escapeHtml(res.content).replace(/\n/g, '<br>')}</div>`;
      
      contentArea.innerHTML = `
        <div class="relearn-content">${summaryHtml}</div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(56,189,248,0.2); text-align: center;">
          <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 12px;">Finished reviewing? Test your understanding with dynamic practice questions!</p>
          <button id="startQuizBtn" style="min-height: 44px; padding: 0 24px; border-radius: 999px; border: none; background: linear-gradient(135deg, #38bdf8, #0284c7); color: #0f2027; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(56,189,248,0.4);">⚡ Take Practice Quiz</button>
        </div>
      `;
      document.getElementById("startQuizBtn").addEventListener("click", async () => {
        contentArea.innerHTML = `<div class="ai-loading-state"><div class="spinner blue"></div><p style="color:#7dd3fc; margin:0; font-weight:600;">Generating a fresh practice set...</p></div>`;
        try {
          const quizRes = await apiFetch("/api/ai/quick-quiz", { method: "POST", body: JSON.stringify({ lesson_id: lessonId, lesson_title: title, lesson_description: desc }) });
          const questions = quizRes.quiz || [];
          if (questions.length === 0) throw new Error("No quiz questions generated.");
          let currentQIndex = 0; let score = 0;
          function renderQuizLoop() {
            if (currentQIndex >= questions.length) {
              contentArea.innerHTML = `
                <div style="text-align: center; padding: 30px 20px; animation: popIn 0.4s ease;">
                  <div style="font-size: 3rem; margin-bottom: 12px;">🏆</div>
                  <h3 style="color: #e0f2fe; font-size: 1.5rem; font-weight: 800; margin-bottom: 8px;">Practice Complete!</h3>
                  <p style="color: #94a3b8; font-size: 1rem; margin-bottom: 20px;">You scored <strong>${score}</strong> out of <strong>${questions.length}</strong>.</p>
                  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button id="retryQuizBtn" style="min-height: 42px; padding: 0 20px; border-radius: 12px; border: 1px solid rgba(56,189,248,0.4); background: rgba(56,189,248,0.1); color: #7dd3fc; font-weight: 700; cursor: pointer;">🔄 Try New Questions</button>
                    <button id="backToSummaryBtn" style="min-height: 42px; padding: 0 20px; border-radius: 12px; border: none; background: #38bdf8; color: #0f2027; font-weight: 700; cursor: pointer;">📖 Review Notes</button>
                  </div>
                </div>
              `;
              document.getElementById("retryQuizBtn").onclick = () => document.getElementById("startQuizBtn").click();
              document.getElementById("backToSummaryBtn").onclick = () => triggerStudyHub('relearn');
              return;
            }
            const q = questions[currentQIndex];
            let optionsHtml = "";
            q.options.forEach(opt => {
              optionsHtml += `<button class="quiz-option-btn" data-opt="${escapeHtml(opt)}" style="width:100%; text-align:left; padding:14px 18px; border-radius:14px; border:1px solid rgba(56,189,248,0.25); background:rgba(255,255,255,0.05); color:#f1f5f9; font-size:0.95rem; font-weight:600; cursor:pointer; transition:all 0.2s;">${escapeHtml(opt)}</button>`;
            });
            contentArea.innerHTML = `
              <div style="animation: popIn 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 0.85rem; font-weight: 800; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.05em;">
                  <span>Question ${currentQIndex + 1} of ${questions.length}</span>
                  <span>Score: ${score}</span>
                </div>
                <h4 style="color: #ffffff; font-size: 1.15rem; font-weight: 700; line-height: 1.5; margin-bottom: 20px;">${escapeHtml(q.question)}</h4>
                <div style="display: grid; gap: 10px;">${optionsHtml}</div>
              </div>
            `;
            contentArea.querySelectorAll(".quiz-option-btn").forEach(btn => {
              btn.addEventListener("click", (e) => {
                const selected = e.currentTarget.dataset.opt; const correct = q.answer.trim();
                const allBtns = contentArea.querySelectorAll(".quiz-option-btn");
                allBtns.forEach(b => b.disabled = true);
                if (selected.trim() === correct) {
                  score++;
                  e.currentTarget.style.background = "rgba(34, 197, 94, 0.25)";
                  e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.color = "#4ade80";
                } else {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                  e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#fca5a5";
                  allBtns.forEach(b => {
                    if (b.dataset.opt.trim() === correct) { b.style.background = "rgba(34, 197, 94, 0.2)"; b.style.borderColor = "#22c55e"; b.style.color = "#4ade80"; }
                  });
                }
                setTimeout(() => { currentQIndex++; renderQuizLoop(); }, 1200);
              });
            });
          }
          renderQuizLoop();
        } catch (quizErr) { contentArea.innerHTML = `<div style="color:#fca5a5; text-align:center; padding:20px;">Could not load quiz: ${escapeHtml(quizErr.message)}</div>`; }
      });
    } catch(err) { contentArea.innerHTML = `<p style="color:#fca5a5; text-align:center;">Error: ${err.message}</p>`; }
  } else if (type === 'flashcards') {
    const modal = document.getElementById("modalFlashcards");
    document.getElementById("flashcardModalTitle").textContent = title + " Deck";
    const contentArea = document.getElementById("flashcardContentArea");
    const regenBtn = document.getElementById("regenerateFlashcardsBtn");
    if (regenBtn) { regenBtn.style.display = "none"; regenBtn.onclick = () => triggerStudyHub('flashcards'); }
    contentArea.innerHTML = `<div class="ai-loading-state" style="grid-column: 1 / -1;"><div class="spinner purple"></div><p style="color:#6d28d9; margin:0; font-weight:600;">Generating smart flashcards...</p></div>`;
    modal.classList.add("show");
    try {
      const res = await AI.generateFlashcards(title, desc, 6);
      contentArea.innerHTML = "";
      (res.flashcards || []).forEach((card, i) => {
        const wrap = document.createElement("div");
        wrap.className = "ai-card-wrapper";
        wrap.style.animationDelay = `${i * 0.1}s`;
        wrap.innerHTML = `<div class="ai-card-inner"><div class="ai-card-front">${escapeHtml(card.front)}</div><div class="ai-card-back">${escapeHtml(card.back)}</div></div>`;
        wrap.onclick = () => wrap.querySelector(".ai-card-inner").classList.toggle("is-flipped");
        contentArea.appendChild(wrap);
      });
      if (regenBtn) regenBtn.style.display = "block";
    } catch(err) { contentArea.innerHTML = `<p style="color:#dc2626; grid-column:1/-1; text-align:center;">Error: ${err.message}</p>`; }
  }
};

// ===== AI STUDENT ANALYSIS WIDGET =====
function renderLocalAnalysisStats() {
  const section = document.getElementById("aiAnalysisSection");
  if (!section) return;
  if (isAdminViewing || !student?.id) { section.style.display = "none"; return; }
  section.style.display = "";

  let scored = 0, correct = 0, scoreSum = 0;
  Object.values(allProgress || {}).forEach(p => {
    if (!p.answers) return;
    Object.values(p.answers).forEach(a => {
      const text = typeof a === "string" ? a : a?.text;
      const score = typeof a === "object" ? (a.ai_score || 0) : 0;
      if (text && text.trim() && score > 0) {
        scored++; scoreSum += score;
        if (score >= 3) correct++;
      }
    });
  });

  const accuracy = scored > 0 ? Math.round((correct / scored) * 100) : 0;
  const avgScore = scored > 0 ? (scoreSum / scored).toFixed(1) : "0";
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("statScored", scored); set("statCorrect", correct); set("statAccuracy", accuracy + "%"); set("statAvgScore", avgScore + "/5");
}

async function getAiFeedbackAnalysis() {
  const btn = document.getElementById("getAiFeedbackBtn");
  const textEl = document.getElementById("aiAnalysisText");
  
  if (!btn || !textEl) return;
  
  // Prevent silent crashes during Admin Preview mode
  if (isAdminViewing || !student?.id) {
    textEl.textContent = "You are currently in Admin Preview mode. Please log in as a real student to generate an AI evaluation.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Thinking…";
  textEl.textContent = "Analysing your progress…";
  
  try {
    const data = await AI.getAnalysis(student.id);
    textEl.textContent = data.ai_summary || "No summary available yet.";
    
    // Sync the widget stats with the server data as a backup
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (data.scored_count !== undefined) set("statScored", data.scored_count);
    if (data.correct_count !== undefined) set("statCorrect", data.correct_count);
    if (data.accuracy_percentage !== undefined) set("statAccuracy", data.accuracy_percentage + "%");
    if (data.average_score !== undefined) set("statAvgScore", data.average_score + "/5");
  } catch (err) {
    textEl.textContent = "Could not fetch AI feedback right now: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Refresh AI Analysis";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("openAnalysisModalBtn");
  const closeBtn = document.getElementById("closeAnalysisModalBtn");
  const modal = document.getElementById("aiAnalysisModal");

  if (openBtn && modal) {
    openBtn.onclick = () => {
      renderLocalAnalysisStats();
      modal.style.display = "flex";
      void modal.offsetWidth;
      modal.style.opacity = "1";
    };
  }
  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      modal.style.opacity = "0";
      setTimeout(() => modal.style.display = "none", 250);
    };
  }
  
  const feedbackBtn = document.getElementById("getAiFeedbackBtn");
  if (feedbackBtn) feedbackBtn.addEventListener("click", getAiFeedbackAnalysis);
});

// ===== RESET PROGRESS =====
document.getElementById("resetClassButton")?.addEventListener("click", () => document.getElementById("resetModal")?.classList.add("is-open"));
document.getElementById("resetModalCancel")?.addEventListener("click", () => document.getElementById("resetModal")?.classList.remove("is-open"));
document.getElementById("resetModalConfirm")?.addEventListener("click", async () => {
  const selectedClass = getSelectedClass();
  if (selectedClass && student?.id) {
    await Students.resetProgress(student.id, selectedClass.modules.map(m => m.id));
    selectedClass.modules.forEach(m => delete allProgress[m.id]);
  }
  document.getElementById("resetModal")?.classList.remove("is-open");
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
  renderBroadcasts();
  renderResourceLibrary();

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

// ════════════════════════════════════════════════════════════════════
//  APP RAIL FEATURES
// ════════════════════════════════════════════════════════════════════

window.loadWordBank = function() {
  const wordGrid = document.getElementById("wordGrid");
  if (!wordGrid) return;
  const words = JSON.parse(localStorage.getItem(`wordBank_${studentProfile?.id}`) || "[]");
  wordGrid.innerHTML = "";
  if (words.length === 0) { wordGrid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--muted); font-size: 1.05rem;">Your bank is empty. Add a word above!</p>`; return; }
  
  words.reverse().forEach(item => {
    wordGrid.innerHTML += `
      <div class="word-card" style="position: relative; padding-right: 50px;">
        <button onclick="BuddyVoice.speak('${escapeHtml(item.word).replace(/'/g, "\\'")}. ${escapeHtml(item.definition).replace(/'/g, "\\'")}. For example: ${escapeHtml(item.example).replace(/'/g, "\\'")}', 'English', this)" style="position: absolute; right: 16px; top: 16px; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(80,58,40,0.2); background: rgba(80,58,40,0.05); font-size: 1.1rem; cursor: pointer; display:flex; align-items:center; justify-content:center;">🔊</button>
        <h4 style="font-size: 1.4rem; font-family: var(--font-family); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 6px; color: var(--accent-deep);">${escapeHtml(item.word)}</h4>
        <p style="font-size: 0.95rem; color: var(--text); font-weight: 600; margin-bottom: 8px;">${escapeHtml(item.definition)}</p>
        <p style="font-size: 0.9rem; color: var(--muted); font-style: italic;">"${escapeHtml(item.example)}"</p>
      </div>
    `;
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const runTranslateBtn = document.getElementById("runTranslateBtn");
  if (runTranslateBtn) {
    runTranslateBtn.addEventListener("click", async () => {
      const text = document.getElementById("transInput").value.trim();
      const lang = document.getElementById("transLang").value;
      const resultDiv = document.getElementById("transResult");
      if (!text) return;
      
      runTranslateBtn.textContent = "Translating..."; runTranslateBtn.disabled = true;
      resultDiv.style.display = "block"; resultDiv.innerHTML = `<p style="color:var(--muted); font-size:1.05rem;">Buddy is translating...</p>`;
      
      try {
        const res = await apiFetch("/api/ai/translate", { method: "POST", body: JSON.stringify({ text: text, target_language: lang }) });
        resultDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <p style="font-size: 0.85rem; font-weight: 800; color: #3d5220; text-transform: uppercase; margin: 0;">${escapeHtml(lang)} Translation:</p>
            <button onclick="BuddyVoice.speak('${escapeHtml(res.translation).replace(/'/g, "\\'")}', '${lang}', this)" style="background:none; border:none; font-size:1.4rem; cursor:pointer; opacity:0.5; transition:0.2s;">🔊</button>
          </div>
          <p style="font-size: 1.5rem; font-weight: 700; color: #1f1a16; margin-top:0; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid rgba(111,124,74,0.2);">${escapeHtml(res.translation)}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <p style="font-size: 0.85rem; font-weight: 800; color: #3d5220; text-transform: uppercase; margin: 0;">Grammar Tip 💡:</p>
            <button onclick="BuddyVoice.speak('${escapeHtml(res.grammar_tip).replace(/'/g, "\\'")}', 'English', this)" style="background:none; border:none; font-size:1.4rem; cursor:pointer; opacity:0.5; transition:0.2s;">🔊</button>
          </div>
          <p style="font-size: 1.05rem; color: var(--text); line-height: 1.6; margin: 0;">${escapeHtml(res.grammar_tip)}</p>
        `;
      } catch (err) { resultDiv.innerHTML = `<p style="color:#ef4444;">Translation failed: ${escapeHtml(err.message)}</p>`; } 
      finally { runTranslateBtn.textContent = "✨ Translate"; runTranslateBtn.disabled = false; }
    });
  }

  const addWordBtn = document.getElementById("addWordBtn");
  if (addWordBtn) {
    addWordBtn.addEventListener("click", async () => {
      const input = document.getElementById("wordInput");
      const word = input.value.trim();
      if (!word) return;
      addWordBtn.textContent = "Loading..."; addWordBtn.disabled = true;
      try {
        const res = await apiFetch("/api/ai/word-bank/define", { method: "POST", body: JSON.stringify({ word: word }) });
        let words = JSON.parse(localStorage.getItem(`wordBank_${studentProfile?.id}`) || "[]");
        words = words.filter(w => w.word.toLowerCase() !== res.word.toLowerCase());
        words.push(res);
        localStorage.setItem(`wordBank_${studentProfile?.id}`, JSON.stringify(words));
        input.value = ""; window.loadWordBank();
      } catch (err) { alert("Could not define word: " + err.message); } 
      finally { addWordBtn.textContent = "Add to Bank"; addWordBtn.disabled = false; }
    });
  }

  const generateStoryBtn = document.getElementById("generateStoryBtn");
  if (generateStoryBtn) {
    generateStoryBtn.addEventListener("click", async () => {
      const topic = document.getElementById("storyTopicInput").value.trim();
      const resultDiv = document.getElementById("storyResult");
      if (!topic) return;
      generateStoryBtn.textContent = "Writing..."; generateStoryBtn.disabled = true;
      resultDiv.innerHTML = `<div class="ai-loading-state" style="padding: 30px;"><div class="spinner blue"></div><p style="color: var(--muted); margin-top: 12px; font-size: 1.1rem;">Buddy is writing your story...</p></div>`;
      try {
        const res = await apiFetch("/api/ai/story", { method: "POST", body: JSON.stringify({ topic: topic }) });
        let paragraphsHtml = res.paragraphs.map(p => `<p style="font-size: 1.15rem; line-height: 1.8; color: var(--text); margin-bottom: 16px;">${escapeHtml(p)}</p>`).join("");
        const fullStoryText = res.title + ". " + res.paragraphs.join(" ");
        resultDiv.innerHTML = `
          <div style="padding: 40px; border-radius: 24px; background: #fff; border: 1px solid rgba(80,58,40,0.1); box-shadow: var(--shadow-soft);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px;">
              <h4 style="font-family: var(--font-family); font-size: 2.1rem; font-weight: 800; letter-spacing: -0.025em; color: var(--accent-deep); margin: 0;">${escapeHtml(res.title)}</h4>
              <button onclick="BuddyVoice.speak('${escapeHtml(fullStoryText).replace(/'/g, "\\'")}', 'English', this)" style="min-height: 40px; padding: 0 16px; border-radius: 12px; border: 1px solid rgba(111,124,74,0.3); background: rgba(111,124,74,0.1); color: #3d5220; font-weight: 700; cursor: pointer; display:flex; align-items:center; gap: 8px; flex-shrink: 0;">🔊 Read to me</button>
            </div>
            ${paragraphsHtml}
          </div>
        `;
      } catch (err) { resultDiv.innerHTML = `<p style="color:#ef4444;">Could not write story: ${escapeHtml(err.message)}</p>`; } 
      finally { generateStoryBtn.textContent = "✍️ Generate Story"; generateStoryBtn.disabled = false; }
    });
  }
});

// ════════════════════════════════════════════════════════════════════
//  PRONUNCIATION LAB
// ════════════════════════════════════════════════════════════════════

let currentPronunciationSentence = "";

window.loadPronunciationTask = async function() {
  const box = document.getElementById("pronunciationBox");
  if (!box) return;
  box.innerHTML = `<div class="spinner blue" style="margin: 0 auto;"></div><p style="color:var(--muted); margin-top:16px;">Generating sentence...</p>`;
  try {
    const res = await apiFetch("/api/ai/pronunciation-task", { method: "POST" });
    currentPronunciationSentence = res.sentence;
    renderPronunciationUI();
  } catch (err) {
    box.innerHTML = `<p style="color:red;">Error: ${err.message}</p><button onclick="loadPronunciationTask()" class="primary-action" style="margin:0 auto;">Try Again</button>`;
  }
};

function renderPronunciationUI() {
  const box = document.getElementById("pronunciationBox");
  box.innerHTML = `
    <div style="margin-bottom: 32px;">
      <p style="font-size: 0.85rem; font-weight: 800; color: var(--accent-deep); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Your Target Sentence</p>
      <h2 style="font-family: var(--font-family); font-size: 2.2rem; font-weight: 700; letter-spacing: -0.025em; color: var(--text); line-height: 1.35; margin: 0 0 16px;">"${escapeHtml(currentPronunciationSentence)}"</h2>
      <button onclick="BuddyVoice.speak('${escapeHtml(currentPronunciationSentence).replace(/'/g, "\\'")}', 'English', this)" style="min-height: 40px; padding: 0 20px; border-radius: 999px; border: 1px solid rgba(111,124,74,0.3); background: rgba(111,124,74,0.1); color: #3d5220; font-weight: 700; cursor: pointer;">🔊 Hear Buddy Say It</button>
    </div>
    <div style="padding-top: 32px; border-top: 1px solid rgba(80,58,40,0.1);">
      <button id="pronunciationMicBtn" class="mic-btn" onclick="startPronunciationMic()">🎤</button>
      <p id="pronunciationStatus" style="color: var(--muted); font-size: 1.05rem; font-weight: 600; margin: 0;">Click the mic and start speaking</p>
    </div>
    <div id="pronunciationResultArea" style="margin-top: 32px; display: none;"></div>
  `;
}

window.startPronunciationMic = function() {
  const btn = document.getElementById("pronunciationMicBtn");
  const status = document.getElementById("pronunciationStatus");
  const resultArea = document.getElementById("pronunciationResultArea");
  
  if (MicListener.isListening) {
    MicListener.stop();
    return;
  }

  btn.classList.add("listening");
  status.textContent = "Listening... speak clearly!";
  status.style.color = "#16a34a";
  resultArea.style.display = "none";

  MicListener.start(
    (transcript) => {
      btn.classList.remove("listening");
      status.textContent = "Click the mic to try again";
      status.style.color = "var(--muted)";
      evaluatePronunciation(transcript);
    },
    () => {
      btn.classList.remove("listening");
      if(status.textContent === "Listening... speak clearly!") {
        status.textContent = "Didn't catch that. Try again.";
        status.style.color = "#dc2626";
      }
    }
  );
};

function evaluatePronunciation(spokenText) {
  const targetWords = currentPronunciationSentence.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const spokenWords = spokenText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  
  let correctCount = 0;
  const resultHtmlArray = targetWords.map(word => {
    if (spokenWords.includes(word)) {
      correctCount++;
      return `<span style="color: #16a34a; font-weight: 700;">${word}</span>`;
    } else {
      return `<span style="color: #dc2626; font-weight: 700; text-decoration: underline;">${word}</span>`;
    }
  });

  const accuracy = Math.round((correctCount / targetWords.length) * 100);
  const resultArea = document.getElementById("pronunciationResultArea");
  let feedbackText = accuracy >= 80 ? "Amazing job! 🌟" : accuracy >= 50 ? "Good effort, keep practicing! 👍" : "Let's try that one again. 💪";
  
  resultArea.style.display = "block";
  resultArea.innerHTML = `
    <div style="background: rgba(80,58,40,0.04); border-radius: 16px; padding: 24px; text-align: left;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-weight: 800; font-size: 0.9rem; text-transform: uppercase; color: var(--accent-deep);">Accuracy Score</span>
        <span style="font-size: 1.4rem; font-weight: 800; color: ${accuracy >= 80 ? '#16a34a' : '#dc2626'};">${accuracy}%</span>
      </div>
      <p style="font-size: 1.15rem; line-height: 1.6; margin-bottom: 16px;">${resultHtmlArray.join(" ")}</p>
      <p style="font-size: 1rem; color: var(--text); font-weight: 600; margin-bottom: 20px;">${feedbackText}</p>
      <div style="text-align: center;">
        <button onclick="loadPronunciationTask()" style="min-height: 44px; padding: 0 24px; border-radius: 999px; border: none; background: var(--text); color: white; font-weight: 700; cursor: pointer;">Give me a new sentence</button>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════════
//  ROLEPLAY SANDBOX
// ════════════════════════════════════════════════════════════════════
let roleplayHistory = [];
let activeScenario = "";

window.startRoleplay = async function() {
  const select = document.getElementById("roleplayScenario");
  if (!select) return;
  activeScenario = select.value;
  roleplayHistory = [];
  
  const chatArea = document.getElementById("roleplayChatArea");
  chatArea.innerHTML = "";
  document.getElementById("roleplayInputContainer").style.display = "flex";
  document.getElementById("roleplayInput").focus();
  
  appendRoleplayMsg("bot", `Great! We are now practicing: "${activeScenario}". I will start!`);
  const loadingId = appendRoleplayMsg("bot", `<div class="spinner blue" style="width:20px;height:20px;border-width:2px;"></div>`, true);
  try {
    const res = await apiFetch("/api/ai/roleplay-chat", {
      method: "POST",
      body: JSON.stringify({ scenario: activeScenario, messages: [{ role: "user", content: "(Start the scenario)" }] })
    });
    document.getElementById(loadingId).remove();
    appendRoleplayMsg("bot", res.reply);
    roleplayHistory.push({ role: "assistant", content: res.reply });
    BuddyVoice.speak(res.reply.replace(/'/g, "\\'"), "English");
  } catch(err) {
    document.getElementById(loadingId).innerHTML = `<p style="color:#ef4444;margin:0;">Connection error.</p>`;
  }
};

function appendRoleplayMsg(role, content, isLoading = false) {
  const chatArea = document.getElementById("roleplayChatArea");
  const msgDiv = document.createElement("div");
  const msgId = "rp_msg_" + Date.now();
  msgDiv.id = msgId;
  msgDiv.style.cssText = `max-width: 80%; padding: 12px 18px; border-radius: 18px; font-size: 1.05rem; line-height: 1.5; animation: fadeViewIn 0.2s ease forwards; width: fit-content;`;
  
  if (role === "user") {
    msgDiv.style.background = "var(--accent-deep)";
    msgDiv.style.color = "white";
    msgDiv.style.alignSelf = "flex-end";
    msgDiv.style.borderBottomRightRadius = "4px";
  } else {
    msgDiv.style.background = "white";
    msgDiv.style.color = "var(--text)";
    msgDiv.style.alignSelf = "flex-start";
    msgDiv.style.borderBottomLeftRadius = "4px";
    msgDiv.style.boxShadow = "var(--shadow-soft)";
    msgDiv.style.border = "1px solid rgba(80,58,40,0.1)";
  }
  
  msgDiv.innerHTML = content;
  chatArea.appendChild(msgDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msgId;
}

window.sendRoleplayMessage = async function() {
  const input = document.getElementById("roleplayInput");
  const text = input.value.trim();
  if (!text) return;
  
  input.value = "";
  appendRoleplayMsg("user", text);
  roleplayHistory.push({ role: "user", content: text });
  
  const loadingId = appendRoleplayMsg("bot", `<div class="spinner blue" style="width:20px;height:20px;border-width:2px;"></div>`, true);
  try {
    const res = await apiFetch("/api/ai/roleplay-chat", {
      method: "POST",
      body: JSON.stringify({ scenario: activeScenario, messages: roleplayHistory })
    });
    document.getElementById(loadingId).remove();
    appendRoleplayMsg("bot", res.reply);
    roleplayHistory.push({ role: "assistant", content: res.reply });
    BuddyVoice.speak(res.reply.replace(/'/g, "\\'"), "English");
  } catch(err) {
    document.getElementById(loadingId).innerHTML = `<p style="color:#ef4444;margin:0;">Oops, network error.</p>`;
  }
};

window.toggleRoleplayMic = function() {
  const btn = document.getElementById("roleplayMicBtn");
  const input = document.getElementById("roleplayInput");
  
  if (MicListener.isListening) {
    MicListener.stop();
    return;
  }
  btn.style.background = "#22c55e";
  input.placeholder = "Listening...";
  
  MicListener.start(
    (transcript) => {
      input.value = transcript;
      btn.style.background = "#dc2626";
      input.placeholder = "Type or speak your reply...";
      sendRoleplayMessage(); 
    },
    () => {
      btn.style.background = "#dc2626";
      input.placeholder = "Type or speak your reply...";
    }
  );
};

// ════════════════════════════════════════════════════════════════════
//  SPACED REPETITION MEMORY DECK (SM-2 ALGORITHM)
// ════════════════════════════════════════════════════════════════════

let srsQueue = [];
let currentSrsWord = null;

function upgradeWordBankToSRS() {
  const studentId = studentProfile?.id || student?.id || "guest";
  let words = JSON.parse(localStorage.getItem(`wordBank_${studentId}`) || "[]");
  let updated = false;
  words = words.map(w => {
    if (!w.srs) {
      updated = true;
      w.srs = { repetition: 0, interval: 1, easeFactor: 2.5, nextReview: Date.now() };
    }
    return w;
  });
  if (updated) localStorage.setItem(`wordBank_${studentId}`, JSON.stringify(words));
  return words;
}

function saveWordBank(words) {
  const studentId = studentProfile?.id || student?.id || "guest";
  localStorage.setItem(`wordBank_${studentId}`, JSON.stringify(words));
}

window.startSpacedRepetition = function() {
  const words = upgradeWordBankToSRS();
  const now = Date.now();
  srsQueue = words.filter(w => w.srs.nextReview <= now);
  
  if (srsQueue.length === 0) {
    document.getElementById("srsPlayArea").innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 16px;">🎉</div>
      <h2 style="font-family: 'Newsreader', serif; font-size: 2.2rem; color: #3d5220;">You're all caught up!</h2>
      <p style="font-size: 1.1rem; color: var(--muted); margin-bottom: 32px;">There are no words due for review today. Add more words from the translator, or check back tomorrow.</p>
    `;
    return;
  }
  renderSrsCard();
};

function renderSrsCard() {
  if (srsQueue.length === 0) {
    document.getElementById("srsPlayArea").innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 16px;">🏆</div>
      <h2 style="font-family: 'Newsreader', serif; font-size: 2.2rem; color: #3d5220;">Daily Deck Complete!</h2>
      <p style="font-size: 1.1rem; color: var(--muted); margin-bottom: 32px;">Excellent work. Your memory is growing stronger.</p>
      <button onclick="switchAppView('view-dashboard')" class="primary-action" style="margin: 0 auto;">Return to Dashboard</button>
    `;
    return;
  }
  
  currentSrsWord = srsQueue[0];
  const playArea = document.getElementById("srsPlayArea");
  
  playArea.innerHTML = `
    <p style="font-size: 0.9rem; font-weight: 800; color: #6d28d9; text-transform: uppercase; margin-bottom: 12px;">Cards remaining: ${srsQueue.length}</p>
    <div id="srsFlashcard" style="width: 100%; height: 300px; perspective: 1000px; cursor: pointer; margin-bottom: 24px;" onclick="flipSrsCard()">
      <div id="srsCardInner" style="position: relative; width: 100%; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d;">
        <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 24px; background: white; border: 2px solid rgba(139, 92, 246, 0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.1);">
          <h2 style="font-family: 'Newsreader', serif; font-size: 3rem; color: #4c1d95; margin: 0;">${escapeHtml(currentSrsWord.word)}</h2>
          <p style="color: var(--muted); font-size: 0.9rem; margin-top: 16px;">Tap to flip</p>
        </div>
        <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 24px; background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; transform: rotateY(180deg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.3);">
          <p style="font-size: 1.3rem; font-weight: 600; line-height: 1.5; margin: 0 0 16px;">${escapeHtml(currentSrsWord.definition)}</p>
          <p style="font-size: 1.05rem; font-style: italic; opacity: 0.8; margin: 0;">"${escapeHtml(currentSrsWord.example)}"</p>
        </div>
      </div>
    </div>
    <div id="srsControls" style="display: none; gap: 12px; justify-content: center;">
      <button onclick="gradeSrsCard(1)" style="flex: 1; padding: 16px; border-radius: 16px; border: none; background: #fee2e2; color: #b91c1c; font-size: 1rem; font-weight: 800; cursor: pointer; transition: 0.2s;">Hard<br><span style="font-size:0.75rem; font-weight:600;">Again soon</span></button>
      <button onclick="gradeSrsCard(4)" style="flex: 1; padding: 16px; border-radius: 16px; border: none; background: #fef9c3; color: #a16207; font-size: 1rem; font-weight: 800; cursor: pointer; transition: 0.2s;">Good<br><span style="font-size:0.75rem; font-weight:600;">Got it right</span></button>
      <button onclick="gradeSrsCard(5)" style="flex: 1; padding: 16px; border-radius: 16px; border: none; background: #dcfce7; color: #15803d; font-size: 1rem; font-weight: 800; cursor: pointer; transition: 0.2s;">Easy<br><span style="font-size:0.75rem; font-weight:600;">Too simple</span></button>
    </div>
  `;
}

window.flipSrsCard = function() {
  document.getElementById("srsCardInner").style.transform = "rotateY(180deg)";
  document.getElementById("srsControls").style.display = "flex";
  BuddyVoice.speak(`${currentSrsWord.word}. ${currentSrsWord.definition}`, "English");
};

window.gradeSrsCard = function(quality) {
  let srs = currentSrsWord.srs;
  
  if (quality < 3) {
    srs.repetition = 0; srs.interval = 1;
  } else {
    if (srs.repetition === 0) srs.interval = 1;
    else if (srs.repetition === 1) srs.interval = 6;
    else srs.interval = Math.round(srs.interval * srs.easeFactor);
    srs.repetition++;
  }
  
  srs.easeFactor = srs.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (srs.easeFactor < 1.3) srs.easeFactor = 1.3;
  srs.nextReview = Date.now() + (srs.interval * 24 * 60 * 60 * 1000);
  
  const words = upgradeWordBankToSRS();
  const index = words.findIndex(w => w.word === currentSrsWord.word);
  if (index !== -1) { words[index] = currentSrsWord; saveWordBank(words); }
  
  srsQueue.shift();
  renderSrsCard();
};

// ════════════════════════════════════════════════════════════════════
//  LIGHTNING ROUND GAME (WITH OFFLINE FALLBACK)
// ════════════════════════════════════════════════════════════════════

let lightningQuestions = [];
let lightningIndex = 0;
let lightningScore = 0;
let lightningTime = 60;
let lightningTimerInterval = null;

const FALLBACK_LIGHTNING_POOL = [
  { question: "Which word is an adjective?", options: ["Quickly", "Beautiful", "Run", "Happiness"], answer: "Beautiful" },
  { question: "Choose the correct past tense of 'Eat':", options: ["Eated", "Ate", "Eating", "Eaten"], answer: "Ate" },
  { question: "Which sentence is punctuated correctly?", options: ["where are you going.", "Where are you going?", "Where are you going!", "where are you going?"], answer: "Where are you going?" },
  { question: "What is the opposite of 'Ancient'?", options: ["Old", "Modern", "Heavy", "Broken"], answer: "Modern" },
  { question: "Fill in the blank: She _____ to school every morning.", options: ["walk", "walks", "walking", "walked"], answer: "walks" },
  { question: "Which is a noun?", options: ["Elephant", "Sing", "Loudly", "Bright"], answer: "Elephant" },
  { question: "Choose the correct plural form of 'Child':", options: ["Childs", "Children", "Childrens", "Childes"], answer: "Children" }
];

window.openLightningModal = function() {
  const modal = document.getElementById("lightningModal");
  if (!modal) return;
  modal.style.display = "flex";
  modal.style.pointerEvents = "all"; 
  void modal.offsetWidth;
  modal.style.opacity = "1";
  
  const header = document.getElementById("lightningHeader");
  if (header) header.style.display = "none";
  
  const playArea = document.getElementById("lightningPlayArea");
  if (playArea) {
    playArea.innerHTML = `
      <h2 style="font-family: var(--font-family); font-size: 2.6rem; font-weight: 800; letter-spacing: -0.03em; color: #422006; margin-bottom: 10px;">Lightning Round</h2>
      <p style="font-size: 1.1rem; color: #713f12; margin-bottom: 32px;">Answer 5 questions before the clock runs out to earn the Lightning Badge!</p>
      <div class="ai-loading-state" id="lightningLoading" style="display:none; padding: 20px;">
        <div class="spinner" style="border-top-color: #713f12; margin: 0 auto;"></div>
        <p style="color: #713f12; font-weight: 700; margin-top: 16px;">Generating your challenge...</p>
      </div>
      <button id="lightningStartBtn" style="min-height: 60px; padding: 0 40px; border-radius: 20px; border: none; background: #713f12; color: #fef08a; font-family: var(--font-family); font-size: 1.25rem; font-weight: 800; cursor: pointer; box-shadow: 0 8px 20px rgba(113, 63, 18, 0.4); transition: transform 0.1s;">⚡ Start Now</button>
    `;
    const startBtn = document.getElementById("lightningStartBtn");
    if (startBtn) startBtn.addEventListener("click", window.beginLightningGame);
  }
};

window.closeLightningModal = function() {
  const modal = document.getElementById("lightningModal");
  if (modal) {
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none"; 
    setTimeout(() => { modal.style.display = "none"; }, 250);
  }
  if (lightningTimerInterval) clearInterval(lightningTimerInterval);
};

window.beginLightningGame = async function() {
  const startBtn = document.getElementById("lightningStartBtn");
  const loading = document.getElementById("lightningLoading");
  if (startBtn) startBtn.style.display = "none";
  if (loading) loading.style.display = "block";
  
  try {
    const fetchPromise = apiFetch("/api/ai/lightning-round", {
      method: "POST", body: JSON.stringify({})
    });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500));
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (res && res.quiz && res.quiz.length >= 5) lightningQuestions = res.quiz.slice(0, 5);
    else throw new Error("Invalid response");
  } catch(err) {
    lightningQuestions = [...FALLBACK_LIGHTNING_POOL].sort(() => 0.5 - Math.random()).slice(0, 5);
  }

  lightningIndex = 0; lightningScore = 0; lightningTime = 60;
  
  const header = document.getElementById("lightningHeader");
  if (header) header.style.display = "flex";
  updateLightningHeader();
  
  if (lightningTimerInterval) clearInterval(lightningTimerInterval);
  lightningTimerInterval = setInterval(() => {
    lightningTime--; updateLightningHeader();
    if (lightningTime <= 0) endLightningGame("timeout");
  }, 1000);
  
  renderLightningQuestion();
};

function updateLightningHeader() {
  const scoreEl = document.getElementById("lightningScore");
  const timeEl = document.getElementById("lightningTimer");
  if (scoreEl) scoreEl.textContent = lightningScore;
  if (timeEl) {
    timeEl.textContent = lightningTime;
    timeEl.style.color = lightningTime <= 10 ? "#dc2626" : "inherit";
  }
}

function renderLightningQuestion() {
  if (lightningIndex >= lightningQuestions.length) { endLightningGame("complete"); return; }
  
  const q = lightningQuestions[lightningIndex];
  const playArea = document.getElementById("lightningPlayArea");
  if (!playArea) return;
  
  playArea.innerHTML = `
    <div style="animation: fadeViewIn 0.2s ease forwards;">
      <p style="font-size: 0.9rem; font-weight: 800; color: #a16207; text-transform: uppercase; margin-bottom: 12px;">Question ${lightningIndex + 1} of 5</p>
      <h3 style="font-size: 1.5rem; color: #422006; margin-bottom: 24px; line-height: 1.4;">${escapeHtml(q.question)}</h3>
      <div id="lightningOptionsBox"></div>
    </div>
  `;

  const optionsBox = document.getElementById("lightningOptionsBox");
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "lightning-opt-btn";
    btn.style.cssText = "width:100%; text-align:left; padding:16px 20px; border-radius:16px; border:2px solid rgba(113,63,18,0.2); background:rgba(255,255,255,0.6); color:#422006; font-size:1.1rem; font-weight:600; cursor:pointer; transition:all 0.2s; margin-bottom:10px;";
    btn.textContent = opt;
    btn.onclick = () => handleLightningAnswer(btn, opt, q.answer);
    optionsBox.appendChild(btn);
  });
}

function handleLightningAnswer(btnEl, selectedText, correctText) {
  const buttons = document.querySelectorAll(".lightning-opt-btn");
  buttons.forEach(b => b.disabled = true);
  
  const isCorrect = selectedText.trim().toLowerCase() === correctText.trim().toLowerCase();
  
  if (isCorrect) {
    btnEl.style.background = "#22c55e"; btnEl.style.borderColor = "#16a34a"; btnEl.style.color = "white";
    lightningScore++;
  } else {
    btnEl.style.background = "#ef4444"; btnEl.style.borderColor = "#dc2626"; btnEl.style.color = "white";
    buttons.forEach(b => {
      if (b.textContent.trim().toLowerCase() === correctText.trim().toLowerCase()) {
        b.style.border = "2px solid #22c55e"; b.style.background = "rgba(34, 197, 94, 0.1)";
      }
    });
  }
  
  updateLightningHeader();
  setTimeout(() => { lightningIndex++; renderLightningQuestion(); }, 1000);
}

function endLightningGame(reason) {
  if (lightningTimerInterval) clearInterval(lightningTimerInterval);
  const header = document.getElementById("lightningHeader");
  if (header) header.style.display = "none";
  
  const playArea = document.getElementById("lightningPlayArea");
  if (!playArea) return;
  
  let title = ""; let msg = ""; let icon = "";
  
  if (reason === "timeout") {
    icon = "⏰"; title = "Time's Up!"; msg = `You scored ${lightningScore} out of 5. Try again to beat the clock!`;
  } else {
    if (lightningScore >= 4) {
      icon = "⚡"; title = "Lightning Fast!"; msg = `Incredible! You scored ${lightningScore}/5 and earned the Lightning Fast achievement!`;
      const studentId = studentProfile?.id || student?.id || "guest";
      localStorage.setItem(`lightningBadge_${studentId}`, "true");
      setTimeout(() => { const streak = studentProfile?.streak_days || student?.streak_days || 0; evaluateAchievements(1, 10, streak); }, 500);
    } else {
      icon = "👍"; title = "Good Effort!"; msg = `You scored ${lightningScore}/5. Get 4 or 5 correct to unlock the badge!`;
    }
  }
  
  playArea.innerHTML = `
    <div style="font-size: 4rem; margin-bottom: 16px;">${icon}</div>
    <h2 style="font-family: var(--font-family); font-size: 2.4rem; font-weight: 800; letter-spacing: -0.025em; color: #422006; margin-bottom: 12px;">${title}</h2>
    <p style="font-size: 1.15rem; color: #713f12; margin-bottom: 32px;">${msg}</p>
    <button onclick="closeLightningModal()" style="min-height: 56px; padding: 0 32px; border-radius: 999px; border: none; background: #713f12; color: #fef08a; font-family: var(--font-family); font-size: 1.1rem; font-weight: 800; cursor: pointer; transition: transform 0.2s;">Close & Return</button>
  `;
}

