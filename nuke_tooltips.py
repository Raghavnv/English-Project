import re

files = ['platform.html', 'admin.html']
for file in files:
    with open(file, 'r') as f:
        html = f.read()
    
    # Remove tooltip CSS
    html = re.sub(r'\.rail-btn::after\s*\{[^}]*\}\s*\.rail-btn:hover::after\s*\{[^}]*\}', '', html)
    # Also clean up any lingering pieces just in case
    html = re.sub(r'\.rail-btn::after\s*\{[^}]*\}', '', html)
    html = re.sub(r'\.rail-btn:hover::after\s*\{[^}]*\}', '', html)
    html = re.sub(r'\.rail-btn::after\s*\{\s*display:\s*none;\s*\}', '', html)
    
    # Remove data-tooltip attributes from HTML so it's squeaky clean
    html = re.sub(r'\sdata-tooltip="[^"]+"', '', html)
    
    with open(file, 'w') as f:
        f.write(html)

print("Tooltips properly nuked on pristine files.")
