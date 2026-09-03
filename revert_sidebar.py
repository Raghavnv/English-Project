import re

files = ['platform.html', 'admin.html']

for file in files:
    with open(file, 'r') as f:
        html = f.read()
    
    # 1. Remove rail-btn-text spans
    html = re.sub(r'<span class="rail-btn-text">.*?</span>', '', html)
    
    # 2. Fix rail-logo text span (if we added it, originally it was just "Menu")
    html = re.sub(r'<div class="rail-logo">\s*<span>Menu</span>', '<div class="rail-logo">☰', html)
    
    # 3. Modify CSS to disable app-rail expansion
    html = html.replace('.app-rail:hover {\n      width: 260px;\n    }', '')
    html = html.replace('.app-rail:hover .rail-btn-text {\n      opacity: 1; transition-delay: 0.1s;\n    }', '')
    html = html.replace('.app-rail:hover .rail-logo span {\n      opacity: 1; transition-delay: 0.1s;\n    }', '')
    html = html.replace('.app-rail:hover .powered-by-sidebar {\n      opacity: 1; transition-delay: 0.15s;\n    }', '')
    
    # 4. Make powered-by-sidebar always visible but fit the 88px width, or rely on tooltips?
    # If the sidebar is 88px, we can just center the logo and hide the text.
    new_powered_by_css = """
    .powered-by-sidebar {
      margin-top: auto; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); 
      overflow: hidden;
    }
    .powered-by-sidebar span { display: none; }
    """
    html = re.sub(r'\.powered-by-sidebar\s*\{[^}]*\}\s*\.app-rail:hover \.powered-by-sidebar\s*\{[^}]*\}\s*\.powered-by-sidebar span\s*\{[^}]*\}', new_powered_by_css.strip(), html, flags=re.DOTALL)
    
    # Clean up any missed parts of powered-by-sidebar
    html = re.sub(r'\.powered-by-sidebar\s*\{.*?\}', new_powered_by_css.strip(), html, flags=re.DOTALL)
    
    with open(file, 'w') as f:
        f.write(html)

print("Sidebar reverted to icon-only mode.")
