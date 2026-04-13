from flask import Flask, jsonify, send_from_directory

from .database import init_db, seed_db
from .routes import api


def create_app():
    app = Flask(__name__, static_folder="../static", static_url_path="/static")
    app.register_blueprint(api, url_prefix="/api")

    init_db()
    seed_db()

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
