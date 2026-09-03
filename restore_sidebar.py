import re

with open('platform.html', 'r') as f:
    html = f.read()

# 1. Restore the app-rail CSS for expanding
new_css = """
    .app-rail {
      position: fixed; left: 0; top: 0; bottom: 0; width: 88px;
      background: linear-gradient(185deg, #18130f 0%, #291d15 50%, #1f1610 100%);
      z-index: 9999; display: flex; flex-direction: column; align-items: flex-start;
      padding: 24px 18px; gap: 14px; border-right: 1px solid rgba(255,255,255,0.08);
      box-shadow: 4px 0 28px rgba(0,0,0,0.25);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-x: hidden;
    }
    .app-rail:hover {
      width: 260px;
    }
"""
html = re.sub(
    r'\.app-rail\s*\{[^}]*\}',
    new_css.strip(),
    html,
    count=1
)

# 2. Add the rail-btn-text expansion logic if missing
hover_css = """
    .rail-btn-text {
      font-size: 1.05rem; font-weight: 600; font-family: var(--font-family);
      opacity: 0; white-space: nowrap; transition: opacity 0.2s ease;
    }
    .app-rail:hover .rail-btn-text {
      opacity: 1; transition-delay: 0.1s;
    }
"""
if '.rail-btn-text {' not in html:
    html = html.replace('.rail-btn:hover {', hover_css + '\n    .rail-btn:hover {')

# 3. Add text logic for logo span and powered-by span
logo_css = """
    .app-rail:hover .rail-logo span {
      opacity: 1; transition-delay: 0.1s;
    }
"""
if '.app-rail:hover .rail-logo span' not in html:
    html = html.replace('.rail-logo span {', '.rail-logo span {\n      opacity: 0; transition: opacity 0.2s ease;\n    }\n' + logo_css)

powered_css = """
    .app-rail:hover .powered-by-sidebar span {
      display: inline-block;
      opacity: 1; transition-delay: 0.15s;
    }
"""
if '.app-rail:hover .powered-by-sidebar' not in html:
    html = html.replace('.powered-by-sidebar span { display: none; }', '.powered-by-sidebar span { display: none; opacity: 0; }\n' + powered_css)

# 4. Restore <span class="rail-btn-text"> in HTML using the data-tooltip values
def replacer(match):
    tooltip = match.group(1)
    full_btn = match.group(0)
    if 'class="rail-btn-text"' not in full_btn:
        # insert span before the closing </button>
        # but there might be a badge... let's insert it right after the emoji.
        # Actually, emojis are matched by typical text processing or we can just inject it.
        # The buttons look like: <button class="rail-btn" data-tooltip="Dashboard" onclick="...">🏠 </button>
        # We can substitute `🏠 ` with `🏠 <span class="rail-btn-text">Dashboard</span>`
        # Safe fallback: replace `</button>` with ` <span class="rail-btn-text">TOOLTIP</span></button>` (putting it at the end of the button contents)
        # Wait, if there is a badge span, putting it at the end might break order? Flex row will just append it.
        
        # Let's insert it before the closing </button> tag or before the <span id="...Badge">
        pass
    return full_btn

# We will just manually replace the buttons for platform.html
buttons = [
    ("Dashboard", "🏠 "),
    ("Pronunciation Lab", "🎙️ "),
    ("Roleplay Sandbox", "🎭 "),
    ("Story Corner", "📖 "),
    ("Smart Translator", "🌐 "),
    ("Personal Word Bank", "🗂️ "),
    ("Memory Deck", "🧠 "),
    ("Theme", '<span id="themeIcon">🌙</span> ')
]

for label, icon in buttons:
    # Look for the icon and replace it with icon + span
    html = html.replace(icon + '</button>', icon + f'<span class="rail-btn-text">{label}</span></button>')

# For the badge buttons:
res_badge_str = '📚 <span id="resourceRailBadge"'
html = html.replace(res_badge_str, f'📚 <span class="rail-btn-text">Resources</span><span id="resourceRailBadge"')

broad_badge_str = '📣 <span id="broadcastRailBadge"'
html = html.replace(broad_badge_str, f'📣 <span class="rail-btn-text">Broadcasts</span><span id="broadcastRailBadge"')

# Restore the logo span
html = html.replace('<div class="rail-logo">☰', '<div class="rail-logo">☰ <span>Menu</span>')

with open('platform.html', 'w') as f:
    f.write(html)


with open('admin.html', 'r') as f:
    html = f.read()

admin_rail_css = """
    .app-rail {
      position: fixed; left: 0; top: 0; bottom: 0; width: 88px;
      background: linear-gradient(185deg, #18130f 0%, #291d15 50%, #1f1610 100%);
      z-index: 9999; display: flex; flex-direction: column;
      padding: 24px 16px; gap: 12px; border-right: 1px solid rgba(255,255,255,0.08);
      box-shadow: 4px 0 28px rgba(0,0,0,0.25);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-x: hidden; white-space: nowrap;
    }
    .app-rail:hover, body.rail-expanded .app-rail { width: 240px; }
"""
html = re.sub(
    r'\.app-rail\s*\{[^}]*\}',
    admin_rail_css.strip(),
    html,
    count=1
)

if '.app-rail:hover .powered-by-sidebar' not in html:
    html = html.replace('.powered-by-sidebar span { display: none; }', '.powered-by-sidebar span { display: none; opacity: 0; }\n    .app-rail:hover .powered-by-sidebar span, body.rail-expanded .powered-by-sidebar span { display: inline-block; opacity: 1; transition-delay: 0.15s; }')

with open('admin.html', 'w') as f:
    f.write(html)

print("Expansion restored without tooltips.")
