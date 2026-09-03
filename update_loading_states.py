import re

# Update platform.js to replace spinners with skeleton pulse
with open('platform.js', 'r') as f:
    js = f.read()

skeleton_html = """
      <div class="ai-loading-state" style="display:flex; flex-direction:column; gap:12px;">
        <div class="skeleton-pulse" style="height: 24px; width: 60%; border-radius: 6px;"></div>
        <div class="skeleton-pulse" style="height: 16px; width: 100%; border-radius: 4px;"></div>
        <div class="skeleton-pulse" style="height: 16px; width: 90%; border-radius: 4px;"></div>
        <div class="skeleton-pulse" style="height: 16px; width: 95%; border-radius: 4px;"></div>
        <p style="color: var(--accent); margin: 12px 0 0 0; font-weight: 600;">Generating...</p>
      </div>
"""

# We'll do simple string replacements for the spinner chunks
js = re.sub(
    r'<div class="ai-loading-state">.*?Buddy is preparing your lesson guide.*?</p>\s*</div>',
    skeleton_html.replace('Generating...', 'Buddy is preparing your lesson guide...').replace('var(--accent)', '#7dd3fc'),
    js,
    flags=re.DOTALL
)

js = re.sub(
    r'<div class="ai-loading-state">.*?Generating your custom flashcard deck.*?</p>\s*</div>',
    skeleton_html.replace('Generating...', 'Generating your custom flashcard deck...'),
    js,
    flags=re.DOTALL
)

# Also check for aiAnalysisModal loading state
js = re.sub(
    r'<div class="ai-loading-state" id="aiLoading">.*?Analyzing your recent performance.*?</p>\s*</div>',
    '<div class="ai-loading-state" id="aiLoading" style="display:flex; flex-direction:column; gap:12px;">\n        <div class="skeleton-pulse" style="height: 24px; width: 60%; border-radius: 6px;"></div>\n        <div class="skeleton-pulse" style="height: 16px; width: 100%; border-radius: 4px;"></div>\n        <div class="skeleton-pulse" style="height: 16px; width: 90%; border-radius: 4px;"></div>\n        <div class="skeleton-pulse" style="height: 16px; width: 95%; border-radius: 4px;"></div>\n        <p style="color: var(--accent); margin: 12px 0 0 0; font-weight: 600;">Analyzing your recent performance...</p>\n      </div>',
    js,
    flags=re.DOTALL
)

# And in lesson.js
try:
    with open('lesson.js', 'r') as f:
        lesson_js = f.read()
    lesson_js = re.sub(
        r'<div class="ai-loading-state">.*?<div class="spinner"></div>.*?<p>Loading summary\.\.\.</p>.*?</div>',
        skeleton_html.replace('Generating...', 'Loading summary...').replace('var(--accent)', 'rgba(56,189,248,0.9)'),
        lesson_js,
        flags=re.DOTALL
    )
    with open('lesson.js', 'w') as f:
        f.write(lesson_js)
except:
    pass


with open('platform.js', 'w') as f:
    f.write(js)

print("Loading states updated.")
