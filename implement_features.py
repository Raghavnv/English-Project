import re
import json

def read_file(path):
    with open(path, 'r') as f: return f.read()
def write_file(path, content):
    with open(path, 'w') as f: f.write(content)

# ==========================================
# FEATURE 4: AI ESSAY GRADER (admin.html, lesson.js, ai.py)
# ==========================================

# 1. ADMIN.HTML
admin_html = read_file("admin.html")
if "addQuestion('essay')" not in admin_html:
    admin_html = admin_html.replace(
        '<button class="add-question-btn" onclick="addQuestion(\'speech\')">🎤 Speech</button>',
        '<button class="add-question-btn" onclick="addQuestion(\'speech\')">🎤 Speech</button>\n            <button class="add-question-btn" onclick="addQuestion(\'essay\')">📝 Essay</button>'
    )
    write_file("admin.html", admin_html)
    print("Added Essay button to admin.html")

# 2. LESSON.JS
lesson_js = read_file("lesson.js")
if 'q.type === "essay"' not in lesson_js:
    # Fix the typeBadge
    lesson_js = lesson_js.replace(
        'const typeBadge = isSpeech\n      ? `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;background:#eef2ff;color:#4f46e5;font-size:0.65rem;font-weight:700;letter-spacing:0.04em;">🎤 SPEECH</span>`\n      : "";',
        'const isEssay = q.type === "essay";\n    let typeBadge = "";\n    if (isSpeech) typeBadge = `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;background:#eef2ff;color:#4f46e5;font-size:0.65rem;font-weight:700;letter-spacing:0.04em;">🎤 SPEECH</span>`;\n    else if (isEssay) typeBadge = `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;background:#fdf2f8;color:#db2777;font-size:0.65rem;font-weight:700;letter-spacing:0.04em;">📝 ESSAY</span>`;'
    )
    
    # Fix the textarea for text/essay (which is in the `else` block of `isSpeech`)
    # Original: <textarea class="q-answer" data-qid="${q.id}" placeholder="Type your answer here…" rows="3" style="padding-right:44px;">${savedAnswer}</textarea>
    lesson_js = re.sub(
        r'<textarea class="q-answer" data-qid="\$\{q\.id\}" placeholder="Type your answer here…" rows="3" style="padding-right:44px;">\$\{savedAnswer\}<\/textarea>',
        r'<textarea class="q-answer" data-qid="${q.id}" placeholder="${isEssay ? \'Write your essay or paragraph here (min 3 sentences)…\' : \'Type your answer here…\'}" rows="${isEssay ? 8 : 3}" style="padding-right:44px;">${savedAnswer}</textarea>',
        lesson_js
    )
    write_file("lesson.js", lesson_js)
    print("Updated lesson.js for Essay Grader")

# ==========================================
# FEATURE 3: DYNAMIC WEAKNESS TARGETING
# ==========================================

# 1. AI.PY (Backend Endpoints)
ai_py = read_file("backend/app/routers/ai.py")

