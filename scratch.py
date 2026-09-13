with open("lesson.html", "r") as f:
    text = f.read()
import re
match = re.search(r'<main.*?</main>', text, flags=re.DOTALL)
if match:
    print(match.group(0))
