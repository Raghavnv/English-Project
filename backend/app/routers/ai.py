from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from groq import Groq
import os
import json
import re
import random
from dotenv import load_dotenv
from app.database import get_db
from app.models.models import Question, Answer, Progress, Student
from app.auth import get_current_admin, require_authenticated_requester, require_student_or_admin

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "openai/gpt-oss-20b"

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ── REQUEST MODELS ──

class FeedbackRequest(BaseModel):
    question_id: str
    answer_text: str
    student_id: Optional[str] = None
    progress_id: Optional[str] = None

class HintRequest(BaseModel):
    question_id: str
    lesson_title: Optional[str] = ""

class GuideRequest(BaseModel):
    question_id: str
    lesson_title: Optional[str] = ""

# ── HELPER FUNCTIONS ──

def get_question_or_404(question_id: str, db: Session) -> Question:
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q

SYSTEM_PROMPT = """You are a warm, patient English tutor helping school children in Bangalore learn English.
Your responses must be:
- Short and encouraging (2-3 sentences max)
- Simple language the child can understand
- Positive even when correcting — always acknowledge effort first
- Focused only on English language learning
Never be harsh. Never write long paragraphs. Always end on an encouraging note."""

def ask_groq(prompt: str, max_tokens: int = 150, system: str = SYSTEM_PROMPT) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt}
        ]
    )
    return response.choices[0].message.content.strip()

def grade_answer(question, answer_text: str) -> tuple[int, str]:
    difficulty = question.difficulty or "medium"
    diff_guide = {
        "easy":   "This is an easy question — be strict but still kind. If there are grammar errors, point them out clearly.",
        "medium": "This is a medium difficulty question — be balanced. Mention one grammar issue if present.",
        "hard":   "This is a hard question — be very encouraging. Only mention a grammar issue if it really affects meaning."
    }.get(difficulty, "")

    prompt = f"""The student was asked: "{question.prompt}"
    Their answer was: "{answer_text}"
    Difficulty level: {difficulty}. {diff_guide}

    Respond ONLY with a JSON object, no other text:
    {{"score": <integer 1-5>, "feedback": "<2-3 sentence feedback>"}}

    Score guide: 5=excellent, 4=good, 3=okay, 2=needs work, 1=try again.
    Feedback must be warm, simple English for a school child in India. Always acknowledge effort first."""

    raw = ask_groq(prompt, max_tokens=180)
    
    try:
        parsed = json.loads(raw)
        score = int(parsed.get("score", 3))
        feedback_text = parsed.get("feedback", raw)
    except Exception:
        m = re.search(r'"score"\s*:\s*(\d)', raw)
        score = int(m.group(1)) if m else 3
        fm = re.search(r'"feedback"\s*:\s*"(.+?)"', raw, re.S)
        feedback_text = fm.group(1) if fm else raw

    score = max(1, min(5, score))
    return score, feedback_text


# ── STUDENT WORKSPACE ENDPOINTS ──

@router.post("/feedback")
def get_feedback(body: FeedbackRequest, db: Session = Depends(get_db)):
    question = get_question_or_404(body.question_id, db)
    
    if not body.answer_text.strip():
        return {"feedback": "Please write something first — even one sentence is a great start! 😊"}
        
    try:
        score, feedback_text = grade_answer(question, body.answer_text)
        
        if body.progress_id:
            answer_row = db.query(Answer).filter(
                Answer.progress_id == body.progress_id, 
                Answer.question_id == body.question_id
            ).first()
            
            if answer_row:
                answer_row.ai_feedback = feedback_text
                answer_row.ai_score = score
                db.commit()
                
        return {"feedback": feedback_text, "score": score}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/hint")
