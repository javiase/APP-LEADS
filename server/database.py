from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "leads.db"


STATUS_OPTIONS = [
    "pendiente mandarle mensaje",
    "Mensaje enviado",
    "Segundo mensaje enviado",
    "Tercer mensaje enviado",
    "hacer seguimiento",
    "Llamada agendada",
    "Llamada hecha",
    "Reunion hecha",
    "Implementado",
]

RESULT_OPTIONS = ["active", "won", "lost"]


def dict_factory(cursor, row):
    return {cursor.description[idx][0]: row[idx] for idx in range(len(cursor.description))}


@contextmanager
def get_db():
    DATA_DIR.mkdir(exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = dict_factory
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db():
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                handle TEXT,
                mentor_store TEXT,
                current_status TEXT NOT NULL,
                pipeline_result TEXT NOT NULL DEFAULT 'active',
                last_status_before_result TEXT DEFAULT '',
                instagram_username TEXT DEFAULT '',
                comments TEXT DEFAULT '',
                ab_variant TEXT DEFAULT '',
                action_label TEXT DEFAULT '',
                action_due_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lead_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                note TEXT DEFAULT '',
                previous_status TEXT,
                new_status TEXT,
                previous_result TEXT,
                new_result TEXT,
                template_variant TEXT,
                action_label TEXT,
                action_due_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
            );
            """
        )

        # Migrations for existing databases
        columns = [row["name"] for row in db.execute("PRAGMA table_info(leads)").fetchall()]
        if "last_status_before_result" not in columns:
            db.execute("ALTER TABLE leads ADD COLUMN last_status_before_result TEXT DEFAULT ''")
        if "instagram_username" not in columns:
            db.execute("ALTER TABLE leads ADD COLUMN instagram_username TEXT DEFAULT ''")


def seed_db():
    from .services import create_lead

    with get_db() as db:
        existing = db.execute("SELECT COUNT(*) AS total FROM leads").fetchone()
        if existing["total"] > 0:
            return

    samples = [
        {
            "name": "trevinpeterso",
            "handle": "@trevinpeterso",
            "mentor_store": "Growth Partners",
            "current_status": "Mensaje enviado",
            "pipeline_result": "active",
            "comments": "Lead frio. Perfil interesante en ecommerce.",
            "ab_variant": "Plantilla A",
            "action_label": "Responder en 2 dias si no contesta",
            "action_due_at": "2026-04-15T10:00:00",
        },
        {
            "name": "ecomshayy",
            "handle": "@ecomshayy",
            "mentor_store": "Scale Studio",
            "current_status": "Segundo mensaje enviado",
            "pipeline_result": "active",
            "comments": "Interesado pero sin hueco hasta la semana que viene.",
            "ab_variant": "Plantilla B",
            "action_label": "Enviar caso de exito",
            "action_due_at": "2026-04-14T18:00:00",
        },
        {
            "name": "jairuizc",
            "handle": "@jairuizc",
            "mentor_store": "Mentor Hub",
            "current_status": "Reunion hecha",
            "pipeline_result": "won",
            "comments": "Muy buen encaje. Esperando onboarding.",
            "ab_variant": "Plantilla A",
            "action_label": "Cerrar propuesta",
            "action_due_at": "2026-04-13T20:00:00",
        },
        {
            "name": "@dailymentorofficial",
            "handle": "@dailymentorofficial",
            "mentor_store": "Daily Mentor",
            "current_status": "Tercer mensaje enviado",
            "pipeline_result": "lost",
            "comments": "No hubo respuesta despues de varios intentos.",
            "ab_variant": "Plantilla C",
            "action_label": "Archivar",
            "action_due_at": "2026-04-12T09:30:00",
        },
    ]

    for lead in samples:
        create_lead(lead)
