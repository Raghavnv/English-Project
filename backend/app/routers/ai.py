from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from groq import Groq
import os
from dotenv import load_dotenv
from app.database import get_db
from app.models.models import Question, Answer, Progress

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.1-8b-instant"

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


@router.post("/feedback")
def get_feedback(body: FeedbackRequest, db: Session = Depends(get_db)):
    question = get_question_or_404(body.question_id, db)

    if not body.answer_text.strip():
        return {"feedback": "Please write something first — even one sentence is a great start! 😊"}

    prompt = f"""The student was asked: "{question.prompt}"
Their answer was: "{body.answer_text}"

Give them short, kind feedback. Check:
1. Does it answer the question?
2. Any obvious grammar issue (mention at most one)
3. End with encouragement. 2 sentences maximum."""

    try:
        feedback_text = ask_groq(prompt, max_tokens=120)

        if body.progress_id:
            answer_row = db.query(Answer).filter(
                Answer.progress_id == body.progress_id,
                Answer.question_id == body.question_id
            ).first()
            if answer_row:
                answer_row.ai_feedback = feedback_text
                db.commit()

        return {"feedback": feedback_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/hint")
def get_hint(body: HintRequest, db: Session = Depends(get_db)):
    question = get_question_or_404(body.question_id, db)
    prompt = f"""Lesson topic: "{body.lesson_title}"
Question: "{question.prompt}"
Give a short helpful hint without giving away the answer. 1-2 sentences. Simple language for a school child."""
    try:
        return {"hint": ask_groq(prompt, max_tokens=100)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/guide")
def get_guide(body: GuideRequest, db: Session = Depends(get_db)):
    question = get_question_or_404(body.question_id, db)
    prompt = f"""Lesson topic: "{body.lesson_title}"
Question: "{question.prompt}"
Explain what this question is asking in very simple English for a young student in India. 2 sentences max."""
    try:
        return {"guide": ask_groq(prompt, max_tokens=120)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/encouragement")
def get_encouragement():
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


# ── GENERATE QUESTIONS (Admin) ────────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    lesson_title: str
    lesson_description: Optional[str] = ""
    class_label: Optional[str] = ""
    count: Optional[int] = 5
    question_type: Optional[str] = "text"  # "text", "speech", or "mix"

@router.post("/generate-questions")
def generate_questions(body: GenerateQuestionsRequest):
    qtype = (body.question_type or "text").lower()

    if qtype == "speech":
        type_instructions = """- All questions must be SPEECH questions: open-ended prompts that encourage the student to SPEAK aloud
- Questions should ask students to describe, tell a story, share an opinion, or explain something verbally
- Use prompts like "Tell me about...", "Describe...", "What do you think about...", "Can you explain..."
- Output ONLY the questions, one per line, no labels, no preamble"""
    elif qtype == "mix":
        type_instructions = """- Generate a MIX of text and speech questions
- For TEXT questions, prefix the line with "TEXT: "
- For SPEECH questions, prefix the line with "SPEECH: "
- Speech questions should be open-ended verbal prompts (describe, tell, explain, share opinion)
- Text questions should ask students to write sentences, fill in the blank, or give short written answers
- Alternate between types, roughly half and half
- Output ONLY the prefixed questions, one per line, no preamble"""
    else:
        type_instructions = """- All questions must be TEXT questions: ask students to write sentences, give written answers, or complete writing tasks
- Mix styles: describe, explain, write a sentence using a word, share written opinions
- Output ONLY the questions, one per line, no labels, no preamble"""

    prompt = f"""You are creating English lesson questions for school children in Bangalore, India.

Lesson Title: "{body.lesson_title}"
Class / Level: "{body.class_label or 'General'}"
Description: "{body.lesson_description or 'No description provided'}"

Generate exactly {body.count} questions for this lesson. Rules:
- Questions should be age-appropriate and encourage English practice
- Simple, clear language that Indian school children can understand
- Each question should be 1-2 sentences only
{type_instructions}
- No numbers, no bullets, no dashes unless prefixing with TEXT: or SPEECH:"""

    try:
        raw = ask_groq(prompt, max_tokens=400, system="You are a helpful assistant that outputs only the requested content, nothing else.")
        questions = [
            line.strip().lstrip("-•*0123456789.) ")
            for line in raw.split("\n")
            if line.strip() and len(line.strip()) > 10
        ]
        questions = questions[:body.count]
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


# ── STUDENT AI CHAT ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    lesson_title: Optional[str] = ""
    student_name: Optional[str] = ""

@router.post("/chat")
def chat_with_tutor(body: ChatRequest):
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
- Only discuss topics related to English learning, the lesson, or general school topics
- If asked about something off-topic, gently steer back to English learning
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
def get_relearn_content(body: RelearnRequest, db: Session = Depends(get_db)):
    """Generate a comprehensive, student-friendly lesson recap powered by AI."""
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

Create a friendly, engaging lesson recap for a school child in Bangalore. Structure it as:
1. A brief "What you'll learn" intro (1-2 sentences)
2. "Key Concepts" - 3-4 bullet points of the main ideas, each explained simply
3. "Helpful Examples" - 2-3 concrete examples or sample sentences
4. "Quick Tips" - 2-3 short tips to help answer the lesson questions well

Use simple English. Be warm and encouraging. Format with clear sections using these exact headers:
WHAT YOU WILL LEARN
KEY CONCEPTS
HELPFUL EXAMPLES
QUICK TIPS"""

    try:
        content = ask_groq(
            prompt,
            max_tokens=600,
            system="You are a warm, engaging English teacher for school children in India. Format your response clearly with the exact section headers provided. Use simple language and be encouraging."
        )
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")