def get_hint(body: HintRequest, db: Session = Depends(get_db), requester=Depends(require_authenticated_requester)):
    question = get_question_or_404(body.question_id, db)
    prompt = f"""Lesson topic: "{body.lesson_title}"
Question: "{question.prompt}"
Give a short helpful hint without giving away the answer. 1-2 sentences. Simple language for a school child."""
    
    try:
        return {"hint": ask_groq(prompt, max_tokens=100)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/guide")
def get_guide(body: GuideRequest, db: Session = Depends(get_db), requester=Depends(require_authenticated_requester)):
    question = get_question_or_404(body.question_id, db)
    prompt = f"""Lesson topic: "{body.lesson_title}"
Question: "{question.prompt}"
Explain what this question is asking in very simple English for a young student in India. 2 sentences max."""
    
    try:
        return {"guide": ask_groq(prompt, max_tokens=120)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/encouragement")
def get_encouragement(requester=Depends(require_authenticated_requester)):
    messages = [
        "Every answer you write builds your confidence. Keep going! 🌟",
        "Small steps every day lead to big progress. You've got this! 💪",
        "Don't worry about being perfect — just keep practising! 📝",
        "The fact that you're here means you're already doing great! ⭐",
        "Reading, writing, and speaking all improve together. Trust the process! 🚀",
        "One lesson at a time. That's all it takes! 🎯",
        "Your effort today is building your future. Keep it up! 🌈",
        "Every mistake is a learning step. You're doing brilliantly! 👏",
    ]
    return {"message": random.choice(messages)}


# ── AI CHATBOT (BUDDY) ──

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    lesson_title: Optional[str] = ""
    student_name: Optional[str] = ""

@router.post("/chat")
def chat_with_tutor(body: ChatRequest, requester=Depends(require_authenticated_requester)):
    if not body.messages:
        raise HTTPException(status_code=400, detail="No messages provided")
        
    if body.lesson_title:
        student_info = f"The student's name is {body.student_name}." if body.student_name else ""
        lesson_info = f"You are helping with the lesson: {body.lesson_title}." if body.lesson_title else ""
        system = f"""You are a warm, patient English tutor helping school children in Bangalore learn English.
{student_info}
{lesson_info}

Your rules:
- Keep every reply SHORT — 2-3 sentences maximum
- Use simple English that a school child can easily read
- Be encouraging, positive, and fun
- If the student wants to practice conversation, act as a friendly roleplay partner.
- ALWAYS gently correct any grammar or spelling mistakes the student makes in their message before continuing the conversation.
- Only discuss topics related to English learning, the lesson, or general school topics
- Never be harsh. Always end with something encouraging or a follow-up question to keep them engaged"""
    else:
        admin_name = f" named {body.student_name}" if body.student_name else ""
        system = f"""You are Buddy, a helpful AI assistant for an English learning platform called EnglishBridge.
You are talking to a teacher or admin{admin_name}.

Your rules:
- Be concise and practical — 2-4 sentences max
- Help with: writing lesson descriptions, suggesting question ideas, explaining platform features, giving teaching tips
- Be friendly and professional
- You can discuss anything related to English teaching, curriculum design, or the platform"""
        
    try:
        messages = [{"role": "system", "content": system}]
        for msg in body.messages:
            messages.append({"role": "user" if msg.role == "user" else "assistant", "content": msg.content})
            
        response = client.chat.completions.create(
            model=MODEL, 
            max_tokens=200, 
            messages=messages
        )
        return {"reply": response.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


# ── AI RE-LEARN FEATURE ──

class RelearnRequest(BaseModel):
    lesson_id: str
    lesson_title: Optional[str] = ""
    lesson_description: Optional[str] = ""

@router.post("/relearn")
def get_relearn_content(body: RelearnRequest, db: Session = Depends(get_db), requester=Depends(require_authenticated_requester)):
    from app.models.models import Question as QuestionModel
    
    lesson_questions = db.query(QuestionModel).filter(QuestionModel.lesson_id == body.lesson_id).all() if body.lesson_id else []
    
    questions_context = ""
    if lesson_questions:
        prompts = [f"- {q.prompt}" for q in lesson_questions[:5]]
        questions_context = "\nThe lesson includes questions like:\n" + "\n".join(prompts)
        
    prompt = f"""Lesson Title: "{body.lesson_title}"
Description: "{body.lesson_description or "No description provided"}"
{questions_context}

Create a friendly lesson recap for a school child in Bangalore. Use EXACTLY these section headers:
WHAT YOU WILL LEARN
KEY CONCEPTS
HELPFUL EXAMPLES
QUICK TIPS

Each section: 2-4 bullet points. Simple English. Be warm and encouraging."""
    
    try:
        content = ask_groq(
            prompt, 
            max_tokens=600, 
            system="You are a warm English teacher for school children in India. Use the exact section headers provided. Simple language, be encouraging."
        )
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


# ── AI CONTENT GENERATION (ADMIN) ──

class GenerateQuestionsRequest(BaseModel):
    lesson_title: str
    lesson_description: Optional[str] = ""
    class_label: Optional[str] = ""
    count: Optional[int] = 5
    question_type: Optional[str] = "text"

@router.post("/generate-questions")
def generate_questions(body: GenerateQuestionsRequest, current_admin=Depends(get_current_admin)):
    qtype = (body.question_type or "text").lower()
    
    if qtype == "speech":
        type_instr = "All questions must be open-ended SPEECH prompts. Start EVERY question with 'SPEECH: '"
    elif qtype == "mix":
        type_instr = "Generate a mix. Start text questions with 'TEXT: ' and speech questions with 'SPEECH: '."
    else:
        type_instr = "All questions must be TEXT questions asking for short written answers."
        
    prompt = f"""Lesson: "{body.lesson_title}"
Level: "{body.class_label or "General"}"
Description: "{body.lesson_description or ""}"

Task: Generate exactly {body.count} English practice questions.
{type_instr}

Format Requirements:
1. Output ONLY the questions, separated by new lines.
2. Do NOT include any numbering (1., 2., etc.) or bullet points.
3. Do NOT include any introductions like "Here are your questions:"."""

    try:
        raw = ask_groq(
            prompt, 
            max_tokens=400, 
            system="You are a strict curriculum generator. Follow the formatting rules exactly."
        )
        
        questions = []
        for line in raw.replace("\r", "\n").split("\n"):
            clean = line.strip().lstrip("-•*0123456789.) ")
            if len(clean) > 5:
                questions.append(clean)
                
        return {"questions": questions[:body.count]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


# ── AI DYNAMIC FLASHCARDS ──

class GenerateFlashcardsRequest(BaseModel):
    lesson_title: str
    lesson_description: Optional[str] = ""
    count: Optional[int] = 5

@router.post("/generate-flashcards")
def generate_flashcards(body: GenerateFlashcardsRequest, requester=Depends(require_authenticated_requester)):
    prompt = f"""Lesson Title: "{body.lesson_title}"
Description: "{body.lesson_description or ''}"

Generate exactly {body.count} short English learning flashcards.
Output ONLY a JSON array of objects. Example:
[
  {{"front": "Word or Phrase", "back": "Simple meaning in English"}}
]
Do NOT write any text before or after the array."""
    try:
        raw = ask_groq(
            prompt, 
            max_tokens=800, 
            system="You are a strict data generator. You only output valid JSON arrays. Do not use markdown blocks like ```json."
        )
        
        clean_json = raw.strip()
        
        # Hunt for the brackets just in case the AI added conversational text
        match = re.search(r'\[.*\]', clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        try:
            cards = json.loads(clean_json)
            return {"flashcards": cards[:body.count]}
        except json.JSONDecodeError:
            # If the AI completely messes up the format, give a friendly message instead of a crash
            raise ValueError("The AI did not format the cards correctly. Please try again.")
            
    except Exception as e:
        # We clean up the error message so the UI alert looks nicer
        error_msg = str(e).replace("AI service error: ", "")
        raise HTTPException(status_code=500, detail=error_msg)


# ── AI ANALYTICS ──

@router.get("/analysis/{student_id}")
def get_student_analysis(student_id: str, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
    from app.models.models import Student as StudentModel, Question as QuestionModel
    
    student = db.query(StudentModel).filter(StudentModel.id == student_id).first()
    progresses = student.progress if student else []
    lessons_total = len(progresses)
    lessons_completed = sum(1 for p in progresses if p.completed)

    # Auto-grade unchecked answers
    AUTO_GRADE_LIMIT = 15
    auto_graded = 0
    for p in progresses:
        for a in p.answers:
            if auto_graded >= AUTO_GRADE_LIMIT:
                break
            if a.text and a.text.strip() and not a.ai_score:
                q = db.query(QuestionModel).filter(QuestionModel.id == a.question_id).first()
                if not q:
                    continue
                try:
                    score, feedback_text = grade_answer(q, a.text)
                    a.ai_score = score
                    a.ai_feedback = feedback_text
                    auto_graded += 1
                except Exception:
                    continue
        if auto_graded >= AUTO_GRADE_LIMIT:
            break
            
    if auto_graded:
        db.commit()

    scored_answers = []
    recent_q_and_a = []
    
    for p in progresses:
        for a in p.answers:
            if a.text and a.text.strip():
                if a.ai_score:
                    scored_answers.append(a.ai_score)
                q = db.query(QuestionModel).filter(QuestionModel.id == a.question_id).first()
                recent_q_and_a.append(f"Q: {q.prompt if q else 'Question'}\nStudent's Answer: {a.text}\n")

    answered_count = sum(1 for p in progresses for a in p.answers if a.text and a.text.strip())
    correct_count  = sum(1 for s in scored_answers if s >= 3)
    avg_score      = round(sum(scored_answers) / len(scored_answers), 2) if scored_answers else 0
    accuracy_percentage = round((correct_count / len(scored_answers)) * 100) if scored_answers else 0

    stats = {
        "lessons_total": lessons_total, 
        "lessons_completed": lessons_completed, 
        "answered_count": answered_count,
        "scored_count": len(scored_answers), 
        "correct_count": correct_count, 
        "average_score": avg_score,
        "accuracy_percentage": accuracy_percentage, 
        "streak_days": student.streak_days if student else 0,
    }

    if len(scored_answers) == 0:
        if answered_count == 0:
            stats["ai_summary"] = f"{student.name} hasn't had any answers checked yet." 
        else:
            stats["ai_summary"] = "We couldn't check the answers right now — please try refreshing."
        return stats

    recent_context = "\n".join(recent_q_and_a[-5:])
    
    prompt = f"""Student name: {student.name}
Lessons completed: {lessons_completed} of {lessons_total}
Questions answered and AI-checked: {len(scored_answers)}
Average AI score (out of 5): {avg_score}
Accuracy (score >= 3 counted correct): {accuracy_percentage}%
Current streak: {student.streak_days or 0} days

Here is what the student has been writing recently:
{recent_context}

Write a short progress analysis (2-3 sentences) for this student. Be specific. Point out one strength and one gentle area to keep practising. Simple English."""
    
    try:
        stats["ai_summary"] = ask_groq(prompt, max_tokens=250)
    except Exception as e:
        stats["ai_summary"] = f"Could not generate AI summary right now ({str(e)})."
        
    return stats


@router.get("/class-analysis")
def get_class_analysis(db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    from app.models.models import Student as StudentModel
    
    students = db.query(StudentModel).all()
    progresses = db.query(Progress).all()
    answers = db.query(Answer).filter(Answer.text != "").all()

    total_students = len(students)
    total_lessons_completed = sum(1 for p in progresses if p.completed)
    total_answers = len(answers)
    
    scored_answers = [a.ai_score for a in answers if a.ai_score]
    avg_score = round(sum(scored_answers) / len(scored_answers), 2) if scored_answers else 0

    prompt = f"""You are an AI assistant for teachers.
Class Stats:
Total Students: {total_students}
Total Lessons Completed: {total_lessons_completed}
Total Answers Written: {total_answers}
Average Score (out of 5): {avg_score}

Write a short, professional summary (2-3 sentences) for the teacher about the class's overall engagement and performance."""
    
    try:
        summary = ask_groq(prompt, max_tokens=150)
    except Exception:
        summary = "Could not generate class summary at this time."
        
    return {
        "total_students": total_students, 
        "total_lessons_completed": total_lessons_completed, 
        "total_answers": total_answers, 
        "average_score": avg_score, 
        "ai_summary": summary
    }

@router.get("/predictive-flags")
def get_predictive_flags(db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    from app.models.models import Student as StudentModel
    import json
    
    students = db.query(StudentModel).all()
    class_data = []
    
    for s in students:
        total_hints = 0
        total_score = 0
        scored_answers = 0
        
        for p in s.progress:
            total_hints += (p.hint_count or 0)
            for a in p.answers:
                if a.ai_score and a.ai_score > 0:
                    total_score += a.ai_score
                    scored_answers += 1
                    
        avg_score = round(total_score / scored_answers, 1) if scored_answers > 0 else 0
        
        if scored_answers > 0:
            class_data.append({
                "student_name": s.name,
                "lessons_completed": sum(1 for p in s.progress if p.completed),
                "total_hints_used": total_hints,
                "average_score": avg_score
            })
            
    if not class_data:
        return {"flags": []}

    prompt = f"""You are an educational AI classifying student risk. 
Analyze the following student data and flag ANY student who meets these conditions:
1. Average score is 2.5 or lower.
2. OR they are using an unusually high number of hints compared to lessons completed (e.g., >3 hints per lesson).

Data:
{json.dumps(class_data)}

Return ONLY a valid JSON array of objects for the flagged students. If no one is flagged, return an empty array [].
Format:
[
  {{"student_name": "Name", "alert_level": "High/Medium", "reason": "Specific actionable reason."}}
]"""

    try:
        raw = ask_groq(prompt, max_tokens=500, system="You are a strict JSON data classifier.")
        
        # Clean up any potential markdown formatting from the AI
        clean_json = raw.strip()
        match = re.search(r'\[.*\]', clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        flags = json.loads(clean_json)
        return {"flags": flags}
    except Exception as e:
        return {"flags": [], "error": str(e)}

# ── AI QUICK-FIRE QUIZ ENDPOINT ──

class QuizRequest(BaseModel):
    lesson_id: str
    lesson_title: Optional[str] = ""
    lesson_description: Optional[str] = ""

@router.post("/quick-quiz")
def get_quick_quiz(body: QuizRequest, requester=Depends(require_authenticated_requester)):
    prompt = f"""Lesson Title: "{body.lesson_title}"
Description: "{body.lesson_description or ''}"

Generate exactly 3 fun, multiple-choice quiz questions to test understanding of this lesson.
Output ONLY a valid JSON array of objects in this exact format, with no markdown formatting or text outside the array:
[
  {{
    "question": "What is the main goal of...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option A"
  }}
]"""
    try:
        raw = ask_groq(prompt, max_tokens=600, system="You are a strict JSON data generator. Output only valid JSON.")
        clean_json = raw.strip()
        match = re.search(r'\[.*\]', clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        quiz_data = json.loads(clean_json)
        return {"quiz": quiz_data[:3]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")

# ════════════════════════════════════════════════════════════════════
#  APP RAIL FEATURES (Translator, Word Bank, Story Corner)
# ════════════════════════════════════════════════════════════════════

# ── SMART TRANSLATOR ──
class TranslateRequest(BaseModel):
    text: str
    target_language: str

@router.post("/translate")
def translate_text(body: TranslateRequest, requester=Depends(require_authenticated_requester)):
    prompt = f"""Translate this English text to {body.target_language}: "{body.text}"
    Return ONLY a JSON object in this format (no markdown, no other text):
    {{
        "translation": "The translated text in {body.target_language}",
        "grammar_tip": "A short, 1-2 sentence tip explaining the English grammar or idiom used in simple terms for a child."
    }}"""
    try:
        raw = ask_groq(prompt, max_tokens=300, system="You are a bilingual tutor. Output only valid JSON.")
        clean_json = raw.strip()
        match = re.search(r'\{.*\}', clean_json, re.DOTALL)
        if match: 
            clean_json = match.group(0)
        return json.loads(clean_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


# ── PERSONAL WORD BANK ──
class WordDefRequest(BaseModel):
    word: str

@router.post("/word-bank/define")
def define_word(body: WordDefRequest, requester=Depends(require_authenticated_requester)):
    prompt = f"""Provide a kid-friendly definition and a short example sentence for the English word: "{body.word}".
    Return ONLY a JSON object in this format (no markdown, no other text):
    {{
        "word": "{body.word}",
        "definition": "Simple meaning",
        "example": "A short, engaging example sentence."
    }}"""
    try:
        raw = ask_groq(prompt, max_tokens=200, system="You are an English teacher. Output only valid JSON.")
        clean_json = raw.strip()
        match = re.search(r'\{.*\}', clean_json, re.DOTALL)
        if match: 
            clean_json = match.group(0)
        return json.loads(clean_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dictionary failed: {str(e)}")


# ── SHORT STORY CORNER ──
class StoryRequest(BaseModel):
    topic: str

@router.post("/story")
def generate_story(body: StoryRequest, requester=Depends(require_authenticated_requester)):
    prompt = f"""Write a short, engaging 2-paragraph story for a school child about: "{body.topic}".
    Make the vocabulary age-appropriate but engaging.
    Return ONLY a JSON object in this format (no markdown, no other text):
    {{
        "title": "Story Title",
        "paragraphs": ["Paragraph 1 text", "Paragraph 2 text"]
    }}"""
    try:
        raw = ask_groq(prompt, max_tokens=600, system="You are a storyteller. Output only valid JSON.")
        clean_json = raw.strip()
        match = re.search(r'\{.*\}', clean_json, re.DOTALL)
        if match: 
            clean_json = match.group(0)
        return json.loads(clean_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Story generation failed: {str(e)}")
