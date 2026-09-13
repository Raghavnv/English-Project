import re
import os

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

# ===========================
# 1. PLATFORM.CSS REFACTOR
# ===========================
css = read_file('platform.css')

tokens = """
:root {
  /* 🎨 Color Tokens */
  --color-primary-100: #e0e7ff;
  --color-primary-500: #4f46e5;
  --color-primary-700: #3730a3;
  --color-surface-base: #ffffff;
  --color-surface-muted: #f9fafb;
  --color-surface-glass: rgba(255, 255, 255, 0.75);
  --color-text-base: #111827;
  --color-text-muted: #4b5563;
  --color-text-invert: #ffffff;
  --color-danger-500: #ef4444;
  --color-danger-glass: rgba(239, 68, 68, 0.1);

  /* 📏 Spacing Tokens (8pt Grid) */
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* 💠 Interaction & Elevation */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.05);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.08);
  --shadow-glass: 0 8px 32px rgba(31, 26, 22, 0.08);
}
"""
if ":root {" not in css:
    css = tokens + css.lstrip()

css = re.sub(r'(\.modal-cancel\s*\{[^}]*?min-height:\s*)40px', r'\g<1>44px', css)
css = re.sub(r'(\.modal-confirm\s*\{[^}]*?min-height:\s*)40px', r'\g<1>44px', css)

pulse_css = """
.mic-btn.is-listening {
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
  70% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
}
"""
if "@keyframes pulse-ring" not in css:
    css = re.sub(r'@keyframes ai-pulse \{[^}]+\}', pulse_css, css)

dialog_css = """
/* Native Dialog Overrides */
dialog.native-modal {
  padding: 0; border: none; background: transparent; outline: none; margin: auto; overflow: visible;
}
dialog.native-modal::backdrop {
  background: rgba(31, 26, 22, 0.55); backdrop-filter: blur(4px);
}
dialog.native-modal[open] .modal-box,
dialog.native-modal[open] > div {
  animation: modal-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
@keyframes modal-pop {
  from { transform: translateY(12px) scale(0.97); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* Flashcard Flips */
.ai-card-inner {
  position: relative; width: 100%; height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d; cursor: pointer;
}
.ai-card-inner.is-flipped { transform: rotateY(180deg); }
.card-face-front, .card-face-back {
  position: absolute; inset: 0; backface-visibility: hidden; border-radius: 24px;
}
.card-face-back { transform: rotateY(180deg); }
"""
if "dialog.native-modal" not in css:
    css += "\n" + dialog_css

write_file('platform.css', css)

# ===========================
# 2. PLATFORM.HTML REFACTOR
# ===========================
html = read_file('platform.html')

html = html.replace('<div class="modal-overlay" id="lightningModal"', '<dialog class="native-modal" id="lightningModal"')
lm_match = re.search(r'<dialog class="native-modal" id="lightningModal".*?<!-- ── AI ANALYSIS MODAL ── -->', html, flags=re.DOTALL)
if lm_match:
    lm_block = lm_match.group(0)
    lm_block_fixed = lm_block.rsplit('</div>', 1)[0] + '</dialog>' + lm_block.rsplit('</div>', 1)[1]
    html = html.replace(lm_block, lm_block_fixed)

html = html.replace('<div class="modal-overlay" id="aiAnalysisModal"', '<dialog class="native-modal" id="aiAnalysisModal"')
am_match = re.search(r'<dialog class="native-modal" id="aiAnalysisModal".*?<!-- ── RESET PROGRESS MODAL ── -->', html, flags=re.DOTALL)
if am_match:
    am_block = am_match.group(0)
    am_block_fixed = am_block.rsplit('</div>', 1)[0] + '</dialog>' + am_block.rsplit('</div>', 1)[1]
    html = html.replace(am_block, am_block_fixed)

html = html.replace('<div class="modal-overlay" id="resetModal"', '<dialog class="native-modal" id="resetModal"')
rm_match = re.search(r'<dialog class="native-modal" id="resetModal".*?<!-- THEME LOGIC -->', html, flags=re.DOTALL)
if rm_match:
    rm_block = rm_match.group(0)
    rm_block_fixed = rm_block.rsplit('</div>', 1)[0] + '</dialog>' + rm_block.rsplit('</div>', 1)[1]
    html = html.replace(rm_block, rm_block_fixed)

html = re.sub(r'style="position:fixed; inset:0;[^"]*"', '', html)

old_rp_mic = '<button id="roleplayMicBtn" onclick="toggleRoleplayMic()" style="width: 52px; height: 52px; border-radius: 50%; border: none; background: #dc2626; color: white; font-size: 1.4rem; cursor: pointer; transition: 0.2s; flex-shrink: 0;">🎤</button>'
new_rp_mic = '<button id="roleplayMicBtn" onclick="toggleRoleplayMic()" aria-label="Start voice recording" aria-pressed="false" class="mic-btn" style="width: 52px; height: 52px; border-radius: 50%; border: none; background: #dc2626; color: white; cursor: pointer; flex-shrink: 0; display:flex; align-items:center; justify-content:center;"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></button>'
html = html.replace(old_rp_mic, new_rp_mic)

