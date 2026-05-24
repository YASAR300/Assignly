import os
import jwt
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from functools import wraps
from datetime import datetime
from models import db, Profile, Task
from config import Config
from email_utils import send_email, get_task_created_template, get_task_completed_template

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for the frontend URL
CORS(app, resources={r"/api/*": {"origins": [app.config["FRONTEND_URL"], "http://localhost:3000"]}})

# Initialize database
db.init_app(app)

# Helper function to parse ISO date strings from frontend
def parse_iso_datetime(date_str):
    if not date_str:
        return None
    try:
        if date_str.endswith('Z'):
            date_str = date_str[:-1] + '+00:00'
        return datetime.fromisoformat(date_str)
    except Exception as e:
        print(f"Error parsing date {date_str}: {str(e)}")
        return None

# Middleware decorator to require and verify Supabase JWT
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
            
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({"error": "Authorization header must be in 'Bearer <token>' format"}), 401
            
        token = parts[1]
        
        try:
            # Supabase JWTs are signed with HS256 and use SUPABASE_JWT_SECRET
            jwt_secret = app.config["SUPABASE_JWT_SECRET"]
            if not jwt_secret:
                return jsonify({"error": "Supabase JWT secret is not configured on the backend"}), 500
                
            # Decode the token
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
            
            # Store user information in flask global context (g)
            g.user_id = payload.get("sub")
            g.user_email = payload.get("email")
            
            # Verify profile exists in public.profiles.
            # If not, create it dynamically (fallback in case trigger has a delay)
            profile = Profile.query.get(g.user_id)
            if not profile:
                profile = Profile(
                    id=g.user_id,
                    email=g.user_email,
                    full_name=payload.get("user_metadata", {}).get("full_name") or payload.get("user_metadata", {}).get("name") or "User",
                    avatar_url=payload.get("user_metadata", {}).get("avatar_url") or payload.get("user_metadata", {}).get("picture") or ""
                )
                db.session.add(profile)
                db.session.commit()
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401
        except Exception as e:
            return jsonify({"error": f"Authentication failed: {str(e)}"}), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "time": datetime.utcnow().isoformat()}), 200

# Endpoint to list all profiles (for assignee dropdown list)
@app.route("/api/users", methods=["GET"])
@require_auth
def get_users():
    try:
        users = Profile.query.all()
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve users: {str(e)}"}), 500

# Endpoint to fetch tasks (optionally filtered by created_by or assigned_to)
@app.route("/api/tasks", methods=["GET"])
@require_auth
def get_tasks():
    try:
        # Return all tasks representing a general dashboard workspace
        tasks = Task.query.order_by(Task.created_at.desc()).all()
        return jsonify([task.to_dict() for task in tasks]), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve tasks: {str(e)}"}), 500

# Endpoint to create a task
@app.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    data = request.json
    if not data or not data.get("title"):
        return jsonify({"error": "Task title is required"}), 400
        
    try:
        due_date_parsed = parse_iso_datetime(data.get("due_date"))
        
        # Create Task
        new_task = Task(
            title=data.get("title"),
            description=data.get("description"),
            status=data.get("status", "todo"),
            priority=data.get("priority", "medium"),
            due_date=due_date_parsed,
            created_by=g.user_id,
            assigned_to=data.get("assigned_to") # can be None
        )
        
        db.session.add(new_task)
        db.session.commit()
        
        # Load relationships for emails
        creator = Profile.query.get(g.user_id)
        assignee = None
        if new_task.assigned_to:
            assignee = Profile.query.get(new_task.assigned_to)
            
        # Send Email Notification to assignee if assigned to someone else
        if assignee and assignee.email:
            formatted_due = due_date_parsed.strftime("%Y-%m-%d %H:%M") if due_date_parsed else "No due date set"
            html, text = get_task_created_template(
                task_title=new_task.title,
                task_description=new_task.description,
                creator_name=creator.full_name or creator.email,
                assignee_name=assignee.full_name or assignee.email,
                due_date=formatted_due,
                priority=new_task.priority
            )
            
            # Send the email in a robust, simple call
            send_email(
                to_email=assignee.email,
                subject=f"New Task Assigned: {new_task.title}",
                html_content=html,
                text_content=text
            )
            
        return jsonify(new_task.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create task: {str(e)}"}), 500

# Endpoint to update a task (status, priority, assignment, details)
@app.route("/api/tasks/<uuid:task_id>", methods=["PUT"])
@require_auth
def update_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    data = request.json
    if not data:
        return jsonify({"error": "No update payload provided"}), 400
        
    try:
        old_status = task.status
        new_status = data.get("status", task.status)
        
        # Update fields if provided
        if "title" in data:
            task.title = data["title"]
        if "description" in data:
            task.description = data["description"]
        if "status" in data:
            task.status = data["status"]
        if "priority" in data:
            task.priority = data["priority"]
        if "due_date" in data:
            task.due_date = parse_iso_datetime(data["due_date"])
        if "assigned_to" in data:
            task.assigned_to = data["assigned_to"]
            
        task.updated_at = datetime.utcnow()
        db.session.commit()
        
        # If status transitioned to completed, trigger notification emails!
        if old_status != "completed" and new_status == "completed":
            creator = Profile.query.get(task.created_by)
            assignee = Profile.query.get(task.assigned_to) if task.assigned_to else None
            completed_by = Profile.query.get(g.user_id)
            
            creator_name = creator.full_name or creator.email if creator else "Creator"
            assignee_name = assignee.full_name or assignee.email if assignee else "Unassigned"
            completed_by_name = completed_by.full_name or completed_by.email if completed_by else "User"
            
            html, text = get_task_completed_template(
                task_title=task.title,
                task_description=task.description,
                creator_name=creator_name,
                assignee_name=assignee_name,
                completed_by_name=completed_by_name
            )
            
            # 1. Notify Creator
            if creator and creator.email:
                send_email(
                    to_email=creator.email,
                    subject=f"Task Completed: {task.title}",
                    html_content=html,
                    text_content=text
                )
                
            # 2. Notify Assignee (if different from Creator)
            if assignee and assignee.email and assignee.id != creator.id:
                send_email(
                    to_email=assignee.email,
                    subject=f"Task Completed: {task.title}",
                    html_content=html,
                    text_content=text
                )
                
        return jsonify(task.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update task: {str(e)}"}), 500

# Endpoint to delete a task (creator only)
@app.route("/api/tasks/<uuid:task_id>", methods=["DELETE"])
@require_auth
def delete_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    # Check authorization: only the creator can delete the task
    if str(task.created_by) != str(g.user_id):
        return jsonify({"error": "Only the task creator is authorized to delete this task"}), 403
        
    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"message": "Task successfully deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete task: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
