import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .db import init_db, get_conn, sweep_expired
from .models import ScreenDocument
from .slugs import generate_slug

SCREEN_TTL_DAYS = os.environ.get('SCREEN_TTL_DAYS')
DIST_DIR = Path(__file__).parent.parent.parent / 'frontend' / 'dist'

app = FastAPI(title='GridWright')


@app.on_event('startup')
def startup():
    init_db()
    with get_conn() as conn:
        sweep_expired(conn)


@app.post('/api/screens', status_code=201)
def create_screen(doc: ScreenDocument):
    raw = doc.model_dump_json()
    now = datetime.now(timezone.utc)
    expires_at = None
    if SCREEN_TTL_DAYS:
        expires_at = (now + timedelta(days=int(SCREEN_TTL_DAYS))).isoformat()

    with get_conn() as conn:
        def exists(slug: str) -> bool:
            row = conn.execute('SELECT 1 FROM screens WHERE slug = ?', (slug,)).fetchone()
            return row is not None

        slug = generate_slug(exists)
        conn.execute(
            'INSERT INTO screens (slug, doc, created_at, expires_at) VALUES (?, ?, ?, ?)',
            (slug, raw, now.isoformat(), expires_at),
        )
        conn.commit()

    return {'slug': slug, 'url': f'/s/{slug}'}


@app.get('/api/screens/{slug}')
def get_screen(slug: str):
    with get_conn() as conn:
        row = conn.execute(
            'SELECT doc, expires_at FROM screens WHERE slug = ?', (slug,)
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail='Screen not found')

    if row['expires_at']:
        now = datetime.now(timezone.utc).isoformat()
        if row['expires_at'] < now:
            raise HTTPException(status_code=410, detail='Screen has expired')

    return json.loads(row['doc'])


# Serve built frontend for all other paths (SPA fallback)
if DIST_DIR.exists():
    app.mount('/assets', StaticFiles(directory=str(DIST_DIR / 'assets')), name='assets')

    @app.get('/{full_path:path}')
    def spa_fallback(full_path: str):
        return FileResponse(str(DIST_DIR / 'index.html'))
