import re

with open('platform.html', 'r') as f:
    html = f.read()

# Fix duplicated menu
html = html.replace('<span>Menu</span> <span>Menu</span>', '<span>Menu</span>')

# Remove data-tooltip
html = re.sub(r'\sdata-tooltip="[^"]+"', '', html)

with open('platform.html', 'w') as f:
    f.write(html)

with open('admin.html', 'r') as f:
    html = f.read()

html = re.sub(r'\sdata-tooltip="[^"]+"', '', html)

with open('admin.html', 'w') as f:
    f.write(html)

print("Cleaned up HTML.")
