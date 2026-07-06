from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
import uuid


def new_uuid():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── ADMIN ──────────────────────────────────────────────────────────────────
class Admin(Base):
    __tablename__ = "admins"

    id         = Column(String, primary_key=True, default=new_uuid)
    username   = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lessons = relationship("Lesson", back_populates="created_by", cascade="all, delete-orphan")


# ── STUDENT ─────────────────────────────────────────────────────────────────
class Student(Base):
    __tablename__ = "students"

    id         = Column(String, primary_key=True, default=new_uuid)
    name       = Column(String(120), nullable=False)
    school     = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Unique per name+school combination
    __table_args__ = (
        __import__("sqlalchemy").UniqueConstraint("name", "school", name="uq_student_name_school"),
    )

    streak_days  = Column(Integer, default=0)
    last_active  = Column(DateTime(timezone=True), nullable=True)

    progress = relationship("Progress", back_populates="student", cascade="all, delete-orphan")


# ── CLASS ───────────────────────────────────────────────────────────────────
class Class(Base):
    __tablename__ = "classes"

    id         = Column(String, primary_key=True, default=new_uuid)
    label      = Column(String(120), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lessons = relationship("Lesson", back_populates="cls", cascade="all, delete-orphan")


# ── LESSON ──────────────────────────────────────────────────────────────────
class Lesson(Base):
    __tablename__ = "lessons"

    id          = Column(String, primary_key=True, default=new_uuid)
    class_id    = Column(String, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    admin_id    = Column(String, ForeignKey("admins.id", ondelete="CASCADE"), nullable=False)
    title       = Column(String(200), nullable=False)
    description = Column(Text, default="")
    order       = Column(Integer, default=0)
    locked      = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    cls        = relationship("Class", back_populates="lessons")
    created_by = relationship("Admin", back_populates="lessons")
    questions  = relationship("Question", back_populates="lesson",
                              cascade="all, delete-orphan", order_by="Question.order")
    progress   = relationship("Progress", back_populates="lesson", cascade="all, delete-orphan")


# ── QUESTION ─────────────────────────────────────────────────────────────────
class Question(Base):
    __tablename__ = "questions"

    id        = Column(String, primary_key=True, default=new_uuid)
    lesson_id = Column(String, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    prompt    = Column(Text, nullable=False)
    type       = Column(String(20), default="text")   # "text" or "speech"
    difficulty = Column(String(10), default="medium")  # "easy", "medium", "hard"
    order      = Column(Integer, default=0)

    lesson  = relationship("Lesson", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")


# ── PROGRESS ─────────────────────────────────────────────────────────────────
class Progress(Base):
    __tablename__ = "progress"

    id           = Column(String, primary_key=True, default=new_uuid)
    student_id   = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    lesson_id    = Column(String, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    completed    = Column(Boolean, default=False)
    answered_count = Column(Integer, default=0)
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    student = relationship("Student", back_populates="progress")
    lesson  = relationship("Lesson", back_populates="progress")
    answers = relationship("Answer", back_populates="progress", cascade="all, delete-orphan")

    __table_args__ = (
        __import__("sqlalchemy").UniqueConstraint("student_id", "lesson_id", name="uq_progress_student_lesson"),
    )


# ── ANSWER ────────────────────────────────────────────────────────────────────
class Answer(Base):
    __tablename__ = "answers"

    id          = Column(String, primary_key=True, default=new_uuid)
    progress_id = Column(String, ForeignKey("progress.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    text        = Column(Text, default="")
    ai_feedback = Column(Text, default="")    # cached AI feedback
    ai_score    = Column(Integer, default=0)    # 1-5 score from AI
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    progress  = relationship("Progress", back_populates="answers")
    question  = relationship("Question", back_populates="answers")