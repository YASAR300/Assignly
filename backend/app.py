import os
import requests as http_requests
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from functools import wraps
from datetime import datetime
from models import db, Profile, Task
from config import Config
from email_utils import send_email, get_task_created_template, get_task_completed_template, get_teammate_invited_template

app = Flask(__name__)
app.config.from_object(Config)

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS(app, resources={
    r"/api/*": {
        "origins": [
            str(app.config.get("FRONTEND_URL", "")).rstrip("/"),
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
    }
})

db.init_app(app)

# ── Helpers ───────────────────────────────────────────────────────────────────
def parse_iso_datetime(date_str):
    if not date_str:
        return None
    try:
        if date_str.endswith('Z'):
            date_str = date_str[:-1] + '+00:00'
        return datetime.fromisoformat(date_str)
    except Exception:
        return None


def verify_supabase_token(token: str):
    """
    Verify an access token by calling Supabase's /auth/v1/user endpoint.
    Returns the user dict on success, or None on failure.
    This approach works regardless of which JWT secret format Supabase uses.
    """
    supabase_url  = app.config.get("SUPABASE_URL", "").rstrip("/")
    supabase_anon = app.config.get("SUPABASE_ANON_KEY", "")

    if not supabase_url:
        return None

    try:
        resp = http_requests.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": supabase_anon,
            },
            timeout=8,
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception as e:
        print(f"[Auth] Supabase token verification failed: {e}")
        return None


# ── Auth Decorator ────────────────────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authorization header must be 'Bearer <token>'"}), 401

        token = parts[1]
        user_data = verify_supabase_token(token)

        if not user_data:
            return jsonify({"error": "Invalid or expired token. Please log in again."}), 401

        g.user_id    = user_data.get("id")
        g.user_email = user_data.get("email")
        meta         = user_data.get("user_metadata", {})

        # Upsert profile in our DB (handles first-time login edge cases)
        try:
            profile = Profile.query.get(g.user_id)
            if not profile:
                profile = Profile(
                    id         = g.user_id,
                    email      = g.user_email,
                    full_name  = meta.get("full_name") or meta.get("name") or "User",
                    avatar_url = meta.get("avatar_url") or meta.get("picture") or "",
                )
                db.session.add(profile)
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"[Auth] Profile upsert error: {e}")

        return f(*args, **kwargs)
    return decorated
# ── Global Error Handler ──────────────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_exception(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    print(f"[Unhandled Exception] {e}")
    import traceback
    traceback.print_exc()
    return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()}), 200


@app.route("/api/trigger-test-email", methods=["GET"])
def trigger_test_email():
    import socket
    import smtplib
    import traceback
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    smtp_user     = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    smtp_server   = os.environ.get("SMTP_SERVER", "smtp-relay.brevo.com")
    smtp_port     = int(os.environ.get("SMTP_PORT", 2525))
    smtp_from     = os.environ.get("SMTP_FROM") or smtp_user
    
    info = {
        "smtp_user": smtp_user,
        "smtp_server": smtp_server,
        "smtp_port": smtp_port,
        "smtp_from": smtp_from,
        "has_password": smtp_password is not None and len(smtp_password) > 0
    }
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Render Live SMTP Debug"
        msg["From"]    = f"Assignly App <{smtp_from}>"
        msg["To"]      = "sypher916@gmail.com"
        
        msg.attach(MIMEText("Render Live SMTP Debug", "plain"))
        
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, "sypher916@gmail.com", msg.as_string())
        server.quit()
        
        return jsonify({
            "success": True,
            "message": "Connected and sent email successfully!",
            "env_info": info
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "env_info": info
        }), 500


