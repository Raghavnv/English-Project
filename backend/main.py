from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.database import create_tables
from app.routers import auth, lessons, students, ai

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # This runs when the server starts
    create_tables()
    yield

app = FastAPI(
    title="EnglishBridge API",
    description="Backend for the EnglishBridge learning platform",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS — FIXED & READY ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Allows your frontend to connect
    allow_credentials=True,   # Required for Auth headers/cookies
    allow_methods=["*"],      # Allows GET, POST, DELETE, etc.
    allow_headers=["*"],      # Allows Authorization and Content-Type headers
)

# ── OPTIONAL: GLOBAL ERROR LOGGING ───────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"ERROR OCCURRED: {exc}") # This shows the real error in your terminal
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Check terminal logs."},
    )

# ── ROUTERS ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(lessons.router)
app.include_router(students.router)
app.include_router(ai.router)

@app.get("/")
def root():
    return {"message": "EnglishBridge API is running", "docs": "/docs", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}