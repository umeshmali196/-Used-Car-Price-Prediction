from pathlib import Path
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import json
import os
import pickle
import sqlite3

from flask import Flask, g, jsonify, render_template, request
from flask import Response
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from simple_model import SimpleCarPriceModel
except ModuleNotFoundError:
    from backend.simple_model import SimpleCarPriceModel

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv("CLIENT_ORIGIN", "*")}})

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"
METRICS_PATH = BASE_DIR / "model_metrics.json"
DB_PATH = BASE_DIR / "database.db"
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-before-deploying")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
ADMIN_EMAILS = {
    email.strip().lower()
    for email in os.getenv(
        "ADMIN_EMAILS",
        "admin@example.com,umeshmahajan196@gmail.com",
    ).split(",")
    if email.strip()
}

model = None


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def bootstrap_model():
    trained_model = SimpleCarPriceModel()

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(trained_model, f)

    return trained_model


def load_model():
    global model

    if model is None:
        try:
            with open(MODEL_PATH, "rb") as f:
                model = pickle.load(f)
        except (FileNotFoundError, EOFError, pickle.UnpicklingError):
            model = bootstrap_model()

    return model


def add_column_if_missing(cursor, table_name, column_name, column_definition):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = {row["name"] for row in cursor.fetchall()}

    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")


def create_tables():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    add_column_if_missing(cursor, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0")
    add_column_if_missing(cursor, "users", "status", "TEXT NOT NULL DEFAULT 'active'")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            year INTEGER NOT NULL,
            km INTEGER NOT NULL,
            company TEXT,
            fuel TEXT,
            predicted_price REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )

    add_column_if_missing(cursor, "predictions", "user_id", "INTEGER")
    add_column_if_missing(cursor, "predictions", "company", "TEXT")
    add_column_if_missing(cursor, "predictions", "fuel", "TEXT")
    add_column_if_missing(cursor, "predictions", "transmission", "TEXT")
    add_column_if_missing(cursor, "predictions", "owner_type", "TEXT")
    add_column_if_missing(cursor, "predictions", "location", "TEXT")
    add_column_if_missing(cursor, "predictions", "mileage", "REAL")
    add_column_if_missing(cursor, "predictions", "engine", "INTEGER")
    add_column_if_missing(cursor, "predictions", "power", "REAL")
    add_column_if_missing(cursor, "predictions", "brand", "TEXT")
    add_column_if_missing(cursor, "predictions", "model_name", "TEXT")
    add_column_if_missing(cursor, "predictions", "variant", "TEXT")
    add_column_if_missing(cursor, "predictions", "city", "TEXT")
    add_column_if_missing(cursor, "predictions", "accident_history", "TEXT")
    add_column_if_missing(cursor, "predictions", "service_history", "TEXT")
    add_column_if_missing(cursor, "predictions", "insurance_status", "TEXT")
    add_column_if_missing(cursor, "predictions", "ownership_count", "INTEGER")
    add_column_if_missing(cursor, "predictions", "color", "TEXT")
    add_column_if_missing(cursor, "predictions", "body_type", "TEXT")
    add_column_if_missing(cursor, "predictions", "registration_state", "TEXT")
    add_column_if_missing(cursor, "predictions", "inspection_score", "INTEGER")
    add_column_if_missing(cursor, "predictions", "market_price", "REAL")
    add_column_if_missing(cursor, "predictions", "price_label", "TEXT")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            brand TEXT,
            model_name TEXT,
            variant TEXT,
            year INTEGER NOT NULL,
            km INTEGER NOT NULL,
            fuel TEXT,
            transmission TEXT,
            city TEXT,
            price REAL NOT NULL,
            predicted_price REAL,
            price_label TEXT,
            inspection_score INTEGER,
            insurance_status TEXT,
            ownership_count INTEGER,
            body_type TEXT,
            color TEXT,
            registration_state TEXT,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )

    conn.commit()
    conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def row_to_dict(row):
    return dict(row) if row else None