html = html.replace('id="closeAnalysisModalBtn" onclick="closeAnalysisModal()" style="position: absolute; top: 20px; right: 20px; width: 32px; height: 32px;', 'id="closeAnalysisModalBtn" onclick="closeAnalysisModal()" aria-label="Close dialog" style="position: absolute; top: 20px; right: 20px; width: 44px; height: 44px;')
html = html.replace('onclick="closeLightningModal()" style="position: absolute; top: 20px; right: 20px; width: 40px; height: 40px;', 'onclick="closeLightningModal()" aria-label="Close dialog" style="position: absolute; top: 20px; right: 20px; width: 44px; height: 44px;')

take_quiz_modal = """
<!-- TAKE QUIZ MODAL -->
<dialog id="modalTakeQuiz" class="native-modal">
  <div class="modal-box" style="width: min(calc(100% - 40px), 800px); max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
    <div style="padding: 24px; border-bottom: 1px solid rgba(80,58,40,0.1); display: flex; justify-content: space-between; align-items: center; background: #fff;">
      <h2 id="takeQuizTitle" style="margin: 0; font-size: 1.5rem; color: var(--text);">Quiz</h2>
      <div style="font-size: 1.25rem; font-weight: 800; color: #d32f2f; background: rgba(211,47,47,0.1); padding: 6px 12px; border-radius: 8px;" id="quizTimer">00:00</div>
    </div>
    <div style="flex: 1; overflow-y: auto; padding: 32px;" id="takeQuizQuestions">
    </div>
    <div style="padding: 24px; border-top: 1px solid rgba(80,58,40,0.1); background: #f9fafb; text-align: right;">
      <button onclick="submitQuiz()" class="modal-confirm" style="font-size: 1.1rem; padding: 0 32px; min-height: 48px;">Submit Quiz</button>
    </div>
  </div>
</dialog>
"""
if 'modalTakeQuiz' not in html:
    html = html.replace('</body>', take_quiz_modal + '\n</body>')

write_file('platform.html', html)

# ===========================
# 3. PLATFORM.JS REFACTOR
# ===========================
js = read_file('platform.js')

js = js.replace('<div class="ai-modal-overlay" id="modalFlashcards" onclick="closeStudyModals(event)">', '<dialog class="native-modal" id="modalFlashcards" onclick="closeStudyModals(event)">')
js = js.replace('<div class="ai-modal-overlay" id="modalRelearn" onclick="closeStudyModals(event)">', '<dialog class="native-modal" id="modalRelearn" onclick="closeStudyModals(event)">')

js = js.replace('<button class="ai-modal-close" onclick="closeStudyModals()">✕</button>', '<button class="ai-modal-close" onclick="closeStudyModals()" aria-label="Close dialog" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">✕</button>')

js = js.replace('<button id="pronunciationMicBtn" class="mic-btn" onclick="startPronunciationMic()">🎤</button>', '<button id="pronunciationMicBtn" class="mic-btn" onclick="startPronunciationMic()" aria-label="Start recording" aria-pressed="false" style="width:52px; height:52px; border-radius:50%; border:none; background:#dc2626; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center;"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></button>')

js = re.sub(r'modal\.style\.display\s*=\s*["\']flex["\'];\s*void modal\.offsetWidth;\s*modal\.style\.opacity\s*=\s*["\']1["\'];', r'modal.showModal();', js)
js = re.sub(r'modal\.style\.opacity\s*=\s*["\']0["\'];\s*setTimeout\(\(\)\s*=>\s*\{\s*modal\.style\.display\s*=\s*["\']none["\'];\s*},\s*250\);', r'modal.close();', js)

js = re.sub(r'modal\.classList\.add\("show"\);', r'modal.showModal();', js)
js = re.sub(r'modalRelearn\.classList\.remove\("show"\);', r'modalRelearn.close();', js)
js = re.sub(r'modalFlashcards\.classList\.remove\("show"\);', r'modalFlashcards.close();', js)

js = js.replace("document.getElementById('modalTakeQuiz').style.display = 'flex';", "document.getElementById('modalTakeQuiz').showModal();")
js = js.replace("document.getElementById('modalTakeQuiz').style.display = 'none';", "document.getElementById('modalTakeQuiz').close();")

