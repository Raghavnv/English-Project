from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from groq import Groq
import os
from dotenv import load_dotenv
from app.database import get_db
from app.models.models import Question, Answer, Progress, Student
from app.auth import get_current_admin, require_authenticated_requester, require_student_or_admin

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama3-8b-8192"

router = APIRouter(prefix="/api/ai", tags=["ai"])

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
    import json, re
    try:
        parsed        = json.loads(raw)
        score         = int(parsed.get("score", 3))
        feedback_text = parsed.get("feedback", raw)
    except Exception:
        m = re.search(r'"score"\s*:\s*(\d)', raw)
        score = int(m.group(1)) if m else 3
        fm = re.search(r'"feedback"\s*:\s*"(.+?)"', raw, re.S)
        feedback_text = fm.group(1) if fm else raw

    score = max(1, min(5, score))
    return score, feedback_text

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
                answer_row.ai_score    = score
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
    import random
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

# ── STUDENT AI CHAT ───────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
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
            messages.append({
                "role": "user" if msg.role == "user" else "assistant",
                "content": msg.content
            })

        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=200,
            messages=messages
        )
        return {"reply": response.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# ── RE-LEARN (Student) ────────────────────────────────────────────────────────
class RelearnRequest(BaseModel):
    lesson_id: str
    lesson_title: Optional[str] = ""
    lesson_description: Optional[str] = ""

@router.post("/relearn")
def get_relearn_content(body: RelearnRequest, db: Session = Depends(get_db), requester=Depends(require_authenticated_requester)):
    from app.models.models import Lesson, Question as QuestionModel
    lesson_questions = db.query(QuestionModel).filter(
        QuestionModel.lesson_id == body.lesson_id
    ).all() if body.lesson_id else []

    questions_context = ""
    if lesson_questions:
        prompts = [f"- {q.prompt}" for q in lesson_questions[:5]]
        questions_context = "\nThe lesson includes questions like:\n" + "\n".join(prompts)

    prompt = f"""Lesson Title: "{body.lesson_title}"
Description: "{body.lesson_description or 'No description provided'}"
{questions_context}

Create a friendly lesson recap for a school child in Bangalore. Use EXACTLY these section headers:
WHAT YOU WILL LEARN
KEY CONCEPTS
HELPFUL EXAMPLES
QUICK TIPS

Each section: 2-4 bullet points. Simple English. Be warm and encouraging."""

    try:
        content = ask_groq(prompt, max_tokens=600,
            system="You are a warm English teacher for school children in India. Use the exact section headers provided. Simple language, be encouraging.")
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# ── GENERATE QUESTIONS WITH TYPE ─────────────────────────────────────────────
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
Level: "{body.class_label or 'General'}"
Description: "{body.lesson_description or ''}"

Task: Generate exactly {body.count} English practice questions.
{type_instr}

Format Requirements:
1. Output ONLY the questions, separated by new lines.
2. Do NOT include any numbering (1., 2., etc.) or bullet points.
3. Do NOT include any introductions like 'Here are your questions:'."""

    try:
        raw = ask_groq(prompt, max_tokens=400,
            system="You are a strict curriculum generator. Follow the formatting rules exactly.")
        
        questions = []
        for line in raw.replace("\r", "\n").split("\n"):
            # Clean up the line by removing stray markdown, numbers, or bullets
            clean = line.strip().lstrip("-•*0123456789.) ")
            if len(clean) > 5:  # Reduced length threshold to be more forgiving
                questions.append(clean)
        
        # Ensure we only return up to the requested count
        questions = questions[:body.count]
        
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@router.get("/analysis/{student_id}")
def get_student_analysis(student_id: str, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
    from app.models.models import Student as StudentModel
    from app.models.models import Question as QuestionModel

    student = db.query(StudentModel).filter(StudentModel.id == student_id).first()
    progresses = student.progress if student else []
    
    lessons_total     = len(progresses)
    lessons_completed = sum(1 for p in progresses if p.completed)

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
                    a.ai_score    = score
                    a.ai_feedback = feedback_text
                    auto_graded  += 1
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
                q_text = q.prompt if q else "Question"
                recent_q_and_a.append(f"Q: {q_text}\nStudent's Answer: {a.text}\n")

    answered_count = sum(1 for p in progresses for a in p.answers if a.text and a.text.strip())
    correct_count  = sum(1 for s in scored_answers if s >= 3)
    avg_score      = round(sum(scored_answers) / len(scored_answers), 2) if scored_answers else 0
    accuracy_percentage = round((correct_count / len(scored_answers)) * 100) if scored_answers else 0

    stats = {
        "lessons_total":       lessons_total,
        "lessons_completed":   lessons_completed,
        "answered_count":      answered_count,
        "scored_count":        len(scored_answers),
        "correct_count":       correct_count,
        "average_score":       avg_score,
        "accuracy_percentage": accuracy_percentage,
        "streak_days":         student.streak_days if student else 0,
    }

    if len(scored_answers) == 0:
        if answered_count > 0:
            stats["ai_summary"] = (
                f"{student.name} has written {answered_count} answer{'s' if answered_count != 1 else ''}, "
                "but we couldn't check them with the AI tutor just now — please try refreshing this analysis again."
            )
        else:
            stats["ai_summary"] = (
                f"{student.name} hasn't answered any questions yet. "
                "Encourage them to start a lesson and write an answer to begin tracking progress!"
            )
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

Write a short progress analysis (2-3 sentences) for this student's teacher/parent AND the student to read.
Be specific by referencing the actual content of their answers above. Be warm and encouraging. Point out one strength and, if accuracy is below 70%, one gentle area to keep practising. Simple English."""

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

Write a short, professional summary (2-3 sentences) for the teacher about the class's overall engagement and performance. Be encouraging but grounded in these numbers."""
    
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