if "/analysis/{student_id}/weakness-module" not in ai_py:
    # Inject into ai.py right before AI CONTENT GENERATION (ADMIN)
    injection_marker = "# ── AI CONTENT GENERATION (ADMIN) ──"
    weakness_endpoint = """
@router.post("/analysis/{student_id}/weakness-module")
def generate_weakness_module(student_id: str, db: Session = Depends(get_db)):
    from app.models.models import Progress, Answer
    progresses = db.query(Progress).filter(Progress.student_id == student_id).all()
    
    # Collect poorly scored answers
    weak_answers = []
    for p in progresses:
        for a in p.answers:
            if a.ai_score and a.ai_score < 4 and a.text:
                weak_answers.append({"question": a.question.prompt, "answer": a.text, "feedback": a.ai_feedback})
                
    if not weak_answers:
        return {"error": "Not enough data to identify a weakness! Keep practicing."}
        
    # Analyze and generate mini-lesson
    import json
    prompt = f\"\"\"Based on the following past mistakes from an ESL student:
    {json.dumps(weak_answers[-5:])}
    
    1. Identify their #1 biggest grammatical or structural weakness (e.g., 'Past Tense Verbs' or 'Prepositions').
    2. Generate a personalized 3-flashcard 'Targeted Mini-Lesson' to fix exactly this weakness.
    
    Return ONLY valid JSON (no markdown):
    {{
      "weakness_title": "Target: [The Weakness]",
      "explanation": "A friendly 2-sentence explanation of the rule.",
      "flashcards": [
        {{"front": "Incorrect sentence with blank or prompt", "back": "Correct sentence and why"}}
      ]
    }}
    \"\"\"
    
    try:
        raw = ask_groq(prompt, max_tokens=600, system="Output valid JSON only.")
        clean_json = raw.strip()
        match = re.search(r'\{.*\}', clean_json, re.DOTALL)
        if match: clean_json = match.group(0)
        return json.loads(clean_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""
    ai_py = ai_py.replace(injection_marker, weakness_endpoint + "\n\n" + injection_marker)
    write_file("backend/app/routers/ai.py", ai_py)
    print("Added weakness endpoint to ai.py")

# 2. PLATFORM.HTML (Add Button and Modal)
platform_html = read_file("platform.html")
if "triggerWeaknessModule()" not in platform_html:
    # Add button
    platform_html = platform_html.replace(
        '<button class="primary-action" type="button" id="getAiFeedbackBtn"',
        '<button class="primary-action" type="button" onclick="triggerWeaknessModule()" style="min-height: 44px; padding: 0 24px; border-radius: 999px; border: none; background: #db2777; color: #fffaf2; font-weight: 700; cursor: pointer; transition: transform 0.15s; margin-right: auto;">🎯 Target My Weaknesses</button>\n        <button class="primary-action" type="button" id="getAiFeedbackBtn"'
    )
    
    # Add Modal
    modal_html = """
  <!-- WEAKNESS MODULE MODAL -->
  <dialog class="native-modal" id="modalWeakness" onclick="closeStudyModals(event)">
    <div class="ai-modal-content flashcard-modal">
      <div class="ai-modal-header">
        <h3 class="ai-modal-title">🎯 <span id="weaknessModalTitle">Targeted Practice</span></h3>
        <button class="ai-modal-close" onclick="closeStudyModals()" aria-label="Close dialog" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
      <div class="ai-modal-body">
        <p id="weaknessExplanation" style="color: var(--accent-deep); font-weight: 500; font-size: 1rem; margin-bottom: 24px; text-align: center;"></p>
        <div class="ai-card-grid" id="weaknessContentArea"></div>
      </div>
    </div>
  </dialog>
"""
    platform_html = platform_html.replace('<!-- MODAL: FLASHCARDS -->', modal_html + '\n  <!-- MODAL: FLASHCARDS -->')
    write_file("platform.html", platform_html)
    print("Added Weakness button & modal to platform.html")

# 3. PLATFORM.JS (Handle API call and modal)
platform_js = read_file("platform.js")
if "triggerWeaknessModule" not in platform_js:
    logic = """
// ===== DYNAMIC WEAKNESS TARGETING =====
async function triggerWeaknessModule() {
  if (!studentProfile?.id) return alert("Please log in first!");
  
  const btn = document.querySelector('button[onclick="triggerWeaknessModule()"]');
  const originalText = btn.textContent;
  btn.textContent = "Analyzing mistakes...";
  btn.disabled = true;
  
  try {
    const res = await apiFetch(`/api/ai/analysis/${studentProfile.id}/weakness-module`, { method: "POST" });
    if (res.error) {
      alert(res.error);
      return;
    }
    
    document.getElementById("weaknessModalTitle").textContent = res.weakness_title;
    document.getElementById("weaknessExplanation").textContent = res.explanation;
    
    const area = document.getElementById("weaknessContentArea");
    area.innerHTML = "";
    
    res.flashcards.forEach(card => {
      const wrapper = document.createElement('div');
      wrapper.className = 'ai-card-wrapper';
      wrapper.innerHTML = `
        <div class="ai-card-inner">
          <div class="card-face-front" style="background: white; border-radius: 18px; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center; border: 2px solid #fbcfe8; color: #9d174d;">
            <h4 style="font-size: 1.15rem; font-weight: 800; margin:0;">${escapeHtml(card.front)}</h4>
          </div>
          <div class="card-face-back" style="background: linear-gradient(135deg, #db2777, #9d174d); color: white; border-radius: 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
            <p style="font-size: 1rem; font-weight: 700; margin: 0;">${escapeHtml(card.back)}</p>
          </div>
        </div>
      `;
      wrapper.onclick = () => {
        const inner = wrapper.querySelector('.ai-card-inner');
        inner.classList.toggle('is-flipped');
      };
      area.appendChild(wrapper);
    });
    
    document.getElementById("modalWeakness").showModal();
    document.getElementById("aiAnalysisModal").close(); // Close analysis modal behind it
    
  } catch (err) {
    alert("Could not load weakness module: " + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
"""
    platform_js += "\n" + logic
    # Make closeStudyModals handle modalWeakness
    platform_js = platform_js.replace(
      'if(modalRelearn) modalRelearn.close();',
      'if(modalRelearn) modalRelearn.close();\n  const modalWeakness = document.getElementById("modalWeakness");\n  if (modalWeakness) modalWeakness.close();'
    )
    write_file("platform.js", platform_js)
    print("Added Weakness JS to platform.js")

