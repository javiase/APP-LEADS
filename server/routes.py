from flask import Blueprint, jsonify, request

from .services import compute_dashboard, create_lead, get_lead, get_metadata, list_leads, update_lead


api = Blueprint("api", __name__)


@api.get("/metadata")
def metadata():
    return jsonify(get_metadata())


@api.get("/dashboard")
def dashboard():
    return jsonify(compute_dashboard())


@api.get("/leads")
def leads():
    return jsonify({"items": list_leads()})


@api.get("/leads/<int:lead_id>")
def lead_detail(lead_id):
    lead = get_lead(lead_id)
    if not lead:
        return jsonify({"error": "Lead no encontrado"}), 404
    return jsonify(lead)


@api.post("/leads")
def lead_create():
    payload = request.get_json(force=True, silent=True) or {}
    try:
        lead = create_lead(payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    return jsonify(lead), 201


@api.put("/leads/<int:lead_id>")
def lead_update(lead_id):
    payload = request.get_json(force=True, silent=True) or {}
    try:
        lead = update_lead(lead_id, payload)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    if not lead:
        return jsonify({"error": "Lead no encontrado"}), 404
    return jsonify(lead)
