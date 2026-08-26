from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from app.database import get_db
from app.models.models import Student, Progress, Answer, Lesson, Question
from app.auth import create_student_access_token, get_current_admin, require_student_or_admin

router = APIRouter(prefix="/api/students", tags=["students"])


class StudentLogin(BaseModel):
    name: str
    school: str

    @field_validator("name", "school")
    @classmethod
    def required_trimmed_text(cls, value):
        value = value.strip()
        if not value or len(value) > 120:
            raise ValueError("Please enter a valid value.")
        return value


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
    
    # ── STREAK TRACKING ON LOGIN ──
    now = datetime.now(timezone.utc)
    last = student.last_active
    if last is None:
        student.streak_days = 1
    else:
        last_naive = last.replace(tzinfo=None) if last.tzinfo else last
        now_naive  = now.replace(tzinfo=None)
        delta = (now_naive.date() - last_naive.date()).days
        if delta == 1:
            student.streak_days = (student.streak_days or 0) + 1
        elif delta > 1:
            student.streak_days = 1
        # if delta == 0, keep current streak
    student.last_active = now

    db.commit()
    db.refresh(student)
    return {
        "id": student.id,
        "name": student.name,
        "school": student.school,
        "student_token": create_student_access_token(student.id),
        "streak_days": student.streak_days
    }


@router.get("/{student_id}/profile")
def get_student_profile(student_id: str, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    badges = []
    completed_lessons = sum(1 for p in student.progress if p.completed)
    
    if completed_lessons >= 1:
        badges.append({"id": "first_lesson", "name": "First Lesson", "icon": "🎓", "description": "Completed your first lesson!"})
    if completed_lessons >= 5:
        badges.append({"id": "five_lessons", "name": "High Five", "icon": "✋", "description": "Completed 5 lessons!"})
    
    streak = student.streak_days or 0
    if streak >= 3:
        badges.append({"id": "streak_3", "name": "On Fire", "icon": "🔥", "description": "Maintained a 3-day streak!"})
    if streak >= 7:
        badges.append({"id": "streak_7", "name": "Unstoppable", "icon": "☄️", "description": "Maintained a 7-day streak!"})
    
    has_perfect = False
    for p in student.progress:
        for a in p.answers:
            if a.ai_score and a.ai_score >= 5:
                has_perfect = True
                break
    if has_perfect:
        badges.append({"id": "perfect_score", "name": "Perfect 5", "icon": "🌟", "description": "Got a 5/5 on an AI check!"})
        
    return {
        "name": student.name,
        "school": student.school,
        "streak_days": streak,
        "badges": badges
    }


@router.get("/{student_id}/progress")
def get_student_progress(student_id: str, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
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
def save_progress(student_id: str, body: ProgressSave, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
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

    # ── AUTO-GRADE ON COMPLETION ──
    if progress.completed:
        from app.routers.ai import grade_answer
        AUTO_GRADE_LIMIT = 15
        graded = 0
        db.flush()
        answer_rows = db.query(Answer).filter(Answer.progress_id == progress.id).all()
        for a in answer_rows:
            if graded >= AUTO_GRADE_LIMIT:
                break
            if a.text and a.text.strip() and not a.ai_score:
                question = db.query(Question).filter(Question.id == a.question_id).first()
                if not question:
                    continue
                try:
                    score, feedback_text = grade_answer(question, a.text)
                    a.ai_score    = score
                    a.ai_feedback = feedback_text
                    graded       += 1
                except Exception:
                    continue

    # ── UPDATE STREAK ON PROGRESS SAVE ──
    now = datetime.now(timezone.utc)
    last = student.last_active
    if last is None:
        student.streak_days = 1
    else:
        last_naive = last.replace(tzinfo=None) if last.tzinfo else last
        now_naive  = now.replace(tzinfo=None)
        delta = (now_naive.date() - last_naive.date()).days
        if delta == 1:
            student.streak_days = (student.streak_days or 0) + 1
        elif delta > 1:
            student.streak_days = 1
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
def reset_lesson_progress(student_id: str, lesson_id: str, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
    progress = db.query(Progress).filter(
        Progress.student_id == student_id,
        Progress.lesson_id == lesson_id
    ).first()
    if progress:
        db.delete(progress)
        db.commit()
    return {"reset": True, "lesson_id": lesson_id}


@router.delete("/{student_id}/progress")
def reset_all_progress(student_id: str, class_lesson_ids: list[str] | None = None, db: Session = Depends(get_db), requester=Depends(require_student_or_admin)):
    q = db.query(Progress).filter(Progress.student_id == student_id)
    if class_lesson_ids:
        q = q.filter(Progress.lesson_id.in_(class_lesson_ids))
    q.delete(synchronize_session=False)
    db.commit()
    return {"reset": True}

@router.get("/heatmap-data")
def get_heatmap_data(db: Session = Depends(get_db), current_admin=Depends(get_current_admin)):
    students = db.query(Student).order_by(Student.name).all()
    lessons = db.query(Lesson).order_by(Lesson.order).all()
    
    heatmap = []
    for s in students:
        student_data = {
            "id": s.id, 
            "name": s.name, 
            "lessons": {}
        }
        for p in s.progress:
            scores = [a.ai_score for a in p.answers if a.ai_score and a.ai_score > 0]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0
            
            student_data["lessons"][p.lesson_id] = {
                "completed": p.completed,
                "answered_count": p.answered_count,
                "avg_score": avg_score,
                "hint_count": p.hint_count or 0,
                "time_spent": p.time_spent_seconds or 0
            }
        heatmap.append(student_data)
    
    return {
        "lessons": [{"id": l.id, "title": l.title} for l in lessons], 
        "students": heatmap
    }