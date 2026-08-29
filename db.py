"""
Build the SQLite database from schema.sql, then import a seed_data.json file
(same shape as seed_data_template.json) into it.

Usage:
    python db.py build                       # create/reset platform.db from schema.sql
    python db.py import seed_data.json        # load your filled-in data
"""

import sqlite3
import json
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "platform.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def build_db(db_path: str = DB_PATH, schema_path: str = SCHEMA_PATH):
    if os.path.exists(db_path):
        os.remove(db_path)
    conn = sqlite3.connect(db_path)
    with open(schema_path, "r") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
    print(f"Built fresh database at {db_path}")


def import_seed(json_path: str, db_path: str = DB_PATH):
    with open(json_path, "r") as f:
        data = json.load(f)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # --- sources ---
    source_ids = {}  # name -> id
    for src in data.get("sources", []):
        cur.execute(
            "INSERT INTO sources (name, type, base_reliability, url, notes) VALUES (?, ?, ?, ?, ?)",
            (src["name"], src["type"], src.get("base_reliability", 0.5), src.get("url"), src.get("notes")),
        )
        source_ids[src["name"]] = cur.lastrowid

    # --- schools + claims ---
    for school in data.get("schools", []):
        cur.execute(
            "INSERT INTO schools (name, aliases, city, curriculum_hint, is_synthetic, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (
                school["name"],
                school.get("aliases"),
                school.get("city", "Yangon"),
                school.get("curriculum_hint"),
                1 if school.get("is_synthetic") else 0,
                school.get("notes"),
            ),
        )
        school_id = cur.lastrowid

        for claim in school.get("claims", []):
            source_name = claim["source_name"]
            if source_name not in source_ids:
                raise ValueError(
                    f"Claim for '{school['name']}' references unknown source '{source_name}'. "
                    f"Add it to the top-level 'sources' list first."
                )
            cur.execute(
                """INSERT INTO claims
                   (school_id, source_id, field_name, value_text, value_numeric, status, source_date, evidence_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    school_id,
                    source_ids[source_name],
                    claim["field_name"],
                    claim["value_text"],
                    claim.get("value_numeric"),
                    claim.get("status", "unverified"),
                    claim["source_date"],
                    claim.get("evidence_note"),
                ),
            )

    conn.commit()
    n_schools = cur.execute("SELECT COUNT(*) FROM schools").fetchone()[0]
    n_claims = cur.execute("SELECT COUNT(*) FROM claims").fetchone()[0]
    conn.close()
    print(f"Imported {n_schools} schools and {n_claims} claims into {db_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "build":
        build_db()
    elif cmd == "import":
        if len(sys.argv) < 3:
            print("Usage: python db.py import <path_to_seed_data.json>")
            sys.exit(1)
        import_seed(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
