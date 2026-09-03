import re

with open('platform.css', 'r') as f:
    content = f.read()

# Make sure all custom card buttons have appearance: none and proper block display
reset_css = """
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
"""

# Fix module-card
if '-webkit-appearance' not in re.search(r'\.module-card\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.module-card\s*\{)',
        r'\1' + reset_css,
        content,
        count=1
    )

# Fix class-button
if '-webkit-appearance' not in re.search(r'\.class-button\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.class-button\s*\{)',
        r'\1\n  -webkit-appearance: none;\n  appearance: none;\n  margin: 0;\n  width: 100%;',
        content,
        count=1
    )

# Replace display: grid; with display: flex; flex-direction: column; ONLY in .class-button
class_btn_block = re.search(r'\.class-button\s*\{[^}]*\}', content).group(0)
new_class_btn_block = class_btn_block.replace('display: grid;', 'display: flex;\n  flex-direction: column;\n  align-items: flex-start;')
content = content.replace(class_btn_block, new_class_btn_block)

# Fix .module-card p
if 'text-align: left;' not in re.search(r'\.module-card p\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.module-card p\s*\{)',
        r'\1\n  text-align: left;\n  width: 100%;',
        content,
        count=1
    )
    
# Fix module-card-top width
if 'width: 100%;' not in re.search(r'\.module-card-top\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.module-card-top\s*\{)',
        r'\1\n  width: 100%;',
        content,
        count=1
    )

# Fix question-stack max-height and custom scrollbar
if 'max-height: 400px;' not in re.search(r'\.question-stack\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.question-stack\s*\{)',
        r'\1\n  max-height: 400px;\n  overflow-y: auto;\n  padding-right: 8px;',
        content,
        count=1
    )
    
scrollbar_css = """
.question-stack::-webkit-scrollbar { width: 6px; }
.question-stack::-webkit-scrollbar-track { background: rgba(80,58,40,0.04); border-radius: 4px; }
.question-stack::-webkit-scrollbar-thumb { background: rgba(80,58,40,0.15); border-radius: 4px; }
.question-stack::-webkit-scrollbar-thumb:hover { background: rgba(80,58,40,0.3); }
"""
if '.question-stack::-webkit-scrollbar' not in content:
    content += scrollbar_css

with open('platform.css', 'w') as f:
    f.write(content)

print("Buttons fixed safely.")
