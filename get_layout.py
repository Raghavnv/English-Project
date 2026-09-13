import re
with open("lesson.html", "r") as f:
    text = f.read()
match = re.search(r'<div class="lesson-shell">.*?</main>', text, flags=re.DOTALL)
if match:
    print(match.group(0)[:1500])
