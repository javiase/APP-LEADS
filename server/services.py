from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from .database import RESULT_OPTIONS, STATUS_OPTIONS, get_db


def now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat()


def parse_iso(value):
    if not value:
        return None
    return datetime.fromisoformat(value)


def serialize_lead(lead):
    return {
        "id": lead["id"],
        "name": lead["name"],
        "handle": lead["handle"],
        "mentor_store": lead["mentor_store"],
        "current_status": lead["current_status"],
        "pipeline_result": lead["pipeline_result"],
        "last_status_before_result": lead.get("last_status_before_result", ""),
        "instagram_username": lead.get("instagram_username", ""),
        "comments": lead["comments"],
        "ab_variant": lead["ab_variant"],
        "action_label": lead["action_label"],
        "action_due_at": lead["action_due_at"],
        "created_at": lead["created_at"],
        "updated_at": lead["updated_at"],
    }


def validate_lead_payload(payload):
    for field in ("name", "current_status"):
        if not payload.get(field):
            raise ValueError(f"El campo '{field}' es obligatorio")

    if payload["current_status"] not in STATUS_OPTIONS:
        raise ValueError("Estado no valido")

    if payload.get("pipeline_result", "active") not in RESULT_OPTIONS:
        raise ValueError("Resultado no valido")


def add_event(
    lead_id,
    event_type,
    title,
    note="",
    previous_status=None,
    new_status=None,
    previous_result=None,
    new_result=None,
    template_variant=None,
    action_label=None,
    action_due_at=None,
    created_at=None,
):
    timestamp = created_at or now_iso()
    with get_db() as db:
        db.execute(
            """
            INSERT INTO lead_events (
                lead_id, event_type, title, note,
                previous_status, new_status,
                previous_result, new_result,
                template_variant, action_label, action_due_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lead_id,
                event_type,
                title,
                note,
                previous_status,
                new_status,
                previous_result,
                new_result,
                template_variant,
                action_label,
                action_due_at,
                timestamp,
            ),
        )


def get_lead(lead_id):
    with get_db() as db:
        lead = db.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        if not lead:
            return None
        history = db.execute(
            """
            SELECT * FROM lead_events
            WHERE lead_id = ?
            ORDER BY datetime(created_at) DESC, id DESC
            """,
            (lead_id,),
        ).fetchall()
    return {**serialize_lead(lead), "history": history}


def list_leads():
    with get_db() as db:
        rows = db.execute(
            """
            SELECT * FROM leads
            ORDER BY
                CASE pipeline_result
                    WHEN 'active' THEN 0
                    WHEN 'won' THEN 1
                    ELSE 2
                END,
                datetime(updated_at) DESC
            """
        ).fetchall()
    return [serialize_lead(row) for row in rows]


def create_lead(payload):
    validate_lead_payload(payload)
    timestamp = now_iso()
    data = {
        "name": payload["name"].strip(),
        "handle": payload.get("handle", "").strip(),
        "mentor_store": payload.get("mentor_store", "").strip(),
        "current_status": payload["current_status"],
        "pipeline_result": payload.get("pipeline_result", "active"),
        "last_status_before_result": payload.get("last_status_before_result", "").strip(),
        "instagram_username": payload.get("instagram_username", "").strip(),
        "comments": payload.get("comments", "").strip(),
        "ab_variant": payload.get("ab_variant", "").strip(),
        "action_label": payload.get("action_label", "").strip(),
        "action_due_at": payload.get("action_due_at"),
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    with get_db() as db:
        cursor = db.execute(
            """
            INSERT INTO leads (
                name, handle, mentor_store, current_status, pipeline_result,
                last_status_before_result, instagram_username,
                comments, ab_variant, action_label, action_due_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["name"],
                data["handle"],
                data["mentor_store"],
                data["current_status"],
                data["pipeline_result"],
                data["last_status_before_result"],
                data["instagram_username"],
                data["comments"],
                data["ab_variant"],
                data["action_label"],
                data["action_due_at"],
                data["created_at"],
                data["updated_at"],
            ),
        )
        lead_id = cursor.lastrowid

    add_event(
        lead_id=lead_id,
        event_type="created",
        title="Lead creado",
        note=data["comments"],
        new_status=data["current_status"],
        new_result=data["pipeline_result"],
        template_variant=data["ab_variant"],
        action_label=data["action_label"],
        action_due_at=data["action_due_at"],
        created_at=timestamp,
    )
    return get_lead(lead_id)


