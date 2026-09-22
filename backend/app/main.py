import logging
import os
import shutil
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from .auth import (
    create_access_token,
    get_current_user,
    get_current_user_optional,
    require_admin,
)
from .database import (
    DB_PATH,
    EVIDENCE_DIR,
    UPLOADS_DIR,
    get_db,
    hash_password,
    init_db,
)
from .duplicate import find_duplicate_complaints
from .inference import detect_road_damage
from .priority import calculate_priority, recalculate_complaint_priority
from .schemas import (
    AuthResponse,
    ComplaintCreate,
    ComplaintDetailResponse,
    ComplaintResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    EvidenceResponse,
    LoginRequest,
    PredictionResponse,
    RegisterRequest,
    StatisticsResponse,
    StatusUpdateRequest,
    UserInfo,
    VoteRequest,
    VoteResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Civic-Aegis Road Damage & Complaint API",
    description="Intelligent road damage detection and complaint prioritization system",
    version="2.0.0",
)

# Initialize database schema and seeds immediately on import
init_db()
logger.info("Civic-Aegis database initialized successfully at %s", DB_PATH)

# Mount outputs and uploads directories for static image access
OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
EVIDENCE_DIR.mkdir(exist_ok=True)

app.mount(
    "/outputs",
    StaticFiles(directory=str(OUTPUTS_DIR)),
    name="outputs",
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# SYSTEM & HEALTH ENDPOINTS (PRESERVED)
# =========================================================

@app.get("/")
def root():
    return {
        "message": "Road Damage Detection API is running",
        "system": "Civic-Aegis",
        "version": "2.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "connected" if DB_PATH.exists() else "uninitialized",
    }


# =========================================================
# ROAD DAMAGE DETECTION ENDPOINT (PRESERVED)
# =========================================================

@app.post(
    "/predict",
    response_model=PredictionResponse,
)
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        logger.warning("Invalid file type uploaded: %s", file.filename)
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file (JPG, PNG, WEBP).",
        )

    try:
        contents = await file.read()
        if not contents:
            logger.warning("Empty file uploaded: %s", file.filename)
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty.",
            )

        # Validate max size: 15 MB
        if len(contents) > 15 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="Image exceeds the 15MB file size limit.",
            )

        image = Image.open(BytesIO(contents)).convert("RGB")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Invalid image %s: %s", file.filename, e)
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image file.",
        )

    try:
        logger.info("Prediction requested for file: %s", file.filename)
        result = detect_road_damage(
            image,
            original_filename=file.filename or "image.jpg",
        )
    except Exception as e:
        logger.error("Prediction failed for %s: %s", file.filename, e)
        raise HTTPException(
            status_code=500,
            detail="Road damage detection failed.",
        )

    logger.info(
        "Prediction completed for %s. Detections: %d",
        file.filename,
        len(result["detections"]),
    )

    return {
        "filename": file.filename,
        "detections": result["detections"],
        "count": len(result["detections"]),
        "annotated_image": result["annotated_image"],
    }


# =========================================================
# AUTHENTICATION ENDPOINTS
# =========================================================

@app.post("/auth/register", response_model=AuthResponse)
def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    role = (payload.role or "user").strip().lower()
    if role not in ("user", "admin"):
        role = "user"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

        pwd_hash = hash_password(payload.password)
        cursor.execute(
            "INSERT INTO users (email, full_name, password_hash, role) VALUES (?, ?, ?, ?)",
            (email, payload.full_name.strip(), pwd_hash, role),
        )
        user_id = cursor.lastrowid

        token = create_access_token({"sub": user_id, "email": email, "role": role})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "full_name": payload.full_name.strip(),
                "role": role,
            },
        }


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    pwd_hash = hash_password(payload.password)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, full_name, role, password_hash FROM users WHERE email = ?",
            (email,),
        )
        user = cursor.fetchone()
        if not user or user["password_hash"] != pwd_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        if payload.expected_role and user["role"] != payload.expected_role.strip().lower():
            if user["role"] == "user":
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are registered as a User and cannot open the Admin Dashboard.",
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are registered as an Admin and cannot open the User Dashboard.",
                )

        token = create_access_token({"sub": user["id"], "email": user["email"], "role": user["role"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"],
            },
        }


@app.get("/auth/me", response_model=UserInfo)
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
    }


