import hashlib
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "cevic_aegis.db"
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
EVIDENCE_DIR = UPLOADS_DIR / "evidence"

UPLOADS_DIR.mkdir(exist_ok=True)
EVIDENCE_DIR.mkdir(exist_ok=True)


def hash_password(password: str, salt: str = "civic_aegis_secure_salt_2026") -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def get_db():
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all required tables and indexes if they do not exist."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        # Complaints table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_code TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                user_name TEXT DEFAULT 'Anonymous Citizen',
                damage_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                confidence REAL DEFAULT 0.0,
                location TEXT NOT NULL,
                area TEXT DEFAULT '',
                city TEXT DEFAULT '',
                latitude REAL,
                longitude REAL,
                description TEXT DEFAULT '',
                image_url TEXT NOT NULL,
                annotated_image_url TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                priority_level TEXT NOT NULL DEFAULT 'Medium',
                priority_score REAL NOT NULL DEFAULT 0.0,
                upvotes INTEGER NOT NULL DEFAULT 0,
                downvotes INTEGER NOT NULL DEFAULT 0,
                evidence_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            """
        )

        # Votes table (One active vote per user per complaint)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS complaint_votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id INTEGER NOT NULL,
                user_identifier TEXT NOT NULL,
                vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(complaint_id, user_identifier),
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
            );
            """
        )

        # Supporting evidence table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS complaint_evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id INTEGER NOT NULL,
                user_identifier TEXT NOT NULL,
                user_name TEXT DEFAULT 'Citizen Contributor',
                image_url TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
            );
            """
        )

        # Complaint history / audit trail
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS complaint_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                performed_by TEXT NOT NULL,
                details TEXT DEFAULT '',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
            );
            """
        )

        # Indexes for fast search and ranking
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority_score DESC);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints(location);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_votes_complaint_user ON complaint_votes(complaint_id, user_identifier);"
        )

        _seed_initial_data(conn)


def _seed_initial_data(conn: sqlite3.Connection):
    cursor = conn.cursor()

    # Ensure default Admin account exists for Admin Console access
    cursor.execute("SELECT id FROM users WHERE email = 'admin@civicaegis.com'")
    if not cursor.fetchone():
        cursor.execute(
            """
            INSERT INTO users (email, full_name, password_hash, role)
            VALUES (?, ?, ?, ?)
            """,
            (
                "admin@civicaegis.com",
                "Admin",
                hash_password("admin123"),
                "admin",
            ),
        )

