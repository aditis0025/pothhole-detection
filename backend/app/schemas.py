from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


# =========================================================
# EXISTING SCHEMAS - PRESERVED UNMODIFIED
# =========================================================

class Detection(BaseModel):
    class_id: int
    damage_type: str
    severity: str
    confidence: float
    bbox: List[float]


class PredictionResponse(BaseModel):
    filename: str
    detections: List[Detection]
    count: int
    annotated_image: str


# =========================================================
# AUTH SCHEMAS
# =========================================================

class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role: Optional[str] = "user"


class LoginRequest(BaseModel):
    email: str
    password: str
    expected_role: Optional[str] = None


class UserInfo(BaseModel):
    id: int
    email: str
    full_name: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


# =========================================================
# COMPLAINT SCHEMAS
# =========================================================

class ComplaintCreate(BaseModel):
    damage_type: str
    severity: str
    confidence: Optional[float] = 0.0
    location: str
    area: Optional[str] = ""
    city: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = ""
    image_url: str
    annotated_image_url: Optional[str] = None
    user_name: Optional[str] = "Anonymous Citizen"


class ComplaintResponse(BaseModel):
    id: int
    complaint_code: str
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    damage_type: str
    severity: str
    confidence: float
    location: str
    area: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    image_url: str
    annotated_image_url: Optional[str] = None
    status: str
    priority_level: str
    priority_score: float
    upvotes: int
    downvotes: int
    evidence_count: int
    created_at: Any
    updated_at: Any
    user_vote: Optional[str] = None


class DuplicateCheckRequest(BaseModel):
    location: str
    damage_type: str
    severity: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DuplicateCheckResponse(BaseModel):
    found: bool
    count: int
    similar_complaints: List[Dict[str, Any]]


class VoteRequest(BaseModel):
    vote_type: str = Field(..., pattern="^(upvote|downvote)$")
    user_identifier: Optional[str] = None


class VoteResponse(BaseModel):
    complaint_id: int
    user_vote: Optional[str] = None
    upvotes: int
    downvotes: int
    priority_score: float
    priority_level: str
    message: str


class StatusUpdateRequest(BaseModel):
    status: str = Field(
        ...,
        pattern="^(Pending|Under Review|In Progress|Resolved|Rejected)$",
    )
    notes: Optional[str] = ""


class EvidenceResponse(BaseModel):
    id: int
    complaint_id: int
    user_identifier: str
    user_name: str
    image_url: str
    description: Optional[str] = None
    created_at: Any


class ComplaintDetailResponse(ComplaintResponse):
    evidence: List[EvidenceResponse] = []
    history: List[Dict[str, Any]] = []


class StatisticsResponse(BaseModel):
    total_complaints: int
    pending_complaints: int
    in_progress_complaints: int
    resolved_complaints: int
    under_review_complaints: int
    critical_priority_complaints: int
    high_priority_complaints: int
    total_votes: int
    total_evidence: int