def update_lead(lead_id, payload):
    existing = get_lead(lead_id)
    if not existing:
        return None

    merged = {**existing, **payload}
    validate_lead_payload(merged)
    timestamp = now_iso()

    status_changed = merged["current_status"] != existing["current_status"]
    result_changed = merged["pipeline_result"] != existing["pipeline_result"]
    comments_changed = merged.get("comments", "") != existing["comments"]
    template_changed = merged.get("ab_variant", "") != existing["ab_variant"]
    action_changed = (
        merged.get("action_label", "") != existing["action_label"]
        or merged.get("action_due_at") != existing["action_due_at"]
    )

    # When marking as won or lost, save the current status so we know where they were
    last_status = existing.get("last_status_before_result", "")
    if result_changed and merged["pipeline_result"] in ("won", "lost"):
        last_status = existing["current_status"]
    elif result_changed and merged["pipeline_result"] == "active":
        last_status = ""

    with get_db() as db:
        db.execute(
            """
            UPDATE leads
            SET name = ?, handle = ?, mentor_store = ?, current_status = ?,
                pipeline_result = ?, last_status_before_result = ?,
                instagram_username = ?,
                comments = ?, ab_variant = ?,
                action_label = ?, action_due_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                merged["name"].strip(),
                merged.get("handle", "").strip(),
                merged.get("mentor_store", "").strip(),
                merged["current_status"],
                merged["pipeline_result"],
                last_status,
                merged.get("instagram_username", "").strip(),
                merged.get("comments", "").strip(),
                merged.get("ab_variant", "").strip(),
                merged.get("action_label", "").strip(),
                merged.get("action_due_at"),
                timestamp,
                lead_id,
            ),
        )

    if status_changed:
        add_event(
            lead_id=lead_id,
            event_type="status_change",
            title=f"Estado cambiado a {merged['current_status']}",
            note=merged.get("comments", ""),
            previous_status=existing["current_status"],
            new_status=merged["current_status"],
            template_variant=merged.get("ab_variant", ""),
            created_at=timestamp,
        )

    if result_changed:
        titles = {"won": "Lead convertido", "lost": "Lead marcado como perdido", "active": "Lead reactivado"}
        add_event(
            lead_id=lead_id,
            event_type="result_change",
            title=titles[merged["pipeline_result"]],
            previous_result=existing["pipeline_result"],
            new_result=merged["pipeline_result"],
            created_at=timestamp,
        )

    if action_changed:
        add_event(
            lead_id=lead_id,
            event_type="action_update",
            title="Siguiente accion actualizada",
            action_label=merged.get("action_label", ""),
            action_due_at=merged.get("action_due_at"),
            created_at=timestamp,
        )

    if template_changed:
        add_event(
            lead_id=lead_id,
            event_type="template_update",
            title=f"Plantilla actualizada a {merged.get('ab_variant', 'sin definir')}",
            template_variant=merged.get("ab_variant", ""),
            created_at=timestamp,
        )

    if comments_changed and not status_changed:
        add_event(
            lead_id=lead_id,
            event_type="note",
            title="Comentario actualizado",
            note=merged.get("comments", ""),
            created_at=timestamp,
        )

    return get_lead(lead_id)


def get_metadata():
    return {"statuses": STATUS_OPTIONS, "results": RESULT_OPTIONS}


def compute_status_timings(leads, events_by_lead):
    now = datetime.utcnow()
    totals = defaultdict(lambda: {"seconds": 0, "count": 0})

    for lead in leads:
        history = sorted(
            [
                event
                for event in events_by_lead[lead["id"]]
                if event["event_type"] in ("created", "status_change")
            ],
            key=lambda item: item["created_at"],
        )
        if not history:
            continue

        for index, event in enumerate(history):
            status = event["new_status"]
            start = parse_iso(event["created_at"])
            end = parse_iso(history[index + 1]["created_at"]) if index + 1 < len(history) else now
            if not status or not start or not end or end <= start:
                continue
            totals[status]["seconds"] += (end - start).total_seconds()
            totals[status]["count"] += 1

    rows = []
    for status in STATUS_OPTIONS:
        total = totals[status]
        average_days = round((total["seconds"] / total["count"]) / 86400, 2) if total["count"] else 0
        rows.append({"status": status, "average_days": average_days, "samples": total["count"]})
    rows.sort(key=lambda item: item["average_days"], reverse=True)
    return rows


def compute_drop_offs(leads, events_by_lead):
    lost_counter = Counter()
    stalled_counter = Counter()
    now = datetime.utcnow()

    for lead in leads:
        history = sorted(events_by_lead[lead["id"]], key=lambda item: item["created_at"])
        if lead["pipeline_result"] == "lost":
            last_status = lead["current_status"]
            for event in reversed(history):
                if event["new_status"]:
                    last_status = event["new_status"]
                    break
            lost_counter[last_status] += 1

        updated_at = parse_iso(lead["updated_at"])
        if lead["pipeline_result"] == "active" and updated_at and now - updated_at > timedelta(days=7):
            stalled_counter[lead["current_status"]] += 1

    rows = []
    for status in STATUS_OPTIONS:
        rows.append({"status": status, "lost": lost_counter[status], "stalled": stalled_counter[status]})
    rows.sort(key=lambda item: (item["lost"], item["stalled"]), reverse=True)
    return rows


def compute_template_performance(leads):
    templates = defaultdict(lambda: {"total": 0, "won": 0, "lost": 0, "active": 0})
    for lead in leads:
        template = lead["ab_variant"] or "Sin plantilla"
        templates[template]["total"] += 1
        templates[template][lead["pipeline_result"]] += 1

    rows = []
    for template, values in templates.items():
        win_rate = round((values["won"] / values["total"]) * 100, 1) if values["total"] else 0
        loss_rate = round((values["lost"] / values["total"]) * 100, 1) if values["total"] else 0
        rows.append(
            {
                "template": template,
                "total": values["total"],
                "won": values["won"],
                "lost": values["lost"],
                "active": values["active"],
                "win_rate": win_rate,
                "loss_rate": loss_rate,
            }
        )
    rows.sort(key=lambda item: (item["win_rate"], item["total"]), reverse=True)
    return rows


def compute_dashboard():
    with get_db() as db:
        leads = db.execute("SELECT * FROM leads ORDER BY datetime(updated_at) DESC").fetchall()
        events = db.execute("SELECT * FROM lead_events ORDER BY datetime(created_at) DESC").fetchall()

    events_by_lead = defaultdict(list)
    for event in events:
        events_by_lead[event["lead_id"]].append(event)

    result_counter = Counter(lead["pipeline_result"] for lead in leads)
    status_counter = Counter(lead["current_status"] for lead in leads)
    due_today = 0
    overdue = 0
    now = datetime.utcnow()

    for lead in leads:
        due_date = parse_iso(lead["action_due_at"])
        if not due_date:
            continue
        if due_date.date() == now.date():
            due_today += 1
        if due_date < now and lead["pipeline_result"] == "active":
            overdue += 1

    return {
        "summary": {
            "total_leads": len(leads),
            "active_leads": result_counter["active"],
            "won_leads": result_counter["won"],
            "lost_leads": result_counter["lost"],
            "due_today": due_today,
            "overdue": overdue,
        },
        "status_distribution": [{"status": status, "count": status_counter[status]} for status in STATUS_OPTIONS],
        "time_in_status": compute_status_timings(leads, events_by_lead),
        "drop_offs": compute_drop_offs(leads, events_by_lead),
        "template_performance": compute_template_performance(leads),
        "recent_activity": sorted(events, key=lambda item: item["created_at"], reverse=True)[:10],
    }
