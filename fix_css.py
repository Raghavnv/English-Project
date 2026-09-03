import re

with open('platform.css', 'r') as f:
    css = f.read()

# 1. Fix grid overflow clipping
original_group = r"""\.class-list,\s*\.progress-grid,\s*\.module-grid,\s*\.question-stack\s*\{\s*max-height: 400px;\s*overflow-y: auto;\s*padding-right: 8px;\s*display: grid;\s*gap: 12px;\s*\}"""
new_group = """
.class-list,
.progress-grid,
.module-grid,
.question-stack {
  display: grid;
  gap: 12px;
}
.question-stack {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}
"""
css = re.sub(original_group, new_group.strip(), css, flags=re.DOTALL)

# 2. Add safe padding zone to grid containers for 3D hover (so they don't clip against their parent section headers)
buffer_css = """
.class-list,
.progress-grid,
.module-grid,
.workspace-grid {
  padding-top: 16px;
  margin-top: -16px;
}
"""
css += '\n' + buffer_css.strip() + '\n'

with open('platform.css', 'w') as f:
    f.write(css)

print("CSS Fixed safely on pristine code.")
