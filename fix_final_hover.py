import re

for file in ['platform.html', 'admin.html']:
    with open(file, 'r') as f:
        html = f.read()

    # Completely remove rail-btn tooltips from embedded CSS
    html = re.sub(r'\.rail-btn::after\s*\{[^}]*\}', '', html, flags=re.DOTALL)
    html = re.sub(r'\.rail-btn:hover::after\s*\{[^}]*\}', '', html, flags=re.DOTALL)
    
    with open(file, 'w') as f:
        f.write(html)

with open('platform.css', 'r') as f:
    css = f.read()

# Add hover breathing room (padding) to the grids so they don't clip the 3D hover effect at the top
buffer_css = """
.class-list,
.progress-grid,
.module-grid,
.workspace-grid {
  padding-top: 16px;
  margin-top: -16px;
}
"""

if 'padding-top: 16px;\n  margin-top: -16px;' not in css:
    css += '\n' + buffer_css.strip() + '\n'
    
with open('platform.css', 'w') as f:
    f.write(css)

print("Tooltips nuked, and 3D hover buffer added.")
