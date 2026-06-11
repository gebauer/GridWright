import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get('DB_PATH', '/data/gridwright.db')


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS screens (
                slug        TEXT PRIMARY KEY,
                doc         TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                expires_at  TEXT
            )
        """)
        conn.commit()


def sweep_expired(conn: sqlite3.Connection) -> None:
    """Delete rows past their expires_at on startup (best-effort)."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "DELETE FROM screens WHERE expires_at IS NOT NULL AND expires_at < ?", (now,)
    )
    conn.commit()


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()
