import re

with open('backend/app/routers/ai.py', 'r') as f:
    code = f.read()

old_prompt = """
    prompt = f\"\"\"Generate a {body.count}-module English course curriculum for the topic: "{body.topic}".
    Return ONLY a JSON object in this format (no markdown, no extra text):
    {{
        "course_title": "Title",
        "modules": [
            {{
                "module_title": "Module 1",
                "description": "What they will learn",
                "vocabulary": ["word1", "word2", "word3"]
            }}
        ]
    }}
    \"\"\"
"""

new_prompt = """
    prompt = f\"\"\"Generate a {body.count}-module English course curriculum for the topic: "{body.topic}".
    For each module, provide 2 short reading/writing text questions, and 3 vocabulary flashcards.
    Return ONLY a JSON object in this format (no markdown, no extra text):
    {{
        "course_title": "Title",
        "modules": [
            {{
                "module_title": "Module 1",
                "description": "What they will learn",
                "questions": [
                    {{"prompt": "Question text here", "type": "text"}}
                ],
                "flashcards": [
                    {{"front": "Word", "back": "Definition/Translation"}}
                ]
            }}
        ]
    }}
    \"\"\"
"""

code = code.replace(old_prompt.strip(), new_prompt.strip())

with open('backend/app/routers/ai.py', 'w') as f:
    f.write(code)

print("Updated AI Prompt for full curriculum")
