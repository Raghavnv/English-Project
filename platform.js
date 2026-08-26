// ===== LOGIN CHECK =====
const student = getStudentData();

if (!student) { 
  window.location.href = "login.html"; 
}

const token = getStudentToken();

if (!token) { 
  window.location.href = "login.html"; 
}

// Set up UI with student data
const headerSpan = document.getElementById("headerStudentName");

if (headerSpan) {
  headerSpan.textContent = student.name;
}

const welcomeTitle = document.getElementById("welcomeTitle");

if (welcomeTitle) {
  welcomeTitle.textContent = "Welcome, " + student.name.split(" ")[0] + "!";
}

let allClasses = [];
let studentProgress = {};

function doLogout() {
  clearStudentToken();
  localStorage.removeItem("student");
  window.location.href = "login.html";
}

// ── TAB SWITCHING ──
function switchTab(tabId) {
  const isLessons = tabId === "lessons";
  const isPractice = tabId === "practice";

  const tabLessons = document.getElementById("tabLessons");
  const tabPractice = document.getElementById("tabPractice");

  if (tabLessons) {
    tabLessons.classList.toggle("active", isLessons);
  }

  if (tabPractice) {
    tabPractice.classList.toggle("active", isPractice);
  }

  const panelLessons = document.getElementById("panelLessons");
  const panelPractice = document.getElementById("panelPractice");

  if (panelLessons) {
    panelLessons.classList.toggle("active", isLessons);
  }

  if (panelPractice) {
    panelPractice.classList.toggle("active", isPractice);
  }
}

// ── DATA LOADING ──
async function loadDashboardData() {
  try {
    const [classesRes, progressRes] = await Promise.all([
      Lessons.getClasses(),
      Students.getProgress(student.id).catch(() => ({}))
    ]);

    allClasses = classesRes || [];
    studentProgress = progressRes || {};

    renderLessonsTab();
    renderPracticeTab();

  } catch (err) {
    const container = document.getElementById("lessonsContainer");
    
    if (container) {
      container.innerHTML = `<div style="padding: 40px; text-align: center; color: #b91c1c;">Error loading your lessons: ${err.message}</div>`;
    }
  }
}

