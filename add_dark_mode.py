import re

# 1. Update platform.css
with open('platform.css', 'r') as f:
    css = f.read()

dark_mode_css = """
/* ── DARK MODE THEME ── */
:root.dark-theme {
  --background: #121212;
  --text: #e0e0e0;
  --muted: #a0a0a0;
  --accent: #d97706;
  --accent-deep: #fbbf24;
  --surface: #1e1e1e;
  --shadow-glass: 0 4px 12px rgba(0, 0, 0, 0.4);
}

:root.dark-theme body {
  background: var(--background);
}

:root.dark-theme .page-container::before,
:root.dark-theme .page-container::after {
  opacity: 0.05;
}

:root.dark-theme .sidebar-panel,
:root.dark-theme .hero-band,
:root.dark-theme .workspace-panel,
:root.dark-theme .module-card,
:root.dark-theme .class-button {
  background: linear-gradient(145deg, rgba(30, 30, 30, 0.94), rgba(20, 20, 20, 0.9));
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

:root.dark-theme .module-card h4,
:root.dark-theme .class-button strong {
  color: #fff;
}

:root.dark-theme .module-card p,
:root.dark-theme .class-button span {
  color: #bbb;
}

:root.dark-theme .app-rail {
  background: linear-gradient(185deg, #0f0f0f 0%, #1a1a1a 100%);
  border-right: 1px solid rgba(255,255,255,0.05);
}

:root.dark-theme .rail-btn {
  color: rgba(255,255,255,0.4);
}
:root.dark-theme .rail-btn:hover {
  color: #fff;
  background: rgba(255,255,255,0.05);
}

:root.dark-theme .question-card {
  background: rgba(30, 30, 30, 0.7);
  border-color: rgba(255,255,255,0.05);
  color: #e0e0e0;
}

:root.dark-theme .choice-button {
  background: rgba(40, 40, 40, 0.8);
  border-color: rgba(255,255,255,0.1);
  color: #e0e0e0;
}
:root.dark-theme .choice-button:hover {
  background: rgba(60, 60, 60, 0.9);
}
"""

if ':root.dark-theme' not in css:
    css += '\n' + dark_mode_css
    with open('platform.css', 'w') as f:
        f.write(css)


# 2. Update platform.html to include toggle button and JS
with open('platform.html', 'r') as f:
    html = f.read()

# Add Dark Mode toggle to sidebar right before powered by
toggle_btn = """
    <button class="rail-btn" id="themeToggleBtn" data-tooltip="Theme" onclick="toggleTheme()" style="margin-top: 10px;">
      <span id="themeIcon">🌙</span> <span class="rail-btn-text">Dark Mode</span>
    </button>
"""

if 'id="themeToggleBtn"' not in html:
    html = html.replace('<div class="powered-by-sidebar">', toggle_btn + '\n    <div class="powered-by-sidebar">')

# Add JS logic for theme
theme_js = """
  <!-- THEME LOGIC -->
  <script>
    function toggleTheme() {
      const root = document.documentElement;
      root.classList.toggle('dark-theme');
      const isDark = root.classList.contains('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
      document.querySelector('#themeToggleBtn .rail-btn-text').textContent = isDark ? 'Light Mode' : 'Dark Mode';
      playPopSound();
    }
    
    // On Load
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.getElementById('themeIcon').textContent = '☀️';
      document.querySelector('#themeToggleBtn .rail-btn-text').textContent = 'Light Mode';
    }
  </script>
"""

if 'function toggleTheme()' not in html:
    html = html.replace('</body>', theme_js + '\n</body>')

with open('platform.html', 'w') as f:
    f.write(html)

print("Dark mode added.")
