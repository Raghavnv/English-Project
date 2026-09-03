import re

with open('platform.html', 'r') as f:
    html = f.read()

# Add hover rule for rail-btn-text
if '.app-rail:hover .rail-btn-text' not in html:
    html = html.replace('.rail-btn:hover {', '.app-rail:hover .rail-btn-text {\n      opacity: 1; transition-delay: 0.1s;\n    }\n    .rail-btn:hover {')

with open('platform.html', 'w') as f:
    f.write(html)

print("Added hover rule to platform.html")