def normalize_text(value, fallback=""):
    return str(value or fallback).strip()


def calculate_market_context(prediction, city, fuel, ownership_count, accident_history, service_history, insurance_status):
    city_factor = {
        "Delhi": 1.03,
        "Mumbai": 1.06,
        "Bengaluru": 1.08,
        "Chennai": 1.01,
        "Hyderabad": 1.04,
        "Pune": 1.05,
        "Ahmedabad": 0.98,
    }.get(city, 1)
    fuel_factor = {"Diesel": 1.03, "CNG": 0.96, "Electric": 1.12, "Petrol": 1}.get(fuel, 1)
    owner_penalty = max(0, int(ownership_count or 1) - 1) * 0.035
    accident_penalty = 0.08 if accident_history == "Major" else 0.035 if accident_history == "Minor" else 0
    service_bonus = 0.04 if service_history == "Complete" else -0.025 if service_history == "Missing" else 0
    insurance_bonus = 0.025 if insurance_status == "Active" else -0.04 if insurance_status == "Expired" else 0

    market_price = prediction * city_factor * fuel_factor * (1 - owner_penalty - accident_penalty + service_bonus + insurance_bonus)
    gap_percent = ((prediction - market_price) / market_price) * 100 if market_price else 0

    if gap_percent < -7:
        label = "Low"
    elif gap_percent > 7:
        label = "High"
    else:
        label = "Fair"

    return round(market_price, 2), label


def inspection_score_from_payload(data):
    checks = {
        "engine_condition": normalize_text(data.get("engine_condition"), "Good"),
        "tyre_condition": normalize_text(data.get("tyre_condition"), "Good"),
        "documents_verified": normalize_text(data.get("documents_verified"), "Yes"),
        "accident_signs": normalize_text(data.get("accident_signs"), "No"),
        "service_records": normalize_text(data.get("service_records"), "Available"),
    }
    score = 100
    if checks["engine_condition"] == "Average":
        score -= 12
    if checks["engine_condition"] == "Poor":
        score -= 28
    if checks["tyre_condition"] == "Average":
        score -= 8
    if checks["tyre_condition"] == "Poor":
        score -= 18
    if checks["documents_verified"] != "Yes":
        score -= 18
    if checks["accident_signs"] == "Minor":
        score -= 10
    if checks["accident_signs"] == "Major":
        score -= 28
    if checks["service_records"] != "Available":
        score -= 12

    return max(25, min(100, score))


def json_response(payload, status=200):
    return jsonify(payload), status


def validate_auth_payload(data, require_name=False):
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if require_name and len(name) < 2:
        return None, "Name must be at least 2 characters."
    if "@" not in email or "." not in email:
        return None, "Enter a valid email address."
    if len(password) < 6:
        return None, "Password must be at least 6 characters."

    return {"name": name, "email": email, "password": password}, None


def b64url_encode(raw_bytes):
    return base64.urlsafe_b64encode(raw_bytes).rstrip(b"=").decode("utf-8")