# =========================================================
# DUPLICATE COMPLAINT CHECK
# =========================================================

@app.post("/complaints/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate(payload: DuplicateCheckRequest):
    if not payload.location or not payload.location.strip():
        raise HTTPException(status_code=400, detail="Location is required for duplicate check.")

    with get_db() as conn:
        similar = find_duplicate_complaints(
            conn=conn,
            location=payload.location.strip(),
            damage_type=payload.damage_type.strip(),
            severity=payload.severity,
            latitude=payload.latitude,
            longitude=payload.longitude,
            threshold=0.50,
        )

    return {
        "found": len(similar) > 0,
        "count": len(similar),
        "similar_complaints": similar,
    }


# =========================================================
# COMPLAINT REGISTRATION & SEARCH
# =========================================================

@app.post("/complaints", response_model=ComplaintResponse)
def create_complaint(
    payload: ComplaintCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    if not payload.location or not payload.location.strip():
        raise HTTPException(status_code=400, detail="Location is required to register a complaint.")
    if not payload.damage_type or not payload.damage_type.strip():
        raise HTTPException(status_code=400, detail="Damage type is required.")

    # Calculate initial priority
    initial_score, initial_level = calculate_priority(
        severity=payload.severity,
        upvotes=0,
        downvotes=0,
        evidence_count=0,
        created_at=datetime.now(),
        status="Pending",
    )

    user_id = current_user["id"] if current_user else None
    user_name = current_user["full_name"] if current_user else (payload.user_name or "Anonymous Citizen")

    with get_db() as conn:
        cursor = conn.cursor()

        # Generate human-friendly complaint code: CA-YYYY-XXXX
        year = datetime.now().year
        cursor.execute("SELECT COUNT(*) FROM complaints")
        seq = cursor.fetchone()[0] + 1001
        complaint_code = f"CA-{year}-{seq}"

        cursor.execute(
            """
            INSERT INTO complaints (
                complaint_code, user_id, user_name, damage_type, severity,
                confidence, location, area, city, latitude, longitude,
                description, image_url, annotated_image_url, status,
                priority_level, priority_score, upvotes, downvotes, evidence_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 0, 0, 0)
            """,
            (
                complaint_code,
                user_id,
                user_name,
                payload.damage_type.strip(),
                payload.severity.strip() or "Medium",
                round(float(payload.confidence or 0.0), 4),
                payload.location.strip(),
                payload.area.strip() if payload.area else "",
                payload.city.strip() if payload.city else "",
                payload.latitude,
                payload.longitude,
                payload.description or "",
                payload.image_url,
                payload.annotated_image_url or payload.image_url,
                initial_level,
                initial_score,
            ),
        )
        complaint_id = cursor.lastrowid

        # Log to audit trail
        cursor.execute(
            """
            INSERT INTO complaint_history (complaint_id, action, performed_by, details)
            VALUES (?, 'Complaint Registered', ?, ?)
            """,
            (
                complaint_id,
                user_name,
                f"Registered complaint for {payload.damage_type} at {payload.location} (Initial Priority: {initial_level}, Score: {initial_score})",
            ),
        )

        cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
        new_complaint = dict(cursor.fetchone())

    return new_complaint


@app.get("/complaints", response_model=List[ComplaintResponse])
@app.get("/complaints/search", response_model=List[ComplaintResponse])
def search_complaints(
    location: Optional[str] = Query(None, description="Search location or area keyword"),
    status: Optional[str] = Query(None, description="Filter by complaint status"),
    priority: Optional[str] = Query(None, description="Filter by priority level"),
    damage_type: Optional[str] = Query(None, description="Filter by damage type"),
    sort: Optional[str] = Query("priority", description="Sort by 'priority', 'votes', or 'date'"),
    user_identifier: Optional[str] = Query(None, description="User identifier to fetch active vote"),
):
    query = "SELECT * FROM complaints WHERE 1=1"
    params = []

    if location and location.strip():
        loc_term = f"%{location.strip().lower()}%"
        query += " AND (LOWER(location) LIKE ? OR LOWER(area) LIKE ? OR LOWER(city) LIKE ?)"
        params.extend([loc_term, loc_term, loc_term])

    if status and status.strip() and status.lower() != "all":
        query += " AND LOWER(status) = ?"
        params.append(status.strip().lower())

    if priority and priority.strip() and priority.lower() != "all":
        query += " AND LOWER(priority_level) = ?"
        params.append(priority.strip().lower())

    if damage_type and damage_type.strip() and damage_type.lower() != "all":
        query += " AND LOWER(damage_type) LIKE ?"
        params.append(f"%{damage_type.strip().lower()}%")

    if sort == "votes":
        query += " ORDER BY (upvotes - downvotes) DESC, priority_score DESC"
    elif sort == "date":
        query += " ORDER BY created_at DESC"
    else:
        query += " ORDER BY priority_score DESC, created_at DESC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        complaints = [dict(r) for r in rows]

        if user_identifier:
            for c in complaints:
                cursor.execute(
                    "SELECT vote_type FROM complaint_votes WHERE complaint_id = ? AND user_identifier = ?",
                    (c["id"], user_identifier),
                )
                v = cursor.fetchone()
                c["user_vote"] = v["vote_type"] if v else None

    return complaints


@app.get("/complaints/{id}", response_model=ComplaintDetailResponse)
def get_complaint(id: int, user_identifier: Optional[str] = Query(None)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM complaints WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Complaint with ID {id} not found.")

        complaint = dict(row)

        if user_identifier:
            cursor.execute(
                "SELECT vote_type FROM complaint_votes WHERE complaint_id = ? AND user_identifier = ?",
                (id, user_identifier),
            )
            v = cursor.fetchone()
            complaint["user_vote"] = v["vote_type"] if v else None

        # Fetch evidence
        cursor.execute(
            "SELECT * FROM complaint_evidence WHERE complaint_id = ? ORDER BY created_at DESC",
            (id,),
        )
        complaint["evidence"] = [dict(e) for e in cursor.fetchall()]

        # Fetch history
        cursor.execute(
            "SELECT * FROM complaint_history WHERE complaint_id = ? ORDER BY timestamp DESC",
            (id,),
        )
        complaint["history"] = [dict(h) for h in cursor.fetchall()]

    return complaint


# =========================================================
# UPVOTE / DOWNVOTE SYSTEM
# =========================================================

@app.post("/complaints/{id}/vote", response_model=VoteResponse)
def vote_complaint(
    id: int,
    payload: VoteRequest,
    req: Request,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    # Determine unique user identifier
    if current_user:
        user_ident = f"user_{current_user['id']}"
        user_name = current_user["full_name"]
    elif payload.user_identifier:
        user_ident = payload.user_identifier.strip()
        user_name = "Citizen"
    else:
        # Fallback to client IP
        client_host = req.client.host if req.client else "unknown_client"
        user_ident = f"ip_{client_host}"
        user_name = "Citizen"

    new_vote = payload.vote_type.lower()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM complaints WHERE id = ?", (id,))
        complaint = cursor.fetchone()
        if not complaint:
            raise HTTPException(status_code=404, detail=f"Complaint with ID {id} not found.")

        # Check existing vote
        cursor.execute(
            "SELECT id, vote_type FROM complaint_votes WHERE complaint_id = ? AND user_identifier = ?",
            (id, user_ident),
        )
        existing_vote = cursor.fetchone()

        action_msg = ""
        active_user_vote = None

        if existing_vote:
            if existing_vote["vote_type"] == new_vote:
                # Toggle off: removing vote
                cursor.execute(
                    "DELETE FROM complaint_votes WHERE id = ?",
                    (existing_vote["id"],),
                )
                action_msg = f"Removed {new_vote}"
                active_user_vote = None
            else:
                # Switching vote from upvote to downvote or vice-versa
                cursor.execute(
                    "UPDATE complaint_votes SET vote_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (new_vote, existing_vote["id"]),
                )
                action_msg = f"Changed vote to {new_vote}"
                active_user_vote = new_vote
        else:
            # Insert new vote
            cursor.execute(
                """
                INSERT INTO complaint_votes (complaint_id, user_identifier, vote_type)
                VALUES (?, ?, ?)
                """,
                (id, user_ident, new_vote),
            )
            action_msg = f"Cast {new_vote}"
            active_user_vote = new_vote

        # Recalculate upvote and downvote counts from the source of truth
        cursor.execute(
            "SELECT COUNT(*) FROM complaint_votes WHERE complaint_id = ? AND vote_type = 'upvote'",
            (id,),
        )
        up_count = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM complaint_votes WHERE complaint_id = ? AND vote_type = 'downvote'",
            (id,),
        )
        down_count = cursor.fetchone()[0]

        cursor.execute(
            """
            UPDATE complaints
            SET upvotes = ?, downvotes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (up_count, down_count, id),
        )

        # Recalculate priority
        new_score, new_level = recalculate_complaint_priority(conn, id)

        # Record action in complaint history
        cursor.execute(
            """
            INSERT INTO complaint_history (complaint_id, action, performed_by, details)
            VALUES (?, 'Vote Updated', ?, ?)
            """,
            (id, user_name, f"{action_msg}. (Upvotes: {up_count}, Downvotes: {down_count}, Priority: {new_level}, Score: {new_score})"),
        )

    return {
        "complaint_id": id,
        "user_vote": active_user_vote,
        "upvotes": up_count,
        "downvotes": down_count,
        "priority_score": new_score,
        "priority_level": new_level,
        "message": action_msg,
    }


@app.get("/complaints/{id}/vote-status")
def get_vote_status(
    id: int,
    user_identifier: str = Query(...),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT vote_type FROM complaint_votes WHERE complaint_id = ? AND user_identifier = ?",
            (id, user_identifier),
        )
        row = cursor.fetchone()
        return {
            "complaint_id": id,
            "user_vote": row["vote_type"] if row else None,
        }


# =========================================================
# SUPPORTING EVIDENCE (IMAGE UPLOAD)
# =========================================================

@app.post("/complaints/{id}/evidence", response_model=EvidenceResponse)
async def upload_evidence(
    id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Query(""),
    user_name: Optional[str] = Query("Citizen Contributor"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    # Validate complaint exists
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, complaint_code FROM complaints WHERE id = ?", (id,))
        complaint = cursor.fetchone()
        if not complaint:
            raise HTTPException(status_code=404, detail=f"Complaint with ID {id} not found.")

    # Validate image MIME
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file (JPG, PNG, WEBP).",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Validate size: max 10MB
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Evidence image exceeds 10MB limit.")

    try:
        Image.open(BytesIO(contents)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupted image file.")

    # Save to uploads/evidence directory
    ext = Path(file.filename or "evidence.jpg").suffix or ".jpg"
    filename = f"evidence_{id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}{ext}"
    dest_path = EVIDENCE_DIR / filename
    with open(dest_path, "wb") as f:
        f.write(contents)

    image_url = f"/uploads/evidence/{filename}"
    user_ident = f"user_{current_user['id']}" if current_user else f"anon_{uuid.uuid4().hex[:6]}"
    submitter_name = current_user["full_name"] if current_user else (user_name or "Citizen Contributor")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO complaint_evidence (complaint_id, user_identifier, user_name, image_url, description)
            VALUES (?, ?, ?, ?, ?)
            """,
            (id, user_ident, submitter_name, image_url, description or ""),
        )
        evidence_id = cursor.lastrowid

        # Update evidence count
        cursor.execute(
            "SELECT COUNT(*) FROM complaint_evidence WHERE complaint_id = ?",
            (id,),
        )
        ev_count = cursor.fetchone()[0]

        cursor.execute(
            "UPDATE complaints SET evidence_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (ev_count, id),
        )

        # Recalculate priority (+10 points per evidence)
        new_score, new_level = recalculate_complaint_priority(conn, id)

        # Record in history
        cursor.execute(
            """
            INSERT INTO complaint_history (complaint_id, action, performed_by, details)
            VALUES (?, 'Evidence Added', ?, ?)
            """,
            (id, submitter_name, f"Attached supporting evidence image. (Priority updated to {new_level}, Score: {new_score})"),
        )

        cursor.execute("SELECT * FROM complaint_evidence WHERE id = ?", (evidence_id,))
        evidence_record = dict(cursor.fetchone())

    return evidence_record


@app.get("/complaints/{id}/evidence", response_model=List[EvidenceResponse])
def get_complaint_evidence(id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM complaint_evidence WHERE complaint_id = ? ORDER BY created_at DESC",
            (id,),
        )
        return [dict(r) for r in cursor.fetchall()]


@app.get("/complaints/{id}/download")
def download_complaint_report(id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM complaints WHERE id = ?", (id,))
        complaint = cursor.fetchone()
        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found.")

        cursor.execute(
            "SELECT * FROM complaint_evidence WHERE complaint_id = ? ORDER BY created_at DESC",
            (id,),
        )
        evidence = [dict(e) for e in cursor.fetchall()]

        cursor.execute(
            "SELECT * FROM complaint_history WHERE complaint_id = ? ORDER BY timestamp DESC",
            (id,),
        )
        history = [dict(h) for h in cursor.fetchall()]

        report = {
            "system": "Civic-Aegis Infrastructure Complaint Report",
            "generated_at": datetime.now().isoformat(),
            "complaint": dict(complaint),
            "evidence_submissions": evidence,
            "audit_trail": history,
        }

    return JSONResponse(
        content=report,
        headers={
            "Content-Disposition": f"attachment; filename=CivicAegis_Report_{complaint['complaint_code']}.json"
        },
    )


# =========================================================
# ADMIN ENDPOINTS
# =========================================================

@app.get("/admin/statistics", response_model=StatisticsResponse)
def get_admin_statistics(admin_user: Dict[str, Any] = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM complaints")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints WHERE LOWER(status) = 'pending'")
        pending = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints WHERE LOWER(status) = 'in progress'")
        in_progress = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints WHERE LOWER(status) = 'resolved'")
        resolved = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints WHERE LOWER(status) = 'under review'")
        under_review = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints WHERE LOWER(priority_level) = 'critical'")
        critical = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaints WHERE LOWER(priority_level) = 'high'")
        high = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaint_votes")
        total_votes = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM complaint_evidence")
        total_evidence = cursor.fetchone()[0]

    return {
        "total_complaints": total,
        "pending_complaints": pending,
        "in_progress_complaints": in_progress,
        "resolved_complaints": resolved,
        "under_review_complaints": under_review,
        "critical_priority_complaints": critical,
        "high_priority_complaints": high,
        "total_votes": total_votes,
        "total_evidence": total_evidence,
    }


@app.get("/admin/complaints", response_model=List[ComplaintResponse])
def get_admin_complaints(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    damage_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_admin),
):
    query = "SELECT * FROM complaints WHERE 1=1"
    params = []

    if status and status.lower() != "all":
        query += " AND LOWER(status) = ?"
        params.append(status.strip().lower())

    if priority and priority.lower() != "all":
        query += " AND LOWER(priority_level) = ?"
        params.append(priority.strip().lower())

    if damage_type and damage_type.lower() != "all":
        query += " AND LOWER(damage_type) LIKE ?"
        params.append(f"%{damage_type.strip().lower()}%")

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query += " AND (LOWER(location) LIKE ? OR LOWER(complaint_code) LIKE ? OR LOWER(damage_type) LIKE ?)"
        params.extend([term, term, term])

    # Admin view is always ordered by priority first (Critical -> High -> Medium -> Low), then score, then age
    query += " ORDER BY priority_score DESC, created_at DESC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


@app.patch("/admin/complaints/{id}/status", response_model=ComplaintResponse)
def update_complaint_status(
    id: int,
    payload: StatusUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_admin),
):
    new_status = payload.status.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM complaints WHERE id = ?", (id,))
        complaint = cursor.fetchone()
        if not complaint:
            raise HTTPException(status_code=404, detail=f"Complaint with ID {id} not found.")

        old_status = complaint["status"]

        cursor.execute(
            """
            UPDATE complaints
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_status, id),
        )

        # Recalculate priority with new status
        new_score, new_level = recalculate_complaint_priority(conn, id)

        # Log change to history
        notes_str = f" Notes: {payload.notes}" if payload.notes else ""
        cursor.execute(
            """
            INSERT INTO complaint_history (complaint_id, action, performed_by, details)
            VALUES (?, 'Status Updated', ?, ?)
            """,
            (
                id,
                admin_user["full_name"],
                f"Status changed from '{old_status}' to '{new_status}'.{notes_str} (Priority updated to {new_level}, Score: {new_score})",
            ),
        )

        cursor.execute("SELECT * FROM complaints WHERE id = ?", (id,))
        updated = dict(cursor.fetchone())

    return updated