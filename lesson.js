// ===== LOGIN CHECK =====
const student = getStudentData();
if (!student) { window.location.href = "login.html"; }

const currentLesson = JSON.parse(localStorage.getItem("currentLesson"));
if (!currentLesson) { window.location.href = "platform.html"; }

let module      = null;
let progressId  = null;
let answers     = {};
let lessonTitle = "";

async function init() {
  try {
    const lesson = await Lessons.getOne(currentLesson.moduleId);
    module      = lesson;
    lessonTitle = lesson.title;

    const headerSpan = document.querySelector(".platform-brand-copy span");
    if (headerSpan) headerSpan.textContent = student.name + " · " + (lesson.class_label || "Lesson");

    document.getElementById("lessonTitle").innerText       = lesson.title;
    document.getElementById("lessonDescription").innerText = lesson.description || "";

    let savedProgress = {};
    try {
      const allProgress = await Students.getProgress(student.id);
      savedProgress = allProgress[lesson.id] || {};
      answers = { ...savedProgress.answers };
      Object.keys(answers).forEach(qid => {
        if (typeof answers[qid] === "object") answers[qid] = answers[qid].text || "";
      });
    } catch {}

    renderQuestions(lesson, savedProgress);
    initBuddy();
    initRelearn(lesson);

  } catch (err) {
    document.getElementById("questionStack").innerHTML =
      `<p class="empty-state">Could not load lesson: ${err.message}</p>`;
  }
}

