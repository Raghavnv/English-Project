import re

with open('platform.css', 'r') as f:
    content = f.read()

# Fix module-card text alignment and height
# We will inject `display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; height: 100%;` into `.module-card { ... }`
if 'display: flex;' not in re.search(r'\.module-card\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.module-card\s*\{)',
        r'\1\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  height: 100%;',
        content,
        count=1
    )

# Fix question-stack max-height
if 'max-height' not in re.search(r'\.question-stack\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.question-stack\s*\{)',
        r'\1\n  max-height: 380px;\n  overflow-y: auto;\n  padding-right: 8px;\n  padding-bottom: 8px;',
        content,
        count=1
    )
    
# Also the .module-card-top might need width: 100% since we made the parent flex column
if 'width: 100%;' not in re.search(r'\.module-card-top\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.module-card-top\s*\{)',
        r'\1\n  width: 100%;',
        content,
        count=1
    )
    
# And .module-card p might need margin-top: auto to push bottom elements if any, or just left align
if 'text-align: left;' not in re.search(r'\.module-card p\s*\{[^}]*\}', content).group(0):
    content = re.sub(
        r'(\.module-card p\s*\{)',
        r'\1\n  text-align: left;\n  width: 100%;',
        content,
        count=1
    )

with open('platform.css', 'w') as f:
    f.write(content)

print("Fixed CSS for widgets")
