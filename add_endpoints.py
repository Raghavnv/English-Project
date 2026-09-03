import os

with open('backend/app/routers/ai.py', 'r') as f:
    code = f.read()

new_endpoints = """

# ── ADMIN BUDDY ──
class BuddyRequest(BaseModel):
    message: str

@router.post("/buddy")
def admin_buddy(body: BuddyRequest, requester=Depends(require_authenticated_requester)):
    system_prompt = "You are Buddy, an AI teaching assistant for English teachers. You help teachers brainstorm lesson ideas, draft announcements, and analyze student progress. Keep your answers extremely concise, helpful, and friendly (1-3 paragraphs max). Use markdown formatting."
    try:
        reply = ask_groq(system_prompt + "\\n\\nTeacher says: " + body.message, max_tokens=300)
        return {"response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── BULK CURRICULUM GENERATOR ──
class BulkCurriculumRequest(BaseModel):
    topic: str
    count: int

@router.post("/bulk-curriculum")
def generate_bulk_curriculum(body: BulkCurriculumRequest, requester=Depends(require_authenticated_requester)):
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
    try:
        raw = ask_groq(prompt, max_tokens=800, system="Output valid JSON only.")
        clean_json = raw.strip()
        import re
        match = re.search(r'\{.*\}', clean_json, re.DOTALL)
        if match: clean_json = match.group(0)
        import json
        return json.loads(clean_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""

if 'def generate_bulk_curriculum' not in code:
    code += new_endpoints

with open('backend/app/routers/ai.py', 'w') as f:
    f.write(code)

print("Endpoints added to ai.py")