// ===== RENDER QUESTIONS =====
function renderQuestions(lesson, savedProgress) {
  const stack = document.getElementById("questionStack");
  stack.innerHTML = "";

  if (!lesson.questions || lesson.questions.length === 0) {
    stack.innerHTML = `<p class="empty-state">No questions have been added to this lesson yet.</p>`;
    return;
  }

  const total      = lesson.questions.length;
  const isComplete = savedProgress.completed || false;

  // Progress banner
  const progressBanner = document.createElement("div");
  progressBanner.className = "lesson-progress-banner";
  progressBanner.id = "progressBanner";
  progressBanner.innerHTML = `
    <div class="lesson-progress-label">
      <span id="progressText">0 of ${total} answered</span>
      <span id="progressPct">0%</span>
    </div>
    <div class="lesson-mini-bar">
      <div class="lesson-mini-fill" id="progressFill" style="width:0%"></div>
    </div>
  `;
  stack.appendChild(progressBanner);

  const autosaveEl = document.createElement("p");
  autosaveEl.id = "autosaveIndicator";
  autosaveEl.style.cssText = "font-size:0.76rem;color:var(--muted);text-align:right;margin:0;height:16px;transition:opacity 0.3s ease;opacity:0;";
  autosaveEl.textContent = "✓ Autosaved";
  stack.appendChild(autosaveEl);

  lesson.questions.forEach((q, i) => {
    const isSpeech  = q.type === "speech";
    const card      = document.createElement("div");
    const savedAnswer = answers[q.id] || "";

    // ── TYPE BADGE ──
    const typeBadge = isSpeech
      ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:999px;background:rgba(111,124,74,0.14);color:#3a5018;font-weight:800;letter-spacing:0.03em;">🎤 Speak Your Answer</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:999px;background:rgba(188,93,45,0.1);color:var(--accent-deep);font-weight:800;letter-spacing:0.03em;">✏️ Written Answer</span>`;

    card.className = "question-card" + (isSpeech ? " speech-card" : "");

    if (isSpeech) {
      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h4 style="font-size:0.75rem;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:#3a5018;margin:0;">Question ${i + 1}</h4>
            ${typeBadge}
          </div>
          <button class="q-hint-btn" data-qid="${q.id}">💡 Hint</button>
        </div>
        <p class="q-prompt" style="color:var(--text);line-height:1.75;font-size:1rem;margin-bottom:14px;">${q.prompt}</p>
        <div class="hint-bubble" id="hint_${q.id}" style="display:none;"></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">
          <button class="speech-record-btn" id="recBtn_${q.id}" data-qid="${q.id}" onclick="toggleSpeechRecord('${q.id}')">🎤 Start Speaking</button>
          <button style="min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(111,124,74,0.25);background:rgba(255,255,255,0.6);color:#3a5018;font-size:0.8rem;font-weight:700;cursor:pointer;" onclick="clearSpeech('${q.id}')">Clear</button>
        </div>
        <div class="speech-status" id="speechStatus_${q.id}"></div>
        <div class="speech-transcript-box" id="transcript_${q.id}" data-qid="${q.id}">${savedAnswer || '<span style="color:var(--muted);font-style:italic;">Your spoken answer will appear here…</span>'}</div>
        <div class="feedback-area" id="feedback_${q.id}" style="margin-top:10px;"></div>
        <div style="margin-top:10px;">
          <button class="check-btn" data-qid="${q.id}" style="display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 14px;border-radius:999px;border:1px solid rgba(111,124,74,0.25);background:rgba(111,124,74,0.1);color:#3a5018;font-size:0.82rem;font-weight:700;cursor:pointer;">✨ Check with AI</button>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h4 style="font-size:0.75rem;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent-deep);margin:0;">Question ${i + 1}</h4>
            ${typeBadge}
          </div>
          <button class="q-hint-btn" data-qid="${q.id}">💡 Hint</button>
        </div>
        <p class="q-prompt" style="color:var(--text);line-height:1.75;font-size:1rem;margin-bottom:12px;">${q.prompt}</p>
        <div class="hint-bubble" id="hint_${q.id}" style="display:none;"></div>
        <div style="position:relative;">
          <textarea class="q-answer" data-qid="${q.id}" placeholder="Type your answer here…" rows="3" style="padding-right:44px;">${savedAnswer}</textarea>
          <button class="q-mic-btn" data-qid="${q.id}" title="Speak your answer"
            style="position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(80,58,40,0.15);background:rgba(255,255,255,0.8);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">🎤</button>
        </div>
        <div class="feedback-area" id="feedback_${q.id}" style="margin-top:10px;"></div>
        <div style="margin-top:10px;">
          <button class="check-btn" data-qid="${q.id}" style="display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 14px;border-radius:999px;border:1px solid rgba(188,93,45,0.2);background:rgba(188,93,45,0.07);color:var(--accent-deep);font-size:0.82rem;font-weight:700;cursor:pointer;">✨ Check with AI</button>
        </div>
      `;
    }

    stack.appendChild(card);
  });

  // Save button
  const doneBtn = document.createElement("button");
  doneBtn.className = "primary-action lesson-go-btn";
  doneBtn.id = "doneBtn";
  doneBtn.textContent = "Save Answers";
  stack.appendChild(doneBtn);

  const completionMsg = document.createElement("p");
  completionMsg.id = "completionMsg";
  completionMsg.style.cssText = "display:none;padding:14px 16px;border-radius:12px;background:rgba(111,124,74,0.1);border:1px solid rgba(111,124,74,0.2);color:#3a5018;font-weight:700;font-size:0.92rem;text-align:center;";
  completionMsg.textContent = "✓ Lesson completed! Great work.";
  stack.appendChild(completionMsg);

  // ── PROGRESS — wait for meaningful answer length (min 8 chars) ──
  const MIN_ANSWER_LENGTH = 8;

  function updateProgress() {
    let answered = 0;
    lesson.questions.forEach(q => {
      if (q.type === "speech") {
        const t = document.getElementById(`transcript_${q.id}`);
        const text = t ? (t.dataset.transcript || "") : "";
        if (text.trim().length >= MIN_ANSWER_LENGTH) answered++;
      } else {
        const ta = stack.querySelector(`.q-answer[data-qid="${q.id}"]`);
        const val = ta ? ta.value.trim() : "";
        answers[q.id] = val;
        if (val.length >= MIN_ANSWER_LENGTH) answered++;
      }
    });
    const pct = Math.round((answered / total) * 100);
    document.getElementById("progressText").textContent = `${answered} of ${total} answered`;
    document.getElementById("progressPct").textContent  = pct + "%";
    document.getElementById("progressFill").style.width = pct + "%";
    return answered;
  }

  let autosaveTimer = null;
  function triggerAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      updateProgress();
      try {
        await Students.saveProgress(student.id, lesson.id, answers);
        const ind = document.getElementById("autosaveIndicator");
        if (ind) { ind.style.opacity = "1"; setTimeout(() => ind.style.opacity = "0", 1800); }
      } catch {}
    }, 1400);
  }

  stack.querySelectorAll(".q-answer").forEach(ta => {
    ta.addEventListener("input", () => { updateProgress(); triggerAutosave(); });
  });

  // Mic buttons for text questions
  stack.querySelectorAll(".q-mic-btn").forEach(micBtn => {
    const qid = micBtn.dataset.qid;
    const ta  = stack.querySelector(`.q-answer[data-qid="${qid}"]`);
    micBtn.addEventListener("click", () => {
      if (Speech.isListening) {
        Speech.stop(); micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; return;
      }
      if (!Speech.isSupported()) { alert("Voice input requires Chrome."); return; }
      micBtn.textContent = "⏹"; micBtn.style.background = "rgba(220,50,50,0.12)";
      Speech.start(
        (transcript) => { ta.value += (ta.value ? " " : "") + transcript; updateProgress(); triggerAutosave(); },
        () => { micBtn.textContent = "🎤"; micBtn.style.background = "rgba(255,255,255,0.8)"; }
      );
    });
  });

  // AI Check buttons
  stack.querySelectorAll(".check-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const qid      = btn.dataset.qid;
      const q        = lesson.questions.find(x => x.id === qid);
      const isSpeech = q && q.type === "speech";
      let answerText = "";

      if (isSpeech) {
        const t = document.getElementById(`transcript_${qid}`);
        answerText = (t && t.dataset.transcript) ? t.dataset.transcript : "";
      } else {
        const ta = stack.querySelector(`.q-answer[data-qid="${qid}"]`);
        answerText = ta ? ta.value.trim() : "";
      }

      const feedbackEl = document.getElementById(`feedback_${qid}`);
      if (!answerText.trim()) {
        feedbackEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">${isSpeech ? "Please record something first!" : "Please write something first!"}</span>`;
        return;
      }

      btn.textContent = "Checking…";
      btn.disabled = true;
      feedbackEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Thinking…</span>`;

      try {
        const res     = await AI.getFeedback(qid, answerText, progressId);
        const isGood  = /good|great|well|correct|nice|excel|perfect|spot.on/i.test(res.feedback);
        feedbackEl.innerHTML = `
          <div style="padding:11px 14px;border-radius:12px;font-size:0.88rem;line-height:1.65;
            background:${isGood ? "rgba(111,124,74,0.1)" : "rgba(188,93,45,0.07)"};
            border:1px solid ${isGood ? "rgba(111,124,74,0.22)" : "rgba(188,93,45,0.18)"};
            color:${isGood ? "#3a5018" : "var(--accent-deep)"};">
            ${isGood ? "✅" : "💬"} ${formatAIText(res.feedback)}
          </div>`;
      } catch (err) {
        feedbackEl.innerHTML = `<span style="color:var(--muted);font-size:0.85rem;">Could not get feedback: ${err.message}</span>`;
      } finally {
        btn.textContent = "✨ Check with AI";
        btn.disabled = false;
      }
    });
  });

  // Hint buttons
  stack.querySelectorAll(".q-hint-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const qid     = btn.dataset.qid;
      const hintEl  = document.getElementById(`hint_${qid}`);
      if (hintEl.style.display !== "none") {
        hintEl.style.display = "none"; btn.textContent = "💡 Hint"; return;
      }
      btn.textContent = "…";
      hintEl.style.display = "";
      hintEl.textContent = "Getting hint…";
      try {
        const res = await AI.getHint(qid, lessonTitle);
        hintEl.innerHTML = `<strong>💡 Hint</strong>${formatAIText(res.hint)}`;
        btn.textContent = "✕ Hide";
      } catch {
        hintEl.textContent = "Could not load hint.";
        btn.textContent = "💡 Hint";
      }
    });
  });

  // Save button
  doneBtn.addEventListener("click", async () => {
    clearTimeout(autosaveTimer);
    lesson.questions.forEach(q => {
      if (q.type === "speech") {
        const t = document.getElementById(`transcript_${q.id}`);
        if (t && t.dataset.transcript) answers[q.id] = t.dataset.transcript;
      }
    });
    updateProgress();
    doneBtn.textContent = "Saving…";
    doneBtn.disabled = true;
    try {
      const result = await Students.saveProgress(student.id, lesson.id, answers);
      if (result.completed) {
        completionMsg.style.display = "block";
        doneBtn.textContent = "✓ All Done!";
      } else {
        doneBtn.textContent = "✓ Progress Saved";
        setTimeout(() => { doneBtn.textContent = "Save Answers"; doneBtn.disabled = false; }, 1500);
      }
    } catch (err) {
      doneBtn.textContent = "Error — Try Again";
      doneBtn.disabled = false;
    }
  });

  updateProgress();
  if (isComplete) {
    doneBtn.textContent = "✓ Already Completed";
    doneBtn.disabled = true;
    completionMsg.style.display = "block";
  }
}

// ===== SPEECH QUESTION RECORDING =====
let activeSpeechQid  = null;
let speechRecognition = null;

function toggleSpeechRecord(qid) {
  if (activeSpeechQid === qid) stopSpeechRecord(qid);
  else { if (activeSpeechQid) stopSpeechRecord(activeSpeechQid); startSpeechRecord(qid); }
}

function startSpeechRecord(qid) {
  if (!Speech.isSupported()) { setSpeechStatus(qid, "❌ Voice input requires Chrome."); return; }

  const btn          = document.getElementById(`recBtn_${qid}`);
  const transcriptEl = document.getElementById(`transcript_${qid}`);
  activeSpeechQid    = qid;

  btn.classList.add("recording");
  btn.innerHTML = "⏹ Stop Recording";
  setSpeechStatus(qid, "🔴 Listening… speak clearly");

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  speechRecognition = new SR();
  speechRecognition.lang = "en-IN";
  speechRecognition.interimResults = true;
  speechRecognition.continuous = true;

  let finalTranscript = transcriptEl.dataset.transcript || "";

  speechRecognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript ? " " : "") + t;
        transcriptEl.dataset.transcript = finalTranscript;
        answers[qid] = finalTranscript;
      } else { interim += t; }
    }
    transcriptEl.innerHTML = finalTranscript
      ? `${finalTranscript}<span style="color:var(--muted);font-style:italic;"> ${interim}</span>`
      : `<span style="color:var(--muted);font-style:italic;">${interim || "Listening…"}</span>`;
  };

  speechRecognition.onerror = (e) => {
    if (e.error !== "no-speech") setSpeechStatus(qid, `⚠️ Error: ${e.error}`);
  };

  speechRecognition.onend = () => {
    if (activeSpeechQid === qid) try { speechRecognition.start(); } catch {}
  };

  speechRecognition.start();
}

function stopSpeechRecord(qid) {
  activeSpeechQid = null;
  if (speechRecognition) { speechRecognition.onend = null; speechRecognition.stop(); speechRecognition = null; }
  const btn          = document.getElementById(`recBtn_${qid}`);
  const transcriptEl = document.getElementById(`transcript_${qid}`);
  if (btn) { btn.classList.remove("recording"); btn.innerHTML = "🎤 Start Speaking"; }
  const finalText = transcriptEl ? (transcriptEl.dataset.transcript || "") : "";
  if (finalText.trim()) {
    setSpeechStatus(qid, "✅ Recorded! You can check it with AI below.");
    if (transcriptEl) transcriptEl.innerHTML = finalText;
    answers[qid] = finalText;
  } else {
    setSpeechStatus(qid, "No speech detected. Try again.");
  }
}

function clearSpeech(qid) {
  if (activeSpeechQid === qid) stopSpeechRecord(qid);
  const t = document.getElementById(`transcript_${qid}`);
  if (t) { t.dataset.transcript = ""; t.innerHTML = '<span style="color:var(--muted);font-style:italic;">Your spoken answer will appear here…</span>'; }
  answers[qid] = "";
  setSpeechStatus(qid, "");
}

function setSpeechStatus(qid, msg) {
  const el = document.getElementById(`speechStatus_${qid}`);
  if (el) el.textContent = msg;
}

// ===== RE-LEARN WITH AI =====
let relearnLoaded = false;
let relearnOpen   = false;
let currentLesson_module = null;

function initRelearn(lesson) {
  currentLesson_module = lesson;
  const section = document.getElementById("relearnSection");
  if (section) section.style.display = "";
}

async function toggleRelearn() {
  const body      = document.getElementById("relearnBody");
  const btn       = document.getElementById("relearnToggleBtn");
  const contentEl = document.getElementById("relearnContent");

  if (relearnOpen) {
    // Collapse
    body.classList.remove("open");
    btn.textContent = "✨ Start Re-Learning";
    relearnOpen = false;
    return;
  }

  // Expand
  relearnOpen = true;
  body.classList.add("open");
  btn.textContent = "✕ Close";

  if (relearnLoaded) return; // already fetched

  // Show loading state
  contentEl.innerHTML = `<div class="relearn-loading"><div class="rl-spinner"></div> Preparing your lesson recap…</div>`;

  try {
    btn.classList.add("loading");
    const res = await AI.getRelearn(
      currentLesson_module?.id || "",
      currentLesson_module?.title || lessonTitle,
      currentLesson_module?.description || ""
    );
    relearnLoaded = true;
    renderRelearnContent(res.content, contentEl);
  } catch (err) {
    contentEl.innerHTML = `<p style="color:rgba(147,197,253,0.6);font-size:0.88rem;">Could not load lesson recap. Please try again.</p>`;
  } finally {
    btn.classList.remove("loading");
  }
}

function renderRelearnContent(text, el) {
  // Parse the AI response into styled sections
  const sectionIcons = {
    "WHAT YOU WILL LEARN": "📚",
    "KEY CONCEPTS": "🔑",
    "HELPFUL EXAMPLES": "✏️",
    "QUICK TIPS": "💡"
  };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let html = "";
  let currentSection = null;
  let buffer = [];

  function flushSection() {
    if (!currentSection || !buffer.length) return;
    const icon = sectionIcons[currentSection] || "📌";
    html += `<div class="rl-section">`;
    html += `<div class="rl-header">${icon} ${currentSection}</div>`;

    if (currentSection === "HELPFUL EXAMPLES") {
      buffer.forEach(line => {
        const clean = line.replace(/^[-•*]\s*/, "").replace(/^["""](.+)["""]$/, "$1");
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

  lines.forEach(line => {
    const upperLine = line.toUpperCase().replace(/[📚🔑✏️💡]/gu, "").trim();
    const matchedSection = Object.keys(sectionIcons).find(k => upperLine.includes(k));
    if (matchedSection) {
      flushSection();
      currentSection = matchedSection;
    } else if (currentSection) {
      // Only add non-empty, non-header lines as content
      const clean = line.replace(/^[-•*\d.]\s*/, "").trim();
      if (clean.length > 3) buffer.push(clean);
    }
  });
  flushSection();

  el.innerHTML = html || `<p style="color:rgba(147,197,253,0.7);">${escapeHtml(text)}</p>`;
}

// ===== BUDDY CHAT =====
let buddyHistory = [];

function initBuddy() {
  const welcomes = [
    `Hi${student?.name ? " " + student.name.split(" ")[0] : ""}! 👋 I'm Buddy, your AI English tutor. Ask me anything about this lesson or English in general!`,
    `Hello! 😊 I'm Buddy — here to help you with "${lessonTitle}". Ask me questions, ask for hints, or just say hi!`,
    `Welcome! 🌟 Stuck on a question? Just ask me for a hint or explanation. I'm always here!`,
  ];
  const msg = welcomes[Math.floor(Math.random() * welcomes.length)];
  appendBuddyMsg("bot", msg);
  buddyHistory.push({ role: "assistant", content: msg });
}

function appendBuddyMsg(role, text) {
  const body = document.getElementById("buddyBody");
  const div  = document.createElement("div");
  div.className = `buddy-msg ${role}`;
  // Bot messages may contain markdown — format them; user messages escape only
  const html = role === "bot" ? formatAIText(text) : escapeHtml(text);
  div.innerHTML = `<div class="buddy-bubble">${html}</div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showBuddyTyping() {
  const body = document.getElementById("buddyBody");
  const el   = document.createElement("div");
  el.className = "buddy-msg bot";
  el.id = "buddyTyping";
  el.innerHTML = `<div class="buddy-typing"><div class="buddy-dot"></div><div class="buddy-dot"></div><div class="buddy-dot"></div></div>`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

function hideBuddyTyping() { const el = document.getElementById("buddyTyping"); if (el) el.remove(); }

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Convert AI markdown responses into clean HTML
function formatAIText(raw) {
  if (!raw) return "";

  // 1. Escape HTML first so user content can't inject tags
  let t = escapeHtml(raw);

  // 2. Bold: **text** or __text__
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // 3. Italic: *text* or _text_
  t = t.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  t = t.replace(/_([^_\n]+?)_/g, "<em>$1</em>");

  // 4. Split into lines for block-level processing
  const lines = t.split(/\r?\n/);
  const out   = [];
  let inList  = false;

  lines.forEach(line => {
    const bullet = line.match(/^[-•*]\s+(.+)/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);
    const trimmed  = line.trim();

    if (bullet || numbered) {
      if (!inList) { out.push('<ul class="ai-list">'); inList = true; }
      out.push(`<li>${bullet ? bullet[1] : numbered[1]}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      if (trimmed === "") {
        // blank line → spacing between paragraphs, skip excess blanks
        if (out.length && out[out.length - 1] !== "") out.push("");
      } else {
        out.push(`<p>${trimmed}</p>`);
      }
    }
  });

  if (inList) out.push("</ul>");

  // Remove consecutive empty strings, collapse to single breaks
  return out.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("");
}

async function sendBuddy() {
  const input = document.getElementById("buddyInput");
  const btn   = document.getElementById("buddySendBtn");
  const text  = input.value.trim();
  if (!text) return;

  input.value = "";
  appendBuddyMsg("user", text);
  buddyHistory.push({ role: "user", content: text });

  btn.disabled = true;
  showBuddyTyping();
  try {
    const res = await AI.chat(buddyHistory, lessonTitle, student?.name || "");
    hideBuddyTyping();
    appendBuddyMsg("bot", res.reply);
    buddyHistory.push({ role: "assistant", content: res.reply });
  } catch {
    hideBuddyTyping();
    appendBuddyMsg("bot", "Sorry, I couldn't respond right now. Try again in a moment!");
  } finally {
    btn.disabled = false;
    // NO input.focus() here — that was causing the page scroll
  }
}

function handleBuddyKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBuddy(); }
}

function goBack() { window.location.href = "platform.html"; }

document.addEventListener("DOMContentLoaded", init);