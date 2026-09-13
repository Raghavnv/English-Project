from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.models import Admin, Student, Quiz, QuizQuestion, QuizProgress
from app.auth import get_current_admin

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])

class QuizQuestionIn(BaseModel):
    prompt: str
    type: Optional[str] = "text"
    order: Optional[int] = 0

class QuizIn(BaseModel):
    title: str
    description: Optional[str] = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    time_limit_minutes: Optional[int] = 30
    questions: List[QuizQuestionIn] = []

def quiz_to_dict(quiz: Quiz, student_id: str = None, db: Session = None):
    data = {
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "start_time": quiz.start_time.isoformat() if quiz.start_time else None,
        "end_time": quiz.end_time.isoformat() if quiz.end_time else None,
        "time_limit_minutes": quiz.time_limit_minutes,
        "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
        "questions": [
            {"id": q.id, "prompt": q.prompt, "type": q.type, "order": q.order}
            for q in quiz.questions
        ]
    }
    if student_id and db:
        prog = db.query(QuizProgress).filter_by(student_id=student_id, quiz_id=quiz.id).first()
        if prog:
            data["progress"] = {
                "completed": prog.completed,
                "score": prog.score,
                "started_at": prog.started_at.isoformat() if prog.started_at else None,
                "completed_at": prog.completed_at.isoformat() if prog.completed_at else None
            }
        else:
            data["progress"] = None
    return data

@router.get("/")
def get_all_quizzes(student_id: Optional[str] = None, db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).order_by(Quiz.created_at.desc()).all()
    return [quiz_to_dict(q, student_id=student_id, db=db) for q in quizzes]

@router.get("/{quiz_id}")
def get_quiz(quiz_id: str, student_id: Optional[str] = None, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz_to_dict(quiz, student_id=student_id, db=db)

@router.post("/", status_code=201)
def create_quiz(
    body: QuizIn,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    demo_admin = current_admin
    if not demo_admin:
        from app.auth import hash_password
        demo_admin = Admin(username="demo", password_hash=hash_password("demo-only-temp"))
        db.add(demo_admin)
        db.flush()

    quiz = Quiz(
        admin_id=demo_admin.id,
        title=body.title.strip(),
        description=body.description or "",
        start_time=body.start_time,
        end_time=body.end_time,
        time_limit_minutes=body.time_limit_minutes
    )
    db.add(quiz)
    db.flush()

    for i, q in enumerate(body.questions):
        db.add(QuizQuestion(
            quiz_id=quiz.id,
            prompt=q.prompt.strip(),
            type=q.type or "text",
            order=q.order if q.order is not None else i
        ))

    db.commit()
    db.refresh(quiz)
    return quiz_to_dict(quiz)

class QuizSubmit(BaseModel):
    student_id: str
    score: int
    started_at: datetime
    completed_at: datetime

@router.post("/{quiz_id}/submit")
def submit_quiz(quiz_id: str, body: QuizSubmit, db: Session = Depends(get_db)):
    prog = db.query(QuizProgress).filter_by(student_id=body.student_id, quiz_id=quiz_id).first()
    if not prog:
        prog = QuizProgress(student_id=body.student_id, quiz_id=quiz_id)
        db.add(prog)
    
    prog.score = body.score
    prog.completed = True
    prog.started_at = body.started_at
    prog.completed_at = body.completed_at
    db.commit()
    return {"status": "success"}

@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(
    quiz_id: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()
