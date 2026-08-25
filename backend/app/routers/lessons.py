from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.models import Admin, Class, Lesson, Question, Flashcard, FlashcardProgress
from app.auth import get_current_admin

router = APIRouter(prefix="/api/lessons", tags=["lessons"])

class QuestionIn(BaseModel):
    prompt: str
    type: Optional[str] = "text"
    difficulty: Optional[str] = "medium"
    order: Optional[int] = 0

class FlashcardIn(BaseModel):
    front: str
    back: str

class LessonIn(BaseModel):
    class_label: str
    title: str
    description: Optional[str] = ""
    order: Optional[int] = 0
    locked: Optional[bool] = False
    questions: Optional[list[QuestionIn]] = []
    flashcards: Optional[list[FlashcardIn]] = []

class FlashcardReview(BaseModel):
    student_id: str
    quality: int # 0-5 scale

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
        ],
        "flashcards": [
            {"id": f.id, "front": f.front, "back": f.back}
            for f in lesson.flashcards
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

@router.get("/{lesson_id}/flashcards/due")
def get_due_flashcards(lesson_id: str, student_id: str, db: Session = Depends(get_db)):
    flashcards = db.query(Flashcard).filter(Flashcard.lesson_id == lesson_id).all()
    now = datetime.utcnow()
    due_cards = []
    
    for fc in flashcards:
        prog = db.query(FlashcardProgress).filter_by(student_id=student_id, flashcard_id=fc.id).first()
        # If no progress exists, or the review date has passed
        if not prog or prog.next_review.replace(tzinfo=None) <= now:
            due_cards.append({"id": fc.id, "front": fc.front, "back": fc.back})
            
    return due_cards

@router.post("/flashcards/{flashcard_id}/review")
def review_flashcard(flashcard_id: str, body: FlashcardReview, db: Session = Depends(get_db)):
    prog = db.query(FlashcardProgress).filter_by(student_id=body.student_id, flashcard_id=flashcard_id).first()
    if not prog:
        prog = FlashcardProgress(student_id=body.student_id, flashcard_id=flashcard_id)
        db.add(prog)
    
    # SuperMemo-2 Spaced Repetition Algorithm Implementation
    if body.quality >= 3:
        if prog.repetitions == 0:
            prog.interval = 1
        elif prog.repetitions == 1:
            prog.interval = 6
        else:
            prog.interval = int(prog.interval * prog.ease)
        prog.repetitions += 1
        prog.ease = prog.ease + (0.1 - (5 - body.quality) * (0.08 + (5 - body.quality) * 0.02))
        if prog.ease < 1.3:
            prog.ease = 1.3
    else:
        prog.repetitions = 0
        prog.interval = 1
        
    prog.next_review = datetime.utcnow() + timedelta(days=prog.interval)
    db.commit()
    return {"status": "success", "next_review": prog.next_review}

@router.post("/", status_code=201)
def create_lesson(
    body: LessonIn,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    demo_admin = current_admin
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
        
    for f in body.flashcards:
        db.add(Flashcard(
            lesson_id=lesson.id,
            front=f.front.strip(),
            back=f.back.strip()
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
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
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
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    db.delete(lesson)
    db.commit()

@router.delete("/classes/{class_id}", status_code=204)
def delete_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    lessons_in_class = db.query(Lesson).filter(Lesson.class_id == class_id).all()
    for lesson in lessons_in_class:
        db.delete(lesson)
    db.delete(cls)
    db.commit()