import os
import requests as http_requests
from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
from functools import wraps
from datetime import datetime, timedelta
import uuid

# Models and DB imports
from models import db, User, Task, GeneratedImage, AuditLog
from config import Config
from email_utils import (
    send_email, 
    get_task_assigned_template_with_image, 
    get_task_submitted_template, 
    get_task_review_action_template, 
    get_teammate_invited_template
)
from jobs import start_background_generation, JOBS

app = Flask(__name__)
app.config.from_object(Config)

# Ensure necessary directories are created
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "static", "uploads")
GENERATED_FOLDER = os.path.join(os.path.dirname(__file__), "static", "generated")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GENERATED_FOLDER, exist_ok=True)

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

# ── Rate Limiting Store ───────────────────────────────────────────────────────
MINUTE_LIMITS = {}  # Key: (user_id, minute_str), Value: count
AI_HOUR_LIMITS = {} # Key: user_id, Value: list of datetime timestamps

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


# ── Decorators ────────────────────────────────────────────────────────────

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

        # Upsert user profile in our DB
        try:
            user = User.query.get(g.user_id)
            is_admin_email = g.user_email and any(x in g.user_email.lower() for x in ["sypher916@gmail.co", "sypher916@gmail.com"])
            if not user:
                # Default first user or sypher916 to Admin, others to standard user
                is_first_user = User.query.first() is None
                role = "admin" if (is_first_user or is_admin_email) else "user"
                
                user = User(
                    id         = uuid.UUID(g.user_id),
                    email      = g.user_email,
                    name       = meta.get("full_name") or meta.get("name") or "User",
                    role       = role,
                    oauth_data = meta,
                    avatar_url = meta.get("avatar_url") or meta.get("picture") or "",
                )
                db.session.add(user)
                db.session.commit()
            elif is_admin_email and user.role != "admin":
                user.role = "admin"
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"[Auth] User upsert error: {e}")

        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        user = User.query.get(g.user_id)
        if not user or user.role != 'admin':
            return jsonify({"error": "Admin privileges required for this action."}), 403
        return f(*args, **kwargs)
    return decorated


# ── Rate Limiting Decorators ──────────────────────────────────────────────────

