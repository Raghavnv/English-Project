from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Admin
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production-please")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")
TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# A student receives a separate, short-lived signed token after login.  This
# keeps student routes protected without changing the existing admin login flow.
optional_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_student_access_token(student_id: str) -> str:
    return create_access_token({"sub": student_id, "role": "student"})


def get_current_requester(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    student_token: str | None = Header(default=None, alias="X-Student-Token"),
    db: Session = Depends(get_db),
):
    """Return the signed-in Admin or Student for protected platform routes."""
    token = credentials.credentials if credentials else student_token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please sign in again to continue.",
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        role = payload.get("role", "admin")
        if not subject:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    if role == "student":
        from app.models.models import Student
        requester = db.query(Student).filter(Student.id == subject).first()
    else:
        requester = db.query(Admin).filter(Admin.id == subject).first()
    if not requester:
        raise credentials_exception
    return requester


def require_student_or_admin(
    student_id: str,
    requester=Depends(get_current_requester),
):
    """Permit tutors to view their cohort and students to access only themselves."""
    from app.models.models import Student
    if isinstance(requester, Student) and requester.id != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your own progress.")
    return requester


def require_authenticated_requester(requester=Depends(get_current_requester)):
    """Use when an endpoint needs a signed-in user but has no student path id."""
    return requester


def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Admin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        admin_id: str = payload.get("sub")
        if not admin_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise credentials_exception
    return admin
