import re

with open('admin.html', 'r') as f:
    html = f.read()

# 1. Inject Dark Mode Button
theme_btn = """
    <button class="rail-btn" id="themeToggleBtn" onclick="toggleTheme()" style="margin-top: auto;">
      <span class="icon" id="themeIcon">🌙</span><span class="label">Dark Mode</span>
    </button>
"""
if 'themeToggleBtn' not in html:
    html = html.replace('<div class="powered-by-sidebar">', theme_btn + '    <div class="powered-by-sidebar">')
    # But wait, powered-by-sidebar has margin-top: auto. We should let them stack or share the space.
    html = html.replace('margin-top: auto;', '') # We'll just let CSS handle it naturally, or add margin-top: auto to the theme button.

# 2. Inject Theme Logic and Audio Engine script at the bottom of the body
theme_script = """
  <!-- AUDIO ENGINE & THEME LOGIC -->
  <script>
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function initAudio() {
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playPopSound() {
      if(!audioCtx) initAudio();
      if(!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }

    // Wire up clicks to pop sound globally for interactive elements
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, .rail-btn, .admin-card, .add-question-btn, .remove-q-btn, .action-btn');
      if (target) {
        initAudio();
        playPopSound();
      }
    });

    function toggleTheme() {
      const root = document.documentElement;
      root.classList.toggle('dark-theme');
      const isDark = root.classList.contains('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
      const label = document.querySelector('#themeToggleBtn .label');
      if(label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      playPopSound();
    }
    
    // On Load Theme Check
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark-theme');
      const icon = document.getElementById('themeIcon');
      if(icon) icon.textContent = '☀️';
      const label = document.querySelector('#themeToggleBtn .label');
      if(label) label.textContent = 'Light Mode';
    }
  </script>
"""
if 'toggleTheme()' not in html:
    html = html.replace('</body>', theme_script + '\n</body>')

with open('admin.html', 'w') as f:
    f.write(html)

print("Admin.html updated with Theme toggle and SFX")
