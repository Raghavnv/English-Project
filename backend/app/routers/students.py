from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import Student, Progress, Answer, Lesson
from app.auth import get_current_admin

router = APIRouter(prefix="/api/students", tags=["students"])


class StudentLogin(BaseModel):
    name: str
    school: str


class AnswerIn(BaseModel):
    question_id: str
    text: str


class ProgressSave(BaseModel):
    lesson_id: str
    answers: list[AnswerIn]


def get_or_create_student(name: str, school: str, db: Session) -> Student:
    student = db.query(Student).filter(
        Student.name == name.strip(),
        Student.school == school.strip()
    ).first()
    if not student:
        student = Student(name=name.strip(), school=school.strip())
        db.add(student)
        db.flush()
    return student


@router.post("/login")
def student_login(body: StudentLogin, db: Session = Depends(get_db)):
    if not body.name.strip() or not body.school.strip():
        raise HTTPException(status_code=400, detail="Name and school are required")
    student = get_or_create_student(body.name, body.school, db)
    db.commit()
    db.refresh(student)
    return {"id": student.id, "name": student.name, "school": student.school}


@router.get("/{student_id}/progress")
def get_student_progress(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    result = {}
    for p in student.progress:
        answers_map = {}
        for a in p.answers:
            answers_map[a.question_id] = {"text": a.text, "ai_feedback": a.ai_feedback, "ai_score": a.ai_score or 0}
        result[p.lesson_id] = {
            "completed":      p.completed,
            "answered_count": p.answered_count,
            "answers":        answers_map
        }
    return result


@router.post("/{student_id}/progress")
def save_progress(student_id: str, body: ProgressSave, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    lesson = db.query(Lesson).filter(Lesson.id == body.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    progress = db.query(Progress).filter(
        Progress.student_id == student_id,
        Progress.lesson_id == body.lesson_id
    ).first()

    if not progress:
        progress = Progress(student_id=student_id, lesson_id=body.lesson_id)
        db.add(progress)
        db.flush()

    answered_count  = 0
    total_questions = len(lesson.questions)

    for ans_in in body.answers:
        text = ans_in.text.strip()
        if text:
            answered_count += 1
        existing = db.query(Answer).filter(
            Answer.progress_id == progress.id,
            Answer.question_id == ans_in.question_id
        ).first()
        if existing:
            existing.text = text
        else:
            db.add(Answer(progress_id=progress.id, question_id=ans_in.question_id, text=text))

    progress.answered_count = answered_count
    progress.completed = (answered_count >= total_questions and total_questions > 0)

    # ── UPDATE STREAK ──
    now = datetime.now(timezone.utc)
    last = student.last_active
    if last is None:
        student.streak_days = 1
    else:
        last_naive = last.replace(tzinfo=None) if last.tzinfo else last
        now_naive  = now.replace(tzinfo=None)
        delta = (now_naive.date() - last_naive.date()).days
        if delta == 0:
            pass  # same day, no change
        elif delta == 1:
            student.streak_days = (student.streak_days or 0) + 1
        else:
            student.streak_days = 1  # streak broken
    student.last_active = now
    db.commit()

    return {
        "lesson_id":      body.lesson_id,
        "answered_count": answered_count,
        "total":          total_questions,
        "completed":      progress.completed,
        "streak_days":    student.streak_days or 0
    }


@router.get("/")
def list_students(db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    students = db.query(Student).order_by(Student.name).all()
    return [
        {
            "id":                  s.id,
            "name":                s.name,
            "school":              s.school,
            "registered_at":       s.created_at.isoformat() if s.created_at else None,
            "lessons_total":       len(s.progress),
            "lessons_completed":   sum(1 for p in s.progress if p.completed),
            "streak_days":         s.streak_days or 0
        }
        for s in students
    ]


@router.delete("/{student_id}")
def delete_student(student_id: str, db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"message": "Student deleted"}


@router.delete("/{student_id}/progress/{lesson_id}")
def reset_lesson_progress(student_id: str, lesson_id: str, db: Session = Depends(get_db)):
    """Reset a student's progress for a specific lesson."""
    progress = db.query(Progress).filter(
        Progress.student_id == student_id,
        Progress.lesson_id == lesson_id
    ).first()
    if progress:
        db.delete(progress)
        db.commit()
    return {"reset": True, "lesson_id": lesson_id}


@router.delete("/{student_id}/progress")
def reset_all_progress(student_id: str, class_lesson_ids: list[str] | None = None, db: Session = Depends(get_db)):
    """Reset all progress for a student (optionally scoped to specific lesson IDs)."""
    q = db.query(Progress).filter(Progress.student_id == student_id)
    if class_lesson_ids:
        q = q.filter(Progress.lesson_id.in_(class_lesson_ids))
    q.delete(synchronize_session=False)
    db.commit()
    return {"reset": True}


@router.delete("/{student_id}/progress/{lesson_id}")
def reset_lesson_progress(student_id: str, lesson_id: str, db: Session = Depends(get_db)):
    progress = db.query(Progress).filter(
        Progress.student_id == student_id,
        Progress.lesson_id == lesson_id
    ).first()
    if progress:
        db.delete(progress)
        db.commit()
    return {"reset": True, "lesson_id": lesson_id}


@router.delete("/{student_id}/progress")
def reset_all_progress(student_id: str, db: Session = Depends(get_db)):
    db.query(Progress).filter(Progress.student_id == student_id).delete()
    db.commit()
    return {"reset": True}