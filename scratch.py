import re
with open("backend/app/routers/ai.py", "r") as f:
    text = f.read()

m = re.search(r'def grade_answer.*?return score, feedback_text', text, flags=re.DOTALL)
if m:
    print(m.group(0))