srs_old = """
    <div id="srsFlashcard" style="width: 100%; height: 300px; perspective: 1000px; cursor: pointer; margin-bottom: 24px;" onclick="flipSrsCard()">
      <div id="srsCardInner" style="position: relative; width: 100%; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d;">
        
        <!-- FRONT OF CARD -->
        <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 24px; background: white; border: 2px solid rgba(139, 92, 246, 0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.1);">
          <h2 style="font-family: var(--font-family); font-size: 2.8rem; font-weight: 800; letter-spacing: -0.03em; color: #4c1d95; margin: 0;">${escapeHtml(currentSrsWord.word)}</h2>
          <p style="color: var(--muted); font-size: 0.9rem; margin-top: 16px;">Tap to flip</p>
        </div>

        <!-- BACK OF CARD -->
        <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 24px; background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; transform: rotateY(180deg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.3);">
          <h2 style="font-family: var(--font-family); font-size: 2rem; font-weight: 800; margin: 0 0 8px;">${escapeHtml(currentSrsWord.translation)}</h2>
          <p style="font-size: 1.1rem; opacity: 0.9; text-align: center; margin: 0;">${escapeHtml(currentSrsWord.example)}</p>
        </div>
      </div>
    </div>
"""
srs_new = """
    <div id="srsFlashcard" style="width: 100%; height: 300px; perspective: 1000px; margin-bottom: 24px;" onclick="flipSrsCard()">
      <div id="srsCardInner" class="ai-card-inner">
        <!-- FRONT OF CARD -->
        <div class="card-face-front" style="background: white; border: 2px solid rgba(139, 92, 246, 0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.1);">
          <h2 style="font-family: var(--font-family); font-size: 2.8rem; font-weight: 800; letter-spacing: -0.03em; color: #4c1d95; margin: 0;">${escapeHtml(currentSrsWord.word)}</h2>
          <p style="color: var(--muted); font-size: 0.9rem; margin-top: 16px;">Tap to flip</p>
        </div>
        <!-- BACK OF CARD -->
        <div class="card-face-back" style="background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; box-shadow: 0 10px 30px rgba(109, 40, 217, 0.3);">
          <h2 style="font-family: var(--font-family); font-size: 2rem; font-weight: 800; margin: 0 0 8px;">${escapeHtml(currentSrsWord.translation)}</h2>
          <p style="font-size: 1.1rem; opacity: 0.9; text-align: center; margin: 0;">${escapeHtml(currentSrsWord.example)}</p>
        </div>
      </div>
    </div>
"""
js = js.replace(srs_old, srs_new)

js = re.sub(
    r'window\.flipSrsCard = function\(\) \{\s*const inner = document\.getElementById\("srsCardInner"\);\s*if\(!inner\) return;\s*srsFlipped = !srsFlipped;\s*inner\.style\.transform = srsFlipped \? "rotateY\(180deg\)" : "rotateY\(0deg\)";\s*\}',
    r'window.flipSrsCard = function() { const inner = document.getElementById("srsCardInner"); if(!inner) return; srsFlipped = !srsFlipped; inner.classList.toggle("is-flipped", srsFlipped); }',
    js
)

ai_card_old = """        wrapper.innerHTML = `
          <div class="ai-card-inner">
            <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: white; border-radius: 18px; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center;">
              <h4 style="font-size: 1.25rem; font-weight: 800; color: #4c1d95; margin:0;">${escapeHtml(card.front)}</h4>
            </div>
            <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: linear-gradient(135deg, #7c3aed, #4c1d95); color: white; border-radius: 18px; transform: rotateY(180deg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
              <p style="font-size: 1.1rem; font-weight: 700; margin: 0 0 8px;">${escapeHtml(card.back)}</p>
              <p style="font-size: 0.85rem; opacity: 0.85; margin: 0;">${escapeHtml(card.hint)}</p>
            </div>
          </div>
        `;
        wrapper.onclick = () => {
          const inner = wrapper.querySelector('.ai-card-inner');
          const isFlipped = inner.style.transform === 'rotateY(180deg)';
          inner.style.transform = isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)';
        };"""
ai_card_new = """        wrapper.innerHTML = `
          <div class="ai-card-inner">
            <div class="card-face-front" style="background: white; border-radius: 18px; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center;">
              <h4 style="font-size: 1.25rem; font-weight: 800; color: #4c1d95; margin:0;">${escapeHtml(card.front)}</h4>
            </div>
            <div class="card-face-back" style="background: linear-gradient(135deg, #7c3aed, #4c1d95); color: white; border-radius: 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;">
              <p style="font-size: 1.1rem; font-weight: 700; margin: 0 0 8px;">${escapeHtml(card.back)}</p>
              <p style="font-size: 0.85rem; opacity: 0.85; margin: 0;">${escapeHtml(card.hint)}</p>
            </div>
          </div>
        `;
        wrapper.onclick = () => {
          const inner = wrapper.querySelector('.ai-card-inner');
          inner.classList.toggle('is-flipped');
        };"""
js = js.replace(ai_card_old, ai_card_new)

backdrop_js = """
// Native Modal Backdrop Click to Close
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'DIALOG') {
    const rect = e.target.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.bottom && rect.left <= e.clientX && e.clientX <= rect.right);
    if (!isInDialog) { e.target.close(); }
  }
});
"""
if "Native Modal Backdrop Click to Close" not in js:
    js += "\n" + backdrop_js

write_file('platform.js', js)