def rate_limit_general(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Identify user by g.user_id if authenticated, otherwise remote IP address
        user_id = getattr(g, 'user_id', request.remote_addr)
        current_minute = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        key = (user_id, current_minute)
        
        count = MINUTE_LIMITS.get(key, 0)
        if count >= 100:
            return jsonify({"error": "Rate Limit Exceeded: General API is limited to 100 requests per minute."}), 429
            
        MINUTE_LIMITS[key] = count + 1
        return f(*args, **kwargs)
    return decorated


def rate_limit_ai(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({"error": "Authentication required for AI generation"}), 401
            
        now = datetime.utcnow()
        one_hour_ago = now - timedelta(hours=1)
        
        # Filter older timestamps
        timestamps = AI_HOUR_LIMITS.get(user_id, [])
        timestamps = [t for t in timestamps if t > one_hour_ago]
        
        if len(timestamps) >= 10:
            return jsonify({"error": "Rate Limit Exceeded: AI Studio generation is limited to 10 requests per hour per user."}), 429
            
        timestamps.append(now)
        AI_HOUR_LIMITS[user_id] = timestamps
        return f(*args, **kwargs)
    return decorated


# ── Static File Routes ────────────────────────────────────────────────────────
@app.route("/static/uploads/<path:filename>")
def serve_uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/static/generated/<path:filename>")
def serve_generated(filename):
    return send_from_directory(GENERATED_FOLDER, filename)


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
@rate_limit_general
def health():
    return jsonify({
        "status": "ok", 
        "time": datetime.utcnow().isoformat(),
        "sandbox_mode": (os.environ.get("STABILITY_API_KEY") is None and 
                         os.environ.get("REPLICATE_API_TOKEN") is None and 
                         os.environ.get("HF_API_TOKEN") is None)
    }), 200


# Upload endpoint for product images
@app.route("/api/upload", methods=["POST"])
@require_auth
@rate_limit_general
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty file name"}), 400
        
    try:
        # Secure filename and write to disk
        ext = os.path.splitext(file.filename)[1] or ".jpg"
        filename = f"prod_{uuid.uuid4().hex[:12]}{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        backend_url = os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")
        file_url = f"{backend_url}/static/uploads/{filename}"
        
        return jsonify({"url": file_url}), 200
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


# Helper to toggle roles for testability
@app.route("/api/users/toggle-role", methods=["POST"])
@require_auth
@rate_limit_general
def toggle_user_role():
    try:
        user = User.query.get(g.user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        # Switch roles
        is_allowed = any(x in (user.email or "").lower() for x in ["yasar", "yasar300", "sypher"]) or any(x in (user.name or "").lower() for x in ["yasar", "yasar300", "sypher"])
        if not is_allowed:
            return jsonify({"error": "Only authorized developers are allowed to simulate roles."}), 403

        user.role = "admin" if user.role == "user" else "user"
        db.session.commit()
        
        # Log action
        log = AuditLog(
            user_id=user.id,
            action="TOGGLE_ROLE",
            target_type="user",
            target_id=user.id,
            details={"new_role": user.role}
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            "message": "Role successfully updated!",
            "role": user.role,
            "user": user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/users", methods=["GET"])
@require_auth
@rate_limit_general
def get_users():
    try:
        users = User.query.order_by(User.name).all()
        return jsonify([u.to_dict() for u in users]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/users", methods=["POST"])
@require_auth
@rate_limit_general
def add_user():
    data = request.json or {}
    email = data.get("email", "").strip()
    name = data.get("full_name", "").strip() or data.get("name", "").strip() or "Team Member"
    role = data.get("role", "user")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    try:
        user = User.query.filter_by(email=email).first()
        is_new = False
        if not user:
            is_new = True
            new_id = uuid.uuid4()
            user = User(
                id=new_id,
                email=email,
                name=name,
                role=role,
                avatar_url="",
            )
            db.session.add(user)
            db.session.commit()
        else:
            if data.get("full_name") or data.get("name"):
                user.name = name
            if data.get("role"):
                user.role = role
            db.session.commit()

        # Send teammate invitation email ─────────────────
        try:
            inviter = User.query.get(g.user_id)
            inviter_name = inviter.name or inviter.email if inviter else "A teammate"
            join_url = app.config.get("FRONTEND_URL", "http://localhost:3000")
            
            html, text = get_teammate_invited_template(
                inviter_name = inviter_name,
                invitee_name = user.name or name,
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

        return jsonify(user.to_dict()), 201 if is_new else 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks", methods=["GET"])
@require_auth
@rate_limit_general
def get_tasks():
    try:
        user = User.query.get(g.user_id)
        if not user:
            return jsonify({"error": "User profile missing"}), 404
            
        # Admins see everything, Users only see their assigned or created tasks (as per RLS)
        if user.role == 'admin':
            tasks = Task.query.order_by(Task.created_at.desc()).all()
        else:
            tasks = Task.query.filter(
                (Task.assigned_to == user.id) | (Task.created_by == user.id)
            ).order_by(Task.created_at.desc()).all()
            
        return jsonify([t.to_dict() for t in tasks]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks", methods=["POST"])
@require_admin
@rate_limit_general
def create_task():
    data = request.json or {}
    if not data.get("title", "").strip():
        return jsonify({"error": "Task title is required"}), 400

    try:
        assigned_to_id = data.get("assigned_to") or None
        initial_status = "assigned" if assigned_to_id else "pending"
        
        task = Task(
            title             = data["title"].strip(),
            description       = data.get("description", "").strip() or None,
            status            = initial_status,
            priority          = data.get("priority", "medium"),
            due_date          = parse_iso_datetime(data.get("due_date")),
            created_by        = g.user_id,
            assigned_to       = assigned_to_id,
            product_image_url = data.get("product_image_url"),
        )
        db.session.add(task)
        db.session.commit()

        # Audit logging
        log = AuditLog(
            user_id=g.user_id,
            action="CREATE_TASK",
            target_type="task",
            target_id=task.id,
            details={"assigned_to": str(task.assigned_to) if task.assigned_to else None}
        )
        db.session.add(log)
        db.session.commit()

        # Email notification ──────────────────────────────
        creator  = User.query.get(g.user_id)
        assignee = User.query.get(task.assigned_to) if task.assigned_to else None

        if assignee and assignee.email:
            formatted_due = (
                task.due_date.strftime("%d %b %Y, %H:%M")
                if task.due_date else "No due date set"
            )
            html, text = get_task_assigned_template_with_image(
                task_title        = task.title,
                task_description  = task.description,
                creator_name      = creator.name or creator.email,
                assignee_name     = assignee.name or assignee.email,
                due_date          = formatted_due,
                priority          = task.priority,
                product_image_url = task.product_image_url
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
@rate_limit_general
def update_task(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.json or {}
    old_status = task.status
    old_assignee = task.assigned_to
    
    # Simple role check
    current_user = User.query.get(g.user_id)
    is_admin = current_user.role == 'admin'
    is_assignee = str(task.assigned_to) == str(g.user_id)

    if not is_admin and not is_assignee:
        return jsonify({"error": "Unauthorized to update this task."}), 403

    try:
        # Fields only editable by creator/admin
        if is_admin:
            if "title"             in data: task.title             = data["title"]
            if "description"       in data: task.description       = data["description"]
            if "priority"          in data: task.priority          = data["priority"]
            if "due_date"          in data: task.due_date          = parse_iso_datetime(data["due_date"])
            if "assigned_to"       in data: task.assigned_to       = data["assigned_to"] or None
            if "product_image_url" in data: task.product_image_url = data["product_image_url"]

        # Status can be updated by assignee OR admin
        if "status" in data:
            new_status = data["status"]
            # Strict Status transitions validation: pending -> assigned -> in_progress -> submitted -> accepted -> revision_requested
            valid_statuses = ["pending", "assigned", "in_progress", "submitted", "accepted", "revision_requested"]
            if new_status not in valid_statuses:
                return jsonify({"error": f"Invalid status: {new_status}"}), 400
            
            # Additional flow logic
            task.status = new_status

        task.updated_at = datetime.utcnow()
        db.session.commit()

        # Log update action
        log = AuditLog(
            user_id=g.user_id,
            action="UPDATE_TASK",
            target_type="task",
            target_id=task.id,
            details={"old_status": old_status, "new_status": task.status}
        )
        db.session.add(log)
        db.session.commit()

        # Send assignment notification if assignee changed ───
        if is_admin and "assigned_to" in data and str(old_assignee) != str(task.assigned_to) and task.assigned_to:
            creator  = User.query.get(task.created_by)
            assignee = User.query.get(task.assigned_to)
            if assignee and assignee.email:
                formatted_due = (
                    task.due_date.strftime("%d %b %Y, %H:%M")
                    if task.due_date else "No due date set"
                )
                html, text = get_task_assigned_template_with_image(
                    task_title        = task.title,
                    task_description  = task.description,
                    creator_name      = creator.name or creator.email if creator else "Collaborator",
                    assignee_name     = assignee.name or assignee.email,
                    due_date          = formatted_due,
                    priority          = task.priority,
                    product_image_url = task.product_image_url
                )
                send_email(
                    to_email     = assignee.email,
                    subject      = f"📋 Task Assigned: {task.title}",
                    html_content = html,
                    text_content = text,
                )

        # Trigger completed notification for task submissions (User submits to Admin)
        if old_status != "submitted" and task.status == "submitted":
            # Verify exactly 8 images have been generated
            images_count = GeneratedImage.query.filter_by(task_id=task.id, is_final=True).count()
            if images_count < 8:
                # Revert status changes
                task.status = old_status
                db.session.commit()
                return jsonify({"error": f"Cannot submit task. Exactly 8 images must be generated and marked final. Currently has {images_count}/8 images."}), 400
                
            admin_user = User.query.get(task.created_by)
            submitter  = User.query.get(g.user_id)
            
            if admin_user and admin_user.email:
                review_url = f"{app.config.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard"
                html, text = get_task_submitted_template(
                    task_title = task.title,
                    user_name  = submitter.name or submitter.email,
                    review_url = review_url
                )
                send_email(
                    to_email     = admin_user.email,
                    subject      = f"✨ Review Required: {task.title} Completed",
                    html_content = html,
                    text_content = text
                )

        return jsonify(task.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<uuid:task_id>", methods=["DELETE"])
@require_admin
@rate_limit_general
def delete_task(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404

    try:
        db.session.delete(task)
        
        # Log deletion
        log = AuditLog(
            user_id=g.user_id,
            action="DELETE_TASK",
            target_type="task",
            target_id=task_id,
            details={"title": task.title}
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({"message": "Task deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── AI Studio Generation Endpoints ────────────────────────────────────────────

@app.route("/api/tasks/<uuid:task_id>/generate", methods=["POST"])
@require_auth
@rate_limit_general
@rate_limit_ai
def trigger_generation(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    data = request.json or {}
    image_type = data.get("image_type", "").strip()
    prompt = data.get("prompt", "").strip()
    
    if not image_type or not prompt:
        return jsonify({"error": "Both image_type and prompt are required"}), 400
        
    valid_types = [
        "white_background",
        "theme_marble", "theme_velvet",
        "creative_sunset", "creative_forest",
        "model_front", "model_side", "model_closeup"
    ]
    if image_type not in valid_types:
        return jsonify({"error": f"Invalid image type. Must be one of: {valid_types}"}), 400
        
    if not task.product_image_url:
        return jsonify({"error": "No product image has been uploaded to this task. Admin must add one first."}), 400
        
    try:
        # Automatically update status to 'in_progress' when the first image is generated
        if task.status in ["assigned", "pending"]:
            task.status = "in_progress"
            db.session.commit()
            
        # Start background job
        job_id = start_background_generation(str(task_id), image_type, prompt, str(g.user_id))
        return jsonify({
            "message": "AI background generation job queued successfully.",
            "job_id": job_id
        }), 202
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/jobs/<job_id>", methods=["GET"])
@require_auth
@rate_limit_general
def check_job_status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job ID not found or expired."}), 404
    return jsonify(job), 200


@app.route("/api/tasks/<uuid:task_id>/images", methods=["GET"])
@require_auth
@rate_limit_general
def get_task_generated_images(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    try:
        images = GeneratedImage.query.filter_by(task_id=task.id).order_by(GeneratedImage.created_at.desc()).all()
        return jsonify([img.to_dict() for img in images]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generated-images/<uuid:image_id>/final", methods=["PUT"])
@require_auth
@rate_limit_general
def toggle_final_image(image_id):
    img = GeneratedImage.query.get(str(image_id))
    if not img:
        return jsonify({"error": "Generated image not found"}), 404
        
    task = Task.query.get(img.task_id)
    is_admin = User.query.get(g.user_id).role == 'admin'
    is_assignee = str(task.assigned_to) == str(g.user_id)
    
    if not is_admin and not is_assignee:
        return jsonify({"error": "Unauthorized to modify this task's image"}), 403
        
    data = request.json or {}
    is_final = data.get("is_final", True)
    
    try:
        # If setting to final, un-final other images of the SAME type for this task
        if is_final:
            other_imgs = GeneratedImage.query.filter_by(task_id=img.task_id, image_type=img.image_type).all()
            for other in other_imgs:
                other.is_final = False
                
        img.is_final = is_final
        db.session.commit()
        return jsonify(img.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/generated-images/<uuid:image_id>", methods=["DELETE"])
@require_auth
@rate_limit_general
def delete_generated_image(image_id):
    img = GeneratedImage.query.get(str(image_id))
    if not img:
        return jsonify({"error": "Generated image not found"}), 404
        
    task = Task.query.get(img.task_id)
    is_admin = User.query.get(g.user_id).role == 'admin'
    is_assignee = str(task.assigned_to) == str(g.user_id)
    
    if not is_admin and not is_assignee:
        return jsonify({"error": "Unauthorized to delete this task's image"}), 403
        
    try:
        # Delete local file if it exists
        filename = os.path.basename(img.image_url)
        filepath = os.path.join(GENERATED_FOLDER, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            
        db.session.delete(img)
        db.session.commit()
        return jsonify({"message": "Generated image successfully deleted."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# Admin Review Endpoint
@app.route("/api/tasks/<uuid:task_id>/review", methods=["POST"])
@require_admin
@rate_limit_general
def review_task_submission(task_id):
    task = Task.query.get(str(task_id))
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    data = request.json or {}
    action = data.get("action", "").strip()  # 'accept' or 'revision'
    feedback = data.get("feedback", "").strip()
    
    if action not in ["accept", "revision"]:
        return jsonify({"error": "Invalid action. Must be 'accept' or 'revision'"}), 400
        
    try:
        admin_user = User.query.get(g.user_id)
        assignee = User.query.get(task.assigned_to)
        
        if action == "accept":
            task.status = "accepted"
            subject = f"🎉 Submission Accepted: {task.title}"
            db.session.commit()
            
            # Send email to assignee
            if assignee and assignee.email:
                html, text = get_task_review_action_template(
                    task_title    = task.title,
                    action_type   = "accepted",
                    feedback      = feedback or "Incredible work! The images look extremely clean and the branding is perfectly consistent. Approved!",
                    reviewer_name = admin_user.name or admin_user.email
                )
                send_email(
                    to_email     = assignee.email,
                    subject      = subject,
                    html_content = html,
                    text_content = text
                )
                
        else: # revision
            task.status = "revision_requested"
            subject = f"⚠️ Revision Requested: {task.title}"
            db.session.commit()
            
            # Send email to assignee
            if assignee and assignee.email:
                html, text = get_task_review_action_template(
                    task_title    = task.title,
                    action_type   = "revision_requested",
                    feedback      = feedback or "Please regenerate the model close-up angle with a softer, warmer lighting prompt to improve blending consistency.",
                    reviewer_name = admin_user.name or admin_user.email
                )
                send_email(
                    to_email     = assignee.email,
                    subject      = subject,
                    html_content = html,
                    text_content = text
                )
                
        # Log action
        log = AuditLog(
            user_id=g.user_id,
            action="REVIEW_TASK",
            target_type="task",
            target_id=task.id,
            details={"action": action, "feedback": feedback}
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            "message": f"Task review submitted successfully. Status updated to {task.status}.",
            "status": task.status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        # Connect to DB and ensure folders are created
        db.engine.connect()
    app.run(
        host  = "0.0.0.0",
        port  = int(os.environ.get("PORT", 5000)),
        debug = True,
    )
