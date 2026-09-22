import sqlite3
from datetime import datetime
from typing import Tuple

SEVERITY_WEIGHTS = {
    "High": 50.0,
    "Medium": 30.0,
    "Low": 15.0,
    "Unknown": 10.0,
}

UPVOTE_WEIGHT = 5.0
DOWNVOTE_WEIGHT = 3.0
EVIDENCE_WEIGHT = 10.0


def parse_datetime(dt_val) -> datetime:
    if isinstance(dt_val, datetime):
        return dt_val
    if not dt_val:
        return datetime.now()

    # Try common formats
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(dt_val)[:19], fmt)
        except ValueError:
            continue
    return datetime.now()


def calculate_priority(
    severity: str,
    upvotes: int,
    downvotes: int,
    evidence_count: int,
    created_at,
    status: str = "Pending",
) -> Tuple[float, str]:
    """
    Transparent Priority Calculation for Civic-Aegis:
    priority_score = severity_weight + (5 * upvotes) - (3 * downvotes) + (10 * evidence) + age_urgency

    Status adjustments:
      - Resolved complaints: score scaled down by 0.1 (floor priority)
      - Rejected complaints: score set to 0.0 (Low)

    Levels:
      - >= 80.0: Critical
      - >= 50.0: High
      - >= 25.0: Medium
      - < 25.0: Low
    """
    normalized_status = (status or "Pending").strip()

    if normalized_status.lower() == "rejected":
        return 0.0, "Low"

    # Base severity score
    sev_key = severity.capitalize() if severity else "Medium"
    base_severity = SEVERITY_WEIGHTS.get(sev_key, 25.0)

    # Citizen engagement contribution
    upvote_contrib = max(0, int(upvotes or 0)) * UPVOTE_WEIGHT
    downvote_contrib = max(0, int(downvotes or 0)) * DOWNVOTE_WEIGHT
    evidence_contrib = max(0, int(evidence_count or 0)) * EVIDENCE_WEIGHT

    # Age urgency contribution (for unresolved complaints, increases with age up to 30 points)
    created_dt = parse_datetime(created_at)
    age_days = max(0.0, (datetime.now() - created_dt).total_seconds() / 86400.0)

    if normalized_status.lower() == "resolved":
        # Resolved complaint priority is suppressed
        raw_score = (base_severity + upvote_contrib - downvote_contrib + evidence_contrib) * 0.1
        score = max(0.0, round(raw_score, 1))
        return score, "Low"

    age_urgency = min(age_days * 2.0, 30.0)

    raw_score = (
        base_severity
        + upvote_contrib
        - downvote_contrib
        + evidence_contrib
        + age_urgency
    )

    final_score = max(0.0, round(raw_score, 1))

    # Priority level mapping
    if final_score >= 80.0:
        level = "Critical"
    elif final_score >= 50.0:
        level = "High"
    elif final_score >= 25.0:
        level = "Medium"
    else:
        level = "Low"

    return final_score, level


def recalculate_complaint_priority(
    conn: sqlite3.Connection,
    complaint_id: int,
) -> Tuple[float, str]:
    """
    Recalculates and updates the priority_score and priority_level in the database for a complaint.
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT severity, upvotes, downvotes, evidence_count, created_at, status
        FROM complaints
        WHERE id = ?
        """,
        (complaint_id,),
    )
    row = cursor.fetchone()
    if not row:
        return 0.0, "Low"

    severity, upvotes, downvotes, evidence_count, created_at, status = (
        row["severity"],
        row["upvotes"],
        row["downvotes"],
        row["evidence_count"],
        row["created_at"],
        row["status"],
    )

    score, level = calculate_priority(
        severity=severity,
        upvotes=upvotes,
        downvotes=downvotes,
        evidence_count=evidence_count,
        created_at=created_at,
        status=status,
    )

    cursor.execute(
        """
        UPDATE complaints
        SET priority_score = ?, priority_level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (score, level, complaint_id),
    )

    return score, level

