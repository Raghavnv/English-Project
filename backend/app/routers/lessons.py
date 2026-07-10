from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import Admin, Class, Lesson, Question
from app.auth import get_current_admin

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


class QuestionIn(BaseModel):
    prompt: str
    type: Optional[str] = "text"
    difficulty: Optional[str] = "medium"
    order: Optional[int] = 0


class LessonIn(BaseModel):
    class_label: str
    title: str
    description: Optional[str] = ""
    order: Optional[int] = 0
    locked: Optional[bool] = False
    questions: Optional[list[QuestionIn]] = []


def get_or_create_class(label: str, db: Session) -> Class:
    cls = db.query(Class).filter(Class.label == label.strip()).first()
    if not cls:
        cls = Class(label=label.strip())
        db.add(cls)
        db.flush()
    return cls


def lesson_to_dict(lesson: Lesson) -> dict:
    return {
        "id":          lesson.id,
        "class_id":    lesson.class_id,
        "class_label": lesson.cls.label,
        "title":       lesson.title,
        "description": lesson.description,
        "created_at":  lesson.created_at.isoformat() if lesson.created_at else None,
        "order":       lesson.order,
        "locked":      lesson.locked,
        "questions": [
            {"id": q.id, "prompt": q.prompt, "type": q.type, "difficulty": q.difficulty, "order": q.order}
            for q in lesson.questions
        ]
    }


@router.get("/")
def get_all_lessons(db: Session = Depends(get_db)):
    lessons = db.query(Lesson).join(Lesson.cls).order_by(Class.label, Lesson.created_at).all()
    return [lesson_to_dict(l) for l in lessons]


@router.get("/classes")
def get_classes(db: Session = Depends(get_db)):
    classes = db.query(Class).order_by(Class.label).all()
    return [
        {"id": cls.id, "label": cls.label, "lessons": [lesson_to_dict(l) for l in cls.lessons]}
        for cls in classes
    ]


@router.get("/{lesson_id}")
def get_lesson(lesson_id: str, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson_to_dict(lesson)


@router.post("/", status_code=201)
def create_lesson(
    body: LessonIn,
    db: Session = Depends(get_db)
    # DEMO: get_current_admin removed — RESTORE before going live
):
    # DEMO: auto-use (or create) a placeholder admin since auth is disabled
    demo_admin = db.query(Admin).first()
    if not demo_admin:
        from app.auth import hash_password
        demo_admin = Admin(username="demo", password_hash=hash_password("demo-only-temp"))
        db.add(demo_admin)
        db.flush()

    cls = get_or_create_class(body.class_label, db)
    lesson = Lesson(
        class_id=cls.id,
        admin_id=demo_admin.id,
        title=body.title.strip(),
        description=body.description or "",
        order=body.order or 0,
        locked=body.locked or False
    )
    db.add(lesson)
    db.flush()

    for i, q in enumerate(body.questions):
        db.add(Question(
            lesson_id=lesson.id,
            prompt=q.prompt.strip(),
            type=q.type or "text",
            difficulty=q.difficulty or "medium",
            order=q.order if q.order is not None else i
        ))

    db.commit()
    db.refresh(lesson)
    return lesson_to_dict(lesson)


class LessonUpdate(BaseModel):
    locked: Optional[bool] = None
    order:  Optional[int]  = None

@router.patch("/{lesson_id}")
def update_lesson(
    lesson_id: str,
    body: LessonUpdate,
    db: Session = Depends(get_db)
    # DEMO: get_current_admin removed — RESTORE before going live
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if body.locked is not None:
        lesson.locked = body.locked
    if body.order is not None:
        lesson.order = body.order
    db.commit()
    db.refresh(lesson)
    return lesson_to_dict(lesson)


@router.delete("/{lesson_id}", status_code=204)
def delete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db)
    # DEMO: get_current_admin removed — RESTORE before going live
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    db.delete(lesson)
    db.commit()

@router.delete("/classes/{class_id}", status_code=204)
def delete_class(
    class_id: str,
    db: Session = Depends(get_db)
    # DEMO: get_current_admin removed — RESTORE before going live
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Safely delete all lessons associated with this class first
    # to prevent any Foreign Key constraint errors in the database
    lessons_in_class = db.query(Lesson).filter(Lesson.class_id == class_id).all()
    for lesson in lessons_in_class:
        db.delete(lesson)
        
    # Now delete the empty class
    db.delete(cls)
    db.commit()