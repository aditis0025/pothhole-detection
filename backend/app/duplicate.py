import math
import re
import sqlite3
from typing import Any, Dict, List, Optional

DAMAGE_CATEGORIES = {
    "pothole": "pothole",
    "pothole deep": "pothole",
    "alligator crack": "crack",
    "alligator crack sunken": "crack",
    "longitudinal crack": "crack",
    "longitudinal crack wide": "crack",
    "transverse crack": "crack",
    "transverse crack wide": "crack",
}


def _tokenize(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    stop_words = {"in", "at", "on", "near", "the", "and", "of", "to", "by", "is"}
    tokens = {t for t in cleaned.split() if len(t) > 1 and t not in stop_words}
    return tokens


def _compute_location_similarity(loc1: str, loc2: str) -> float:
    if not loc1 or not loc2:
        return 0.0

    l1 = loc1.strip().lower()
    l2 = loc2.strip().lower()

    if l1 == l2:
        return 1.0

    if l1 in l2 or l2 in l1:
        return 0.85

    tokens1 = _tokenize(l1)
    tokens2 = _tokenize(l2)

    if not tokens1 or not tokens2:
        return 0.0

    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)

    if not union:
        return 0.0

    jaccard = len(intersection) / len(union)

    # Overlap relative to the smaller set (captures "Shyam Nagar" inside "Kanpur, Shyam Nagar, GT Road")
    overlap_min = len(intersection) / min(len(tokens1), len(tokens2))

    return max(jaccard, overlap_min * 0.8)


def _compute_damage_similarity(type1: str, type2: str) -> float:
    if not type1 or not type2:
        return 0.0

    t1 = type1.strip().lower()
    t2 = type2.strip().lower()

    if t1 == t2:
        return 1.0

    cat1 = DAMAGE_CATEGORIES.get(t1, t1)
    cat2 = DAMAGE_CATEGORIES.get(t2, t2)

    if cat1 == cat2:
        return 0.75

    return 0.15


def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def find_duplicate_complaints(
    conn: sqlite3.Connection,
    location: str,
    damage_type: str,
    severity: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    threshold: float = 0.50,
) -> List[Dict[str, Any]]:
    """
    Finds potentially duplicate or similar existing complaints based on:
    - Location text / token matching
    - Road damage type / category matching
    - GPS proximity (if coordinates provided)
    - Complaint status (prioritizing open complaints)
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, complaint_code, user_name, damage_type, severity, confidence,
               location, area, city, latitude, longitude, description,
               image_url, annotated_image_url, status, priority_level, priority_score,
               upvotes, downvotes, evidence_count, created_at, updated_at
        FROM complaints
        ORDER BY created_at DESC
        """
    )
    rows = cursor.fetchall()

    matches = []

    for row in rows:
        reasons = []

        # 1. Location similarity
        loc_score = _compute_location_similarity(location, row["location"])

        # GPS proximity bonus
        gps_score = 0.0
        has_gps = False
        if (
            latitude is not None
            and longitude is not None
            and row["latitude"] is not None
            and row["longitude"] is not None
        ):
            has_gps = True
            dist_m = _haversine_distance_m(
                latitude, longitude, row["latitude"], row["longitude"]
            )
            if dist_m < 100:
                gps_score = 1.0
                reasons.append(f"Within {int(dist_m)}m GPS proximity")
            elif dist_m < 300:
                gps_score = 0.85
                reasons.append(f"Within {int(dist_m)}m GPS proximity")
            elif dist_m < 600:
                gps_score = 0.65
                reasons.append(f"Within {int(dist_m)}m GPS proximity")
            elif dist_m < 1200:
                gps_score = 0.40
            else:
                gps_score = 0.0

        effective_loc_score = max(loc_score, gps_score) if has_gps else loc_score
        if loc_score >= 0.7:
            reasons.append(f"Matching area / location ({row['location']})")

        # 2. Damage type similarity
        dmg_score = _compute_damage_similarity(damage_type, row["damage_type"])
        if dmg_score >= 0.75:
            reasons.append(f"Similar damage: {row['damage_type']}")

        # 3. Severity similarity
        sev_score = 0.5
        if severity and row["severity"]:
            if severity.lower() == row["severity"].lower():
                sev_score = 1.0
            else:
                sev_score = 0.4

        # Calculate composite similarity
        if has_gps and gps_score > 0.5:
            composite = 0.45 * gps_score + 0.35 * dmg_score + 0.20 * effective_loc_score
        else:
            composite = 0.55 * effective_loc_score + 0.30 * dmg_score + 0.15 * sev_score

        # Status penalty: resolved or rejected complaints have similarity discounted
        status_norm = (row["status"] or "").lower()
        if status_norm in ("resolved", "rejected"):
            composite *= 0.6
        else:
            reasons.append(f"Active complaint: {row['status']}")

        similarity_pct = round(composite * 100, 1)

        # Match threshold check
        if composite >= threshold:
            match_dict = dict(row)
            match_dict["similarity_score"] = similarity_pct
            match_dict["match_reasons"] = reasons
            matches.append(match_dict)

    # Sort matches by similarity descending, then priority score descending
    matches.sort(
        key=lambda m: (m["similarity_score"], m["priority_score"]),
        reverse=True,
    )

    return matches