@app.route("/api/users", methods=["GET"])
@require_auth
def get_users():
    try:
        users = Profile.query.order_by(Profile.full_name).all()
        return jsonify([u.to_dict() for u in users]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/users", methods=["POST"])
@require_auth
def add_user():
    import uuid
    data = request.json or {}
    email = data.get("email", "").strip()
    full_name = data.get("full_name", "").strip() or "Team Member"
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    try:
        profile = Profile.query.filter_by(email=email).first()
        is_new = False
        if not profile:
            is_new = True
            new_id = uuid.uuid4()
            profile = Profile(
                id=new_id,
                email=email,
                full_name=full_name,
                avatar_url="",
            )
            db.session.add(profile)
            db.session.commit()
        else:
            # If name is provided, update it to keep it fresh
            if data.get("full_name"):
                profile.full_name = data.get("full_name").strip()
                db.session.commit()

        # Send teammate invitation email ─────────────────
        try:
            inviter = Profile.query.get(g.user_id)
            inviter_name = inviter.full_name or inviter.email if inviter else "A teammate"
            join_url = app.config.get("FRONTEND_URL", "http://localhost:3000")
            
            html, text = get_teammate_invited_template(
                inviter_name = inviter_name,
                invitee_name = profile.full_name or full_name,
                join_url     = join_url
            )
            
            send_email(
                to_email     = email,
                subject      = f"✨ Join Assignly — Invited by {inviter_name}",
                html_content = html,
                text_content = text
            )
        except Exception as mail_err:
            print(f"[Teammate Invite] Failed to send email: {mail_err}")

        return jsonify(profile.to_dict()), 201 if is_new else 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks", methods=["GET"])
@require_auth
def get_tasks():
    try:
        tasks = Task.query.order_by(Task.created_at.desc()).all()
        return jsonify([t.to_dict() for t in tasks]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    data = request.json or {}
    if not data.get("title", "").strip():
        return jsonify({"error": "Task title is required"}), 400

    try:
        task = Task(
            title       = data["title"].strip(),
            description = data.get("description", "").strip() or None,
            status      = data.get("status", "todo"),
            priority    = data.get("priority", "medium"),
            due_date    = parse_iso_datetime(data.get("due_date")),
            created_by  = g.user_id,
            assigned_to = data.get("assigned_to") or None,
        )
        db.session.add(task)
        db.session.commit()

        # Email notification ──────────────────────────────
        creator  = Profile.query.get(g.user_id)
        assignee = Profile.query.get(task.assigned_to) if task.assigned_to else None

        if assignee and assignee.email:
            formatted_due = (
                task.due_date.strftime("%d %b %Y, %H:%M")
                if task.due_date else "No due date set"
            )
            html, text = get_task_created_template(
                task_title       = task.title,
                task_description = task.description,
                creator_name     = creator.full_name or creator.email,
                assignee_name    = assignee.full_name or assignee.email,
                due_date         = formatted_due,
                priority         = task.priority,
            )
            send_email(
                to_email     = assignee.email,
                subject      = f"📋 New Task Assigned: {task.title}",
                html_content = html,
                text_content = text,
            )

        return jsonify(task.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<uuid:task_id>", methods=["PUT"])
@require_auth
def update_task(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.json or {}
    old_status = task.status
    old_assignee = task.assigned_to

    try:
        if "title"       in data: task.title       = data["title"]
        if "description" in data: task.description = data["description"]
        if "status"      in data: task.status       = data["status"]
        if "priority"    in data: task.priority     = data["priority"]
        if "due_date"    in data: task.due_date     = parse_iso_datetime(data["due_date"])
        if "assigned_to" in data: task.assigned_to  = data["assigned_to"] or None

        task.updated_at = datetime.utcnow()
        db.session.commit()

        # Send assignment notification if assignee changed ───
        if "assigned_to" in data and str(old_assignee) != str(task.assigned_to) and task.assigned_to:
            creator  = Profile.query.get(task.created_by)
            assignee = Profile.query.get(task.assigned_to)
            if assignee and assignee.email:
                formatted_due = (
                    task.due_date.strftime("%d %b %Y, %H:%M")
                    if task.due_date else "No due date set"
                )
                html, text = get_task_created_template(
                    task_title       = task.title,
                    task_description = task.description,
                    creator_name     = creator.full_name or creator.email if creator else "Collaborator",
                    assignee_name    = assignee.full_name or assignee.email,
                    due_date         = formatted_due,
                    priority         = task.priority,
                )
                send_email(
                    to_email     = assignee.email,
                    subject      = f"📋 Task Assigned: {task.title}",
                    html_content = html,
                    text_content = text,
                )

        # Send completion emails ──────────────────────────
        if old_status != "completed" and task.status == "completed":
            creator      = Profile.query.get(task.created_by)
            assignee     = Profile.query.get(task.assigned_to) if task.assigned_to else None
            completed_by = Profile.query.get(g.user_id)

            creator_name     = creator.full_name      or creator.email      if creator      else "Creator"
            assignee_name    = assignee.full_name     or assignee.email     if assignee     else "Unassigned"
            completed_by_name = completed_by.full_name or completed_by.email if completed_by else "User"

            html, text = get_task_completed_template(
                task_title       = task.title,
                task_description = task.description,
                creator_name     = creator_name,
                assignee_name    = assignee_name,
                completed_by_name = completed_by_name,
            )

            emails_sent = set()
            for target in [creator, assignee]:
                if target and target.email and target.email not in emails_sent:
                    send_email(
                        to_email     = target.email,
                        subject      = f"✅ Task Completed: {task.title}",
                        html_content = html,
                        text_content = text,
                    )
                    emails_sent.add(target.email)

        return jsonify(task.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<uuid:task_id>", methods=["DELETE"])
@require_auth
def delete_task(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404

    if str(task.created_by) != str(g.user_id):
        return jsonify({"error": "Only the creator can delete this task"}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"message": "Task deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        # Reflect existing tables — don't recreate them
        db.engine.connect()
    app.run(
        host  = "0.0.0.0",
        port  = int(os.environ.get("PORT", 5000)),
        debug = True,
    )
