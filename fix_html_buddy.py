import re

with open('admin.html', 'r') as f:
    html = f.read()

# Remove the block I added which starts with <!-- ADMIN BUDDY FLOATING WIDGET --> and ends with </div> right before </body>
html = re.sub(r'<!-- ADMIN BUDDY FLOATING WIDGET -->.*?</div>\s*</body>', '</body>', html, flags=re.DOTALL)

with open('admin.html', 'w') as f:
    f.write(html)

print("Removed duplicate Admin Buddy widget.")
