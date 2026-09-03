import re

with open('lesson.js', 'r') as f:
    js = f.read()

# Add a state variable if not present
if 'let lessonCompletedSoundPlayed = false;' not in js:
    js = js.replace('let module = null;', 'let module = null;\nlet lessonCompletedSoundPlayed = false;')

# Update updateProgress
new_update = """
    const pct = Math.round((answered / total) * 100);
    document.getElementById("progressText").textContent = `${answered} of ${total} answered`;
    document.getElementById("progressPct").textContent = pct + "%";
    document.getElementById("progressFill").style.width = pct + "%";
    
    if (pct === 100 && !lessonCompletedSoundPlayed) {
      lessonCompletedSoundPlayed = true;
      if (typeof playChimeSound !== 'undefined') playChimeSound();
      if (typeof fireConfetti !== 'undefined') fireConfetti();
    }
    
    return answered;
"""

js = re.sub(
    r'const pct = Math\.round\(\(answered / total\) \* 100\);\s*document\.getElementById\("progressText"\)\.textContent =.*?;\s*document\.getElementById\("progressPct"\)\.textContent =.*?;\s*document\.getElementById\("progressFill"\)\.style\.width =.*?;\s*return answered;',
    new_update.strip(),
    js,
    flags=re.DOTALL
)

with open('lesson.js', 'w') as f:
    f.write(js)

print("Confetti trigger added.")
