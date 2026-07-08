// ── Api.js (Top Section) ──
const API_BASE = "https://english-project-l9gy.onrender.com";

// ── TOKEN HELPERS ─────────────────────────────────────────────────────────────
function getAdminToken()  { return localStorage.getItem("adminToken"); }
function setAdminToken(t) { localStorage.setItem("adminToken", t); }
function clearAdminToken(){ localStorage.removeItem("adminToken"); }

function getStudentId()   { return localStorage.getItem("studentId"); }
function setStudentId(id) { localStorage.setItem("studentId", id); }

function getStudentData() {
  try { return JSON.parse(localStorage.getItem("student")) || null; }
  catch { return null; }
}

// ── UPDATED BASE FETCH ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getAdminToken();
  
  const fetchOptions = {
    ...options,
    mode: 'cors', // Explicitly set CORS mode
    headers: { 
      "Content-Type": "application/json", 
      ...(options.headers || {}) 
    }
  };

  if (token) {
    fetchOptions.headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(API_BASE + path, fetchOptions);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    // This helps you identify if the backend server is actually off
    if (err instanceof TypeError) {
      throw new Error("Cannot connect to server. Check if the backend is running at " + API_BASE);
    }
    throw err;
  }
}


// ════════════════════════════════════════════════════════════════════
//  AUTH — ADMIN
// ════════════════════════════════════════════════════════════════════

const Auth = {
  async register(username, password) {
    return apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },

  async login(username, password) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setAdminToken(data.access_token);
    localStorage.setItem("adminSession", JSON.stringify({ username: data.username }));
    return data;
  },

  logout() {
    clearAdminToken();
    localStorage.removeItem("adminSession");
  },

  async me() {
    return apiFetch("/api/auth/me");
  },

  isLoggedIn() {
    return !!getAdminToken();
  }
};


// ════════════════════════════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════════════════════════════

const Students = {
  async login(name, school) {
    const data = await apiFetch("/api/students/login", {
      method: "POST",
      body: JSON.stringify({ name, school })
    });
    setStudentId(data.id);
    localStorage.setItem("student", JSON.stringify({ id: data.id, name: data.name, school: data.school }));
    return data;
  },

  async getProgress(studentId) {
    return apiFetch(`/api/students/${studentId}/progress`);
  },

  async saveProgress(studentId, lessonId, answers) {
    // answers: { [questionId]: "answer text" }
    const answersArray = Object.entries(answers).map(([question_id, text]) => ({
      question_id, text: text || ""
    }));
    return apiFetch(`/api/students/${studentId}/progress`, {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId, answers: answersArray })
    });
  },

  async resetProgress(studentId, lessonIds = []) {
    // lessonIds: array of lesson IDs to reset (all lessons in a class)
    return apiFetch(`/api/students/${studentId}/progress`, {
      method: "DELETE",
      body: JSON.stringify(lessonIds)
    });
  },

  // Admin only
  async list() {
    return apiFetch("/api/students/");
  },

  async delete(studentId) {
    return apiFetch(`/api/students/${studentId}`, { method: "DELETE" });
  }
};


// ════════════════════════════════════════════════════════════════════
//  LESSONS
// ════════════════════════════════════════════════════════════════════

const Lessons = {
  async getAll() {
    return apiFetch("/api/lessons/");
  },

  async getClasses() {
    return apiFetch("/api/lessons/classes");
  },

  async getOne(lessonId) {
    return apiFetch(`/api/lessons/${lessonId}`);
  },

  async create(classLabel, title, description, questions) {
    // questions: [{ prompt, type, order }]
    return apiFetch("/api/lessons/", {
      method: "POST",
      body: JSON.stringify({
        class_label: classLabel,
        title,
        description,
        questions
      })
    });
  },

  async delete(lessonId) {
    return apiFetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
  },

  async addQuestion(lessonId, prompt, type = "text") {
    return apiFetch(`/api/lessons/${lessonId}/questions`, {
      method: "POST",
      body: JSON.stringify({ prompt, type })
    });
  },

  async deleteQuestion(lessonId, questionId) {
    return apiFetch(`/api/lessons/${lessonId}/questions/${questionId}`, {
      method: "DELETE"
    });
  }
};


// ════════════════════════════════════════════════════════════════════
//  AI
// ════════════════════════════════════════════════════════════════════

const AI = {
  async getFeedback(questionId, answerText, progressId = null) {
    return apiFetch("/api/ai/feedback", {
      method: "POST",
      body: JSON.stringify({
        question_id:  questionId,
        answer_text:  answerText,
        progress_id:  progressId
      })
    });
  },

  async getHint(questionId, lessonTitle = "") {
    return apiFetch("/api/ai/hint", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, lesson_title: lessonTitle })
    });
  },

  async getGuide(questionId, lessonTitle = "") {
    return apiFetch("/api/ai/guide", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, lesson_title: lessonTitle })
    });
  },

  async getEncouragement() {
    return apiFetch("/api/ai/encouragement", { method: "POST" });
  },

  async generateQuestions(lessonTitle, lessonDescription, classLabel, count = 5, questionType = "text") {
    return apiFetch("/api/ai/generate-questions", {
      method: "POST",
      body: JSON.stringify({
        lesson_title: lessonTitle,
        lesson_description: lessonDescription,
        class_label: classLabel,
        count,
        question_type: questionType
      })
    });
  },

  async chat(messages, lessonTitle = "", studentName = "") {
    return apiFetch("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages,
        lesson_title: lessonTitle,
        student_name: studentName
      })
    });
  },

  async getRelearn(lessonId, lessonTitle = "", lessonDescription = "") {
    return apiFetch("/api/ai/relearn", {
      method: "POST",
      body: JSON.stringify({
        lesson_id: lessonId,
        lesson_title: lessonTitle,
        lesson_description: lessonDescription
      })
    });
  }
};


// ════════════════════════════════════════════════════════════════════
//  SPEECH — Web Speech API wrapper
// ════════════════════════════════════════════════════════════════════

const Speech = {
  recognition: null,
  isListening: false,

  isSupported() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  },

  start(onResult, onEnd) {
    if (!this.isSupported()) {
      alert("Your browser doesn't support voice input. Try Chrome.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = "en-IN";
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      if (onEnd) onEnd();
      if (event.error !== "no-speech") {
        console.warn("Speech error:", event.error);
      }
    };

    this.recognition.start();
    this.isListening = true;
  },

  stop() {
    if (this.recognition) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
};