def b64url_decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_token(user):
    expires_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user["id"],
        "name": user["name"],
        "email": user["email"],
        "exp": int(expires_at.timestamp()),
    }

    signing_input = ".".join(
        [
            b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{signing_input}.{b64url_encode(signature)}"


def decode_token(token):
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}"
        expected_signature = hmac.new(
            JWT_SECRET.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(b64url_decode(signature_b64), expected_signature):
            return None

        payload = json.loads(b64url_decode(payload_b64))
        if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
            return None

        return payload
    except (ValueError, json.JSONDecodeError, TypeError):
        return None


def require_auth(view):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return json_response({"message": "Missing authorization token."}, 401)

        payload = decode_token(auth_header.replace("Bearer ", "", 1))
        if not payload:
            return json_response({"message": "Invalid or expired token."}, 401)

        conn = get_db()
        user = conn.execute(
            "SELECT id, name, email, is_admin, status, created_at FROM users WHERE id = ?",
            (payload["sub"],),
        ).fetchone()
        conn.close()

        if not user:
            return json_response({"message": "User account no longer exists."}, 401)
        if user["status"] == "blocked":
            return json_response({"message": "User account is blocked."}, 403)

        g.user = dict(user)
        return view(*args, **kwargs)

    wrapper.__name__ = view.__name__
    return wrapper


def require_admin(view):
    @require_auth
    def wrapper(*args, **kwargs):
        is_configured_admin = g.user["email"].lower() in ADMIN_EMAILS
        if not g.user.get("is_admin") and not is_configured_admin:
            return json_response({"message": "Admin access required."}, 403)

        return view(*args, **kwargs)

    wrapper.__name__ = view.__name__
    return wrapper


create_tables()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": now_iso()})


@app.route("/api/model-info", methods=["GET"])
@require_auth
def model_info():
    metrics = {
        "r2_score": 0.89,
        "mae": 48500,
        "note": "Demo metric. Recalculate after training on your final dataset.",
    }

    if METRICS_PATH.exists():
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            saved_metrics = json.load(f)
        metrics = {
            "r2_score": saved_metrics.get("r2_score"),
            "mae": saved_metrics.get("mae"),
            "note": "Loaded from model_metrics.json.",
        }

    return jsonify(
        {
            "model": "RandomForestRegressor when trained, rule-based fallback otherwise",
            "features": [
                "year",
                "km",
                "company",
                "fuel",
                "transmission",
                "owner_type",
                "location",
                "mileage",
                "engine",
                "power",
            ],
            "accuracy": metrics,
        }
    )


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    payload, error = validate_auth_payload(request.get_json(silent=True) or {}, require_name=True)
    if error:
        return json_response({"message": error}, 400)

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload["name"],
                payload["email"],
                generate_password_hash(payload["password"]),
                1 if payload["email"] in ADMIN_EMAILS else 0,
                now_iso(),
            ),
        )
        conn.commit()
        user = conn.execute(
            "SELECT id, name, email, is_admin, status, created_at FROM users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        return json_response({"message": "An account with this email already exists."}, 409)

    conn.close()
    user_data = dict(user)

    return json_response(
        {"token": create_token(user_data), "user": user_data, "message": "Signup successful."},
        201,
    )


@app.route("/api/admin/auth/signup", methods=["POST"])
def admin_signup():
    payload, error = validate_auth_payload(request.get_json(silent=True) or {}, require_name=True)
    if error:
        return json_response({"message": error}, 400)

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload["name"],
                payload["email"],
                generate_password_hash(payload["password"]),
                1,
                now_iso(),
            ),
        )
        conn.commit()
        user = conn.execute(
            "SELECT id, name, email, is_admin, status, created_at FROM users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        return json_response({"message": "An account with this admin email already exists."}, 409)

    conn.close()
    user_data = dict(user)

    return json_response(
        {"token": create_token(user_data), "user": user_data, "message": "Admin account created."},
        201,
    )


@app.route("/api/auth/login", methods=["POST"])
def login():
    payload, error = validate_auth_payload(request.get_json(silent=True) or {})
    if error:
        return json_response({"message": error}, 400)

    conn = get_db()
    user = conn.execute(
        "SELECT id, name, email, password_hash, is_admin, status, created_at FROM users WHERE email = ?",
        (payload["email"],),
    ).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], payload["password"]):
        return json_response({"message": "Invalid email or password."}, 401)
    if user["status"] == "blocked":
        return json_response({"message": "This account is blocked by admin."}, 403)

    user_data = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "is_admin": user["is_admin"],
        "status": user["status"],
        "created_at": user["created_at"],
    }

    return jsonify({"token": create_token(user_data), "user": user_data, "message": "Login successful."})


@app.route("/api/admin/auth/login", methods=["POST"])
def admin_login():
    payload, error = validate_auth_payload(request.get_json(silent=True) or {})
    if error:
        return json_response({"message": error}, 400)

    conn = get_db()
    user = conn.execute(
        "SELECT id, name, email, password_hash, is_admin, status, created_at FROM users WHERE email = ?",
        (payload["email"],),
    ).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], payload["password"]):
        return json_response({"message": "Invalid admin email or password."}, 401)
    if user["status"] == "blocked":
        return json_response({"message": "This admin account is blocked."}, 403)
    if not user["is_admin"]:
        return json_response({"message": "This email is not an admin account."}, 403)

    user_data = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "is_admin": user["is_admin"],
        "status": user["status"],
        "created_at": user["created_at"],
    }

    return jsonify({"token": create_token(user_data), "user": user_data, "message": "Admin login successful."})


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def me():
    return jsonify({"user": g.user})


@app.route("/predict-form", methods=["POST"])
def predict_form():
    year = int(request.form["year"])
    km = int(request.form["km"])

    loaded_model = load_model()
    prediction = loaded_model.predict([[year, km]])[0]

    conn = get_db()
    conn.execute(
        """
        INSERT INTO predictions (year, km, predicted_price, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (year, km, prediction, now_iso()),
    )
    conn.commit()
    conn.close()

    return render_template("index.html", prediction=round(prediction, 2))


@app.route("/api/predict", methods=["POST"])
@require_auth
def predict():
    data = request.get_json(silent=True) or {}

    try:
        year = int(data["year"])
        km = int(data["km"])
    except (KeyError, TypeError, ValueError):
        return json_response({"message": "Year and KM driven are required numbers."}, 400)

    if year < 1990 or year > datetime.now().year + 1:
        return json_response({"message": "Enter a realistic manufacturing year."}, 400)
    if km < 0:
        return json_response({"message": "KM driven cannot be negative."}, 400)

    brand = normalize_text(data.get("brand"), normalize_text(data.get("company"), "Maruti"))
    company = brand
    model_name = normalize_text(data.get("model_name"), "Swift")
    variant = normalize_text(data.get("variant"), "VXI")
    fuel = normalize_text(data.get("fuel"), "Petrol")
    transmission = normalize_text(data.get("transmission"), "Manual")
    owner_type = normalize_text(data.get("owner_type"), "First")
    city = normalize_text(data.get("city"), normalize_text(data.get("location"), "Delhi"))
    location = city
    accident_history = normalize_text(data.get("accident_history"), "None")
    service_history = normalize_text(data.get("service_history"), "Complete")
    insurance_status = normalize_text(data.get("insurance_status"), "Active")
    ownership_count = int(data.get("ownership_count") or {"First": 1, "Second": 2, "Third": 3, "Fourth+": 4}.get(owner_type, 1))
    color = normalize_text(data.get("color"), "White")
    body_type = normalize_text(data.get("body_type"), "Hatchback")
    registration_state = normalize_text(data.get("registration_state"), "DL")
    inspection_score = inspection_score_from_payload(data)
    mileage = float(data.get("mileage") or 18)
    engine = int(data.get("engine") or 1200)
    power = float(data.get("power") or 85)

    company_map = {"Maruti": 0, "Hyundai": 1, "Honda": 2}
    fuel_map = {"Petrol": 0, "Diesel": 1, "CNG": 2}
    transmission_map = {"Manual": 0, "Automatic": 1}
    owner_map = {"First": 0, "Second": 1, "Third": 2, "Fourth+": 3}

    company_val = company_map.get(company, 0)
    fuel_val = fuel_map.get(fuel, 0)
    transmission_val = transmission_map.get(transmission, 0)
    owner_val = owner_map.get(owner_type, 0)

    loaded_model = load_model()

    try:
        prediction = loaded_model.predict(
            [[year, km, company_val, fuel_val, transmission_val, owner_val, mileage, engine, power]]
        )[0]
    except (TypeError, ValueError):
        prediction = loaded_model.predict([[year, km]])[0]

    condition_factor = 0.85 + (inspection_score / 100 * 0.25)
    adjusted_prediction = max(50000, prediction * condition_factor)
    market_price, price_label = calculate_market_context(
        adjusted_prediction,
        city,
        fuel,
        ownership_count,
        accident_history,
        service_history,
        insurance_status,
    )
    price_low = round(adjusted_prediction * 0.9, 2)
    price_high = round(adjusted_prediction * 1.1, 2)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO predictions (
            user_id, year, km, company, fuel, transmission, owner_type, location,
            mileage, engine, power, predicted_price, created_at,
            brand, model_name, variant, city, accident_history, service_history,
            insurance_status, ownership_count, color, body_type, registration_state,
            inspection_score, market_price, price_label
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            g.user["id"],
            year,
            km,
            company,
            fuel,
            transmission,
            owner_type,
            location,
            mileage,
            engine,
            power,
            adjusted_prediction,
            now_iso(),
            brand,
            model_name,
            variant,
            city,
            accident_history,
            service_history,
            insurance_status,
            ownership_count,
            color,
            body_type,
            registration_state,
            inspection_score,
            market_price,
            price_label,
        ),
    )
    conn.commit()
    prediction_id = cursor.lastrowid
    conn.close()

    return jsonify(
        {
            "id": prediction_id,
            "year": year,
            "km": km,
            "company": company,
            "brand": brand,
            "model_name": model_name,
            "variant": variant,
            "fuel": fuel,
            "transmission": transmission,
            "owner_type": owner_type,
            "location": location,
            "city": city,
            "accident_history": accident_history,
            "service_history": service_history,
            "insurance_status": insurance_status,
            "ownership_count": ownership_count,
            "color": color,
            "body_type": body_type,
            "registration_state": registration_state,
            "inspection_score": inspection_score,
            "mileage": mileage,
            "engine": engine,
            "power": power,
            "predicted_price": round(adjusted_prediction, 2),
            "market_price": market_price,
            "price_label": price_label,
            "price_range": {"low": price_low, "expected": round(adjusted_prediction, 2), "high": price_high},
            "suggestions": [
                "Complete service records can improve buyer confidence.",
                "Repair visible dents before listing if repair cost is below 2% of value.",
                "Cars usually attract stronger demand before festive and salary cycles.",
            ],
        }
    )


@app.route("/api/history", methods=["GET"])
@require_auth
def history():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT id, year, km, company, fuel, transmission, owner_type, location,
               mileage, engine, power, predicted_price, created_at, brand, model_name,
               variant, city, accident_history, service_history, insurance_status,
               ownership_count, color, body_type, registration_state, inspection_score,
               market_price, price_label
        FROM predictions
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (g.user["id"],),
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/history/export", methods=["GET"])
@require_auth
def export_history():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT year, km, company, fuel, transmission, owner_type, location,
               mileage, engine, power, predicted_price, created_at, brand, model_name,
               variant, city, accident_history, service_history, insurance_status,
               ownership_count, color, body_type, registration_state, inspection_score,
               market_price, price_label
        FROM predictions
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (g.user["id"],),
    ).fetchall()
    conn.close()

    headers = [
        "year",
        "km",
        "company",
        "fuel",
        "transmission",
        "owner_type",
        "location",
        "mileage",
        "engine",
        "power",
        "predicted_price",
        "created_at",
        "brand",
        "model_name",
        "variant",
        "city",
        "accident_history",
        "service_history",
        "insurance_status",
        "ownership_count",
        "color",
        "body_type",
        "registration_state",
        "inspection_score",
        "market_price",
        "price_label",
    ]
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(str(row[key] or "") for key in headers))

    return Response(
        "\n".join(lines),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=prediction_history.csv"},
    )


@app.route("/api/admin/summary", methods=["GET"])
@require_admin
def admin_summary():
    conn = get_db()
    total_users = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    total_predictions = conn.execute("SELECT COUNT(*) AS count FROM predictions").fetchone()["count"]
    active_users = conn.execute(
        """
        SELECT COUNT(DISTINCT user_id) AS count
        FROM predictions
        WHERE user_id IS NOT NULL
        """
    ).fetchone()["count"]
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    predictions_today = conn.execute(
        "SELECT COUNT(*) AS count FROM predictions WHERE created_at LIKE ?",
        (f"{today_prefix}%",),
    ).fetchone()["count"]
    total_listings = conn.execute("SELECT COUNT(*) AS count FROM listings").fetchone()["count"]
    pending_listings = conn.execute(
        "SELECT COUNT(*) AS count FROM listings WHERE status = 'pending'"
    ).fetchone()["count"]
    avg_price = conn.execute(
        "SELECT COALESCE(AVG(predicted_price), 0) AS average FROM predictions"
    ).fetchone()["average"]
    recent = conn.execute(
        """
        SELECT predictions.id, users.email, predictions.year, predictions.km,
               predictions.company, predictions.predicted_price, predictions.created_at
        FROM predictions
        LEFT JOIN users ON users.id = predictions.user_id
        ORDER BY predictions.id DESC
        LIMIT 10
        """
    ).fetchall()
    users = conn.execute(
        """
        SELECT users.id, users.name, users.email, users.is_admin, users.status, users.created_at,
               COUNT(predictions.id) AS prediction_count,
               COALESCE(AVG(predictions.predicted_price), 0) AS average_price
        FROM users
        LEFT JOIN predictions ON predictions.user_id = users.id
        GROUP BY users.id
        ORDER BY users.id DESC
        LIMIT 25
        """
    ).fetchall()
    company_chart = conn.execute(
        """
        SELECT COALESCE(brand, company, 'Unknown') AS label,
               COUNT(*) AS count,
               COALESCE(AVG(predicted_price), 0) AS average_price
        FROM predictions
        GROUP BY label
        ORDER BY count DESC
        LIMIT 8
        """
    ).fetchall()
    fuel_chart = conn.execute(
        """
        SELECT COALESCE(fuel, 'Unknown') AS label,
               COUNT(*) AS count,
               COALESCE(AVG(predicted_price), 0) AS average_price
        FROM predictions
        GROUP BY label
        ORDER BY count DESC
        """
    ).fetchall()
    city_chart = conn.execute(
        """
        SELECT COALESCE(city, location, 'Unknown') AS label,
               COUNT(*) AS count,
               COALESCE(AVG(predicted_price), 0) AS average_price
        FROM predictions
        GROUP BY label
        ORDER BY count DESC
        LIMIT 8
        """
    ).fetchall()
    listings = conn.execute(
        """
        SELECT listings.*, users.email
        FROM listings
        LEFT JOIN users ON users.id = listings.user_id
        ORDER BY listings.id DESC
        LIMIT 12
        """
    ).fetchall()
    conn.close()

    return jsonify(
        {
            "total_users": total_users,
            "active_users": active_users,
            "total_predictions": total_predictions,
            "predictions_today": predictions_today,
            "total_listings": total_listings,
            "pending_listings": pending_listings,
            "average_price": round(avg_price, 2),
            "recent_predictions": [dict(row) for row in recent],
            "users": [dict(row) for row in users],
            "charts": {
                "company": [dict(row) for row in company_chart],
                "fuel": [dict(row) for row in fuel_chart],
                "city": [dict(row) for row in city_chart],
            },
            "listings": [dict(row) for row in listings],
        }
    )


@app.route("/api/listings", methods=["GET"])
@require_auth
def list_cars():
    brand = normalize_text(request.args.get("brand"))
    city = normalize_text(request.args.get("city"))
    fuel = normalize_text(request.args.get("fuel"))
    max_price = request.args.get("max_price")

    clauses = ["status != 'blocked'"]
    params = []
    if brand:
        clauses.append("LOWER(brand) = LOWER(?)")
        params.append(brand)
    if city:
        clauses.append("LOWER(city) = LOWER(?)")
        params.append(city)
    if fuel:
        clauses.append("LOWER(fuel) = LOWER(?)")
        params.append(fuel)
    if max_price:
        clauses.append("price <= ?")
        params.append(float(max_price))

    conn = get_db()
    rows = conn.execute(
        f"""
        SELECT listings.*, users.name AS seller_name, users.email AS seller_email
        FROM listings
        JOIN users ON users.id = listings.user_id
        WHERE {" AND ".join(clauses)}
        ORDER BY listings.id DESC
        """,
        params,
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/listings", methods=["POST"])
@require_auth
def create_listing():
    data = request.get_json(silent=True) or {}

    try:
        year = int(data["year"])
        km = int(data["km"])
        price = float(data["price"])
    except (KeyError, TypeError, ValueError):
        return json_response({"message": "Year, KM, and asking price are required."}, 400)

    brand = normalize_text(data.get("brand"), "Maruti")
    model_name = normalize_text(data.get("model_name"), "Swift")
    title = normalize_text(data.get("title"), f"{year} {brand} {model_name}")
    predicted_price = float(data.get("predicted_price") or price)
    price_label = normalize_text(data.get("price_label"), "Fair")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO listings (
            user_id, title, brand, model_name, variant, year, km, fuel, transmission,
            city, price, predicted_price, price_label, inspection_score, insurance_status,
            ownership_count, body_type, color, registration_state, description, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            g.user["id"],
            title,
            brand,
            model_name,
            normalize_text(data.get("variant"), "VXI"),
            year,
            km,
            normalize_text(data.get("fuel"), "Petrol"),
            normalize_text(data.get("transmission"), "Manual"),
            normalize_text(data.get("city"), "Delhi"),
            price,
            predicted_price,
            price_label,
            int(data.get("inspection_score") or 82),
            normalize_text(data.get("insurance_status"), "Active"),
            int(data.get("ownership_count") or 1),
            normalize_text(data.get("body_type"), "Hatchback"),
            normalize_text(data.get("color"), "White"),
            normalize_text(data.get("registration_state"), "DL"),
            normalize_text(data.get("description"), "Owner listed vehicle with valuation report."),
            "approved",
            now_iso(),
        ),
    )
    conn.commit()
    listing = conn.execute("SELECT * FROM listings WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()

    return json_response(dict(listing), 201)


@app.route("/api/admin/listings/<int:listing_id>/status", methods=["PATCH"])
@require_admin
def update_listing_status(listing_id):
    data = request.get_json(silent=True) or {}
    status = normalize_text(data.get("status"), "approved")
    if status not in {"approved", "pending", "blocked", "sold"}:
        return json_response({"message": "Invalid listing status."}, 400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE listings SET status = ? WHERE id = ?", (status, listing_id))
    conn.commit()
    updated = cursor.rowcount
    conn.close()

    if not updated:
        return json_response({"message": "Listing not found."}, 404)

    return jsonify({"message": "Listing status updated.", "status": status})


@app.route("/api/admin/users/<int:user_id>/status", methods=["PATCH"])
@require_admin
def update_user_status(user_id):
    data = request.get_json(silent=True) or {}
    status = normalize_text(data.get("status"), "active")
    if status not in {"active", "blocked"}:
        return json_response({"message": "Invalid user status."}, 400)
    if user_id == g.user["id"] and status == "blocked":
        return json_response({"message": "You cannot block your own admin account."}, 400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (status, user_id))
    conn.commit()
    updated = cursor.rowcount
    conn.close()

    if not updated:
        return json_response({"message": "User not found."}, 404)

    return jsonify({"message": "User status updated.", "status": status})


@app.route("/api/history/<int:prediction_id>", methods=["DELETE"])
@require_auth
def delete_prediction(prediction_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM predictions WHERE id = ? AND user_id = ?",
        (prediction_id, g.user["id"]),
    )
    conn.commit()
    deleted = cursor.rowcount
    conn.close()

    if not deleted:
        return json_response({"message": "Prediction not found."}, 404)

    return jsonify({"message": "Prediction deleted."})


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "1") == "1")
