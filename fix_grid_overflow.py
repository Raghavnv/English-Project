import re

with open('platform.css', 'r') as f:
    css = f.read()

# Restore the original grouped selector
original_group = """
.class-list,
.progress-grid,
.module-grid,
.question-stack {
  display: grid;
  gap: 12px;
}

.question-stack {
  max-height: 380px;
  overflow-y: auto;
  padding-right: 8px;
}
"""

# Replace the broken block
css = re.sub(
    r'\.class-list,\s*\.progress-grid,\s*\.module-grid,\s*\.question-stack\s*\{\s*max-height: 400px;\s*overflow-y: auto;\s*padding-right: 8px;\s*display: grid;\s*gap: 12px;\s*\}',
    original_group.strip(),
    css,
    flags=re.DOTALL
)

with open('platform.css', 'w') as f:
    f.write(css)

print("Grid overflow fixed.")
