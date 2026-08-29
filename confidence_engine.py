"""
Conflict detection + confidence scoring.

This is intentionally NOT an LLM call — per the spec, matching/confidence should
be transparent, auditable math, not a model. The LLM's job (separate, not built
here yet) is upstream: turning messy text into the claims that feed this engine,
and later turning conflicts into plain-language explanations.

Usage:
    python confidence_engine.py report      # print a confidence/conflict report for every school
    python confidence_engine.py detect       # (re)detect conflicts and store them in the conflicts table
"""

import sqlite3
import sys
from datetime import date, datetime
from db import DB_PATH

NUMERIC_CONFLICT_THRESHOLD = 0.15  # >15% relative difference on a numeric field = conflict


def _relative_diff(a: float, b: float) -> float:
    if a == 0 and b == 0:
        return 0.0
    return abs(a - b) / max(abs(a), abs(b))


def detect_conflicts(conn: sqlite3.Connection):
    """Scan all (school, field_name) groups and populate the conflicts table."""
    cur = conn.cursor()
    cur.execute("DELETE FROM conflicts")  # recompute fresh each time — cheap for MVP scale

    rows = cur.execute(
        """SELECT id, school_id, field_name, value_text, value_numeric
           FROM claims ORDER BY school_id, field_name"""
    ).fetchall()

    groups = {}
    for claim_id, school_id, field_name, value_text, value_numeric in rows:
        key = (school_id, field_name)
        groups.setdefault(key, []).append(
            {"id": claim_id, "value_text": value_text, "value_numeric": value_numeric}
        )

    conflict_count = 0
    for (school_id, field_name), claims in groups.items():
        for i in range(len(claims)):
            for j in range(i + 1, len(claims)):
                a, b = claims[i], claims[j]
                is_conflict = False
                note = ""

                if a["value_numeric"] is not None and b["value_numeric"] is not None:
                    diff = _relative_diff(a["value_numeric"], b["value_numeric"])
                    if diff > NUMERIC_CONFLICT_THRESHOLD:
                        is_conflict = True
                        note = f"Numeric values differ by {diff:.0%} ({a['value_text']} vs {b['value_text']})"
                else:
                    # Text comparison — deliberately dumb (exact match only).
                    # Recognizing "we provide buses" == "school transportation available" as
                    # the SAME claim is semantic matching — that's an LLM job, not this engine's.
                    norm_a = a["value_text"].strip().lower()
                    norm_b = b["value_text"].strip().lower()
                    if norm_a != norm_b:
                        is_conflict = True
                        note = f"Text values differ: '{a['value_text']}' vs '{b['value_text']}'"

                if is_conflict:
                    cur.execute(
                        """INSERT INTO conflicts (school_id, field_name, claim_id_a, claim_id_b, note)
                           VALUES (?, ?, ?, ?, ?)""",
                        (school_id, field_name, a["id"], b["id"], note),
                    )
                    conflict_count += 1

    conn.commit()
    return conflict_count


def _days_since(source_date_str: str) -> int:
    try:
        d = datetime.strptime(source_date_str, "%Y-%m-%d").date()
        return (date.today() - d).days
    except ValueError:
        return 9999  # unparseable date = treat as very stale


def compute_confidence(conn: sqlite3.Connection, school_id: int, field_name: str):
    """
    Returns (tier, score, reason) for a given school + field.
    tier is one of: 'Unknown' (🔴), 'Uncertain' (🟡), 'Supported' (🟢)
    """
    cur = conn.cursor()
    claims = cur.execute(
        """SELECT c.id, c.value_text, c.value_numeric, c.source_date, s.type, s.base_reliability
           FROM claims c JOIN sources s ON c.source_id = s.id
           WHERE c.school_id = ? AND c.field_name = ?""",
        (school_id, field_name),
    ).fetchall()

    if not claims:
        return "Unknown", 0, "No evidence found for this field."

    n_conflicts = cur.execute(
        "SELECT COUNT(*) FROM conflicts WHERE school_id = ? AND field_name = ?",
        (school_id, field_name),
    ).fetchone()[0]

    distinct_source_types = set(c[4] for c in claims)
    most_recent_days = min(_days_since(c[3]) for c in claims)
    avg_reliability = sum(c[5] for c in claims) / len(claims)

    if n_conflicts > 0:
        # Disagreement caps confidence regardless of how many sources — this is the
        # "confidence does not mean truth" rule from the spec (Section 14 in the plan).
        score = min(55, round(30 + 10 * len(distinct_source_types)))
        reason = f"{n_conflicts} conflicting claim(s) found across {len(distinct_source_types)} source type(s) — shown as uncertain until resolved."
        return "Uncertain", score, reason

    # No conflict: reward corroboration, recency, and source reliability.
    score = 25
    score += min(30, 15 * (len(distinct_source_types) - 1))  # +15 per corroborating source type beyond the first, capped
    score += 20 * avg_reliability
    if most_recent_days <= 182:
        score += 15
    elif most_recent_days <= 365:
        score += 5
    score = min(95, round(score))

    if score >= 70:
        tier = "Supported"
    elif score >= 40:
        tier = "Uncertain"
    else:
        tier = "Uncertain"  # low-corroboration-but-no-conflict still isn't "unknown" — evidence exists, just thin

    reason = f"{len(claims)} claim(s) from {len(distinct_source_types)} source type(s), most recent {most_recent_days} days old, no conflicts."
    return tier, score, reason


TIER_ICON = {"Supported": "\U0001F7E2", "Uncertain": "\U0001F7E1", "Unknown": "\U0001F534"}


def print_report(conn: sqlite3.Connection):
    cur = conn.cursor()
    schools = cur.execute("SELECT id, name, is_synthetic FROM schools").fetchall()

    for school_id, name, is_synthetic in schools:
        tag = "  [SYNTHETIC / ILLUSTRATIVE]" if is_synthetic else ""
        print(f"\n=== {name}{tag} ===")

        fields = cur.execute(
            "SELECT DISTINCT field_name FROM claims WHERE school_id = ?", (school_id,)
        ).fetchall()

        if not fields:
            print("  (no claims recorded)")
            continue

        for (field_name,) in fields:
            tier, score, reason = compute_confidence(conn, school_id, field_name)
            icon = TIER_ICON[tier]
            print(f"  {icon} {field_name}: {tier} ({score}/100) — {reason}")

            claims = cur.execute(
                """SELECT c.value_text, s.name, c.status, c.source_date
                   FROM claims c JOIN sources s ON c.source_id = s.id
                   WHERE c.school_id = ? AND c.field_name = ?""",
                (school_id, field_name),
            ).fetchall()
            for value_text, source_name, status, source_date in claims:
                print(f"      - \"{value_text}\" [{status}] via {source_name} ({source_date})")


if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)
    cmd = sys.argv[1] if len(sys.argv) > 1 else "report"

    if cmd == "detect":
        n = detect_conflicts(conn)
        print(f"Detected {n} conflict(s).")
    elif cmd == "report":
        detect_conflicts(conn)
        print_report(conn)
    else:
        print(__doc__)

    conn.close()