function escapeHtml(str) {
  if (!str) {
    return "";
  }
  
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── RENDER TAB 1: MY LESSONS ──
function renderLessonsTab() {
  const container = document.getElementById("lessonsContainer");
  
  if (!container) {
    return;
  }
  
  container.innerHTML = "";

  if (allClasses.length === 0) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted);">No lessons have been assigned yet. Check back soon!</div>`;
    return;
  }

  allClasses.forEach(cls => {
    if (!cls.lessons || cls.lessons.length === 0) {
      return;
    }

    const section = document.createElement("div");
    section.className = "class-section";
    
    const title = document.createElement("h2");
    title.textContent = cls.label;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "lesson-grid";

    cls.lessons.forEach(lesson => {
      const prog = studentProgress[lesson.id] || { completed: false, answered_count: 0 };
      const totalQ = lesson.questions ? lesson.questions.length : 0;
      
      let statusClass = "status-new";
      let statusText = "New Lesson";
      let btnText = "Start Lesson →";
      
      if (prog.completed) {
        statusClass = "status-completed";
        statusText = "✓ Completed";
        btnText = "Review Answers";
      } else if (prog.answered_count > 0) {
        statusClass = "status-progress";
        statusText = `In Progress (${prog.answered_count}/${totalQ})`;
        btnText = "Continue Lesson →";
      }

      const card = document.createElement("div");
      card.className = "lesson-card";
      card.innerHTML = `
        <span class="lesson-status ${statusClass}">${statusText}</span>
        <h3 class="lesson-card-title">${escapeHtml(lesson.title)}</h3>
        <p class="lesson-card-desc">${escapeHtml(lesson.description || "No description provided.")}</p>
        <button class="lesson-action-btn">${btnText}</button>
      `;

      card.querySelector(".lesson-action-btn").addEventListener("click", () => {
        localStorage.setItem("currentLesson", JSON.stringify({ moduleId: lesson.id }));
        window.location.href = "lesson.html";
      });

      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// ── RENDER TAB 2: PRACTICE HUB ──
function renderPracticeTab() {
  const container = document.getElementById("practiceContainer");
  
  if (!container) {
    return;
  }
  
  container.innerHTML = "";

  const allLessons = allClasses.flatMap(cls => cls.lessons || []);

  if (allLessons.length === 0) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted);">No lessons available for practice yet.</div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "lesson-grid";

  allLessons.forEach(lesson => {
    const card = document.createElement("div");
    card.className = "lesson-card";
    
    const safeId = escapeHtml(lesson.id);
    const safeTitle = escapeHtml(lesson.title).replace(/'/g, "\\'");
    const safeDesc = escapeHtml(lesson.description || "").replace(/'/g, "\\'");

    card.innerHTML = `
      <h3 class="lesson-card-title">${escapeHtml(lesson.title)}</h3>
      <p class="lesson-card-desc">${escapeHtml(lesson.description || "Review this topic.")}</p>
      <div class="practice-actions">
        <button class="practice-btn btn-relearn" onclick="openRelearn('${safeId}', '${safeTitle}', '${safeDesc}')">
          📖 Re-Learn
        </button>
        <button class="practice-btn btn-flashcards" onclick="openFlashcards('${safeTitle}', '${safeDesc}')">
          ✨ Flashcards
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ── MODAL LOGIC ──
function closeModals(e) {
  if (e && e.target.classList && !e.target.classList.contains("modal-overlay")) {
    return;
  }
  
  const modalRelearn = document.getElementById("modalRelearn");
  const modalFlashcards = document.getElementById("modalFlashcards");
  
  if (modalRelearn) {
    modalRelearn.classList.remove("show");
  }
  
  if (modalFlashcards) {
    modalFlashcards.classList.remove("show");
  }
  
  setTimeout(() => {
    const relearnArea = document.getElementById("relearnContentArea");
    const flashcardArea = document.getElementById("flashcardContentArea");
    
    if (relearnArea) {
      relearnArea.innerHTML = "";
    }
    
    if (flashcardArea) {
      flashcardArea.innerHTML = "";
    }
  }, 300);
}

// ── RE-LEARN MODAL & API CALL ──
async function openRelearn(lessonId, title, desc) {
  const modal = document.getElementById("modalRelearn");
  const titleEl = document.getElementById("relearnModalTitle");
  const contentArea = document.getElementById("relearnContentArea");

  if (titleEl) {
    titleEl.textContent = title;
  }
  
  if (contentArea) {
    contentArea.innerHTML = `
      <div class="ai-loading-state">
        <div class="spinner blue"></div>
        <p style="color: #7dd3fc; margin: 0; font-weight: 600;">Buddy is writing a quick summary...</p>
      </div>
    `;
  }
  
  if (modal) {
    modal.classList.add("show");
  }

  try {
    const res = await AI.getRelearn(lessonId, title, desc);
    
    if (res && res.content) {
      const sectionIcons = {
        "WHAT YOU WILL LEARN": "📚",
        "KEY CONCEPTS": "🔑",
        "HELPFUL EXAMPLES": "✏️",
        "QUICK TIPS": "💡"
      };

      const lines = res.content.split("\n").map(l => l.trim()).filter(Boolean);
      let html = "";
      let currentSection = null;
      let buffer = [];

      function flushSection() {
        if (!currentSection || !buffer.length) {
          return;
        }
        
        const icon = sectionIcons[currentSection] || "📌";
        html += `<div class="rl-section">`;
        html += `<div class="rl-header">${icon} ${currentSection}</div>`;

        if (currentSection === "HELPFUL EXAMPLES") {
          buffer.forEach(line => {
            const clean = line.replace(/^[-•*]\s*/, "").replace(/^[""'](.+)[""']$/, "$1");
            html += `<div class="rl-example">"${escapeHtml(clean.replace(/^"|"$/g, ""))}"</div>`;
          });
        } else {
          html += `<ul>`;
          buffer.forEach(line => {
            const clean = line.replace(/^[-•*]\s*/, "");
            html += `<li>${escapeHtml(clean)}</li>`;
          });
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
          if (clean.length > 2) {
            buffer.push(clean);
          }
        } else {
          html += `<p style="color:rgba(147,197,253,0.9); margin-bottom:12px;">${escapeHtml(line)}</p>`;
        }
      });
      
      flushSection();

      if (!matchedAny && !html) {
        html = `<div style="color:#cbd5e1; font-size:0.95rem; line-height:1.8;">${escapeHtml(res.content).replace(/\n/g, '<br>')}</div>`;
      }

      if (contentArea) {
        contentArea.innerHTML = `<div class="relearn-content">${html}</div>`;
      }
    } else {
      throw new Error("Received empty response from AI");
    }
  } catch (err) {
    if (contentArea) {
      contentArea.innerHTML = `<div style="color: #fca5a5; text-align: center; padding: 20px;">Could not generate recap: ${escapeHtml(err.message)}</div>`;
    }
  }
}

// ── FLASHCARDS MODAL & API CALL ──
async function openFlashcards(title, desc) {
  const modal = document.getElementById("modalFlashcards");
  const titleEl = document.getElementById("flashcardModalTitle");
  const contentArea = document.getElementById("flashcardContentArea");

  if (titleEl) {
    titleEl.textContent = title + " Deck";
  }
  
  if (contentArea) {
    contentArea.innerHTML = `
      <div class="ai-loading-state" style="grid-column: 1 / -1;">
        <div class="spinner purple"></div>
        <p style="color: #6d28d9; margin: 0; font-weight: 600;">Generating smart flashcards...</p>
      </div>
    `;
  }
  
  if (modal) {
    modal.classList.add("show");
  }

  try {
    const res = await AI.generateFlashcards(title, desc, 6);
    const cards = res.flashcards || [];

    if (cards.length === 0) {
      throw new Error("AI did not return any cards.");
    }

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

  } catch (err) {
    if (contentArea) {
      contentArea.innerHTML = `<div style="color: #dc2626; text-align: center; padding: 20px; grid-column: 1 / -1;">Error creating deck: ${escapeHtml(err.message)}</div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", loadDashboardData);