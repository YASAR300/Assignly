import uuid
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    name = db.Column(db.String(255))
    role = db.Column(db.String(50), default='user', nullable=False) # 'admin', 'user'
    oauth_data = db.Column(JSONB)
    avatar_url = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tasks_created = db.relationship('Task', backref='creator', lazy=True, foreign_keys='Task.created_by')
    tasks_assigned = db.relationship('Task', backref='assignee', lazy=True, foreign_keys='Task.assigned_to')
    audit_logs = db.relationship('AuditLog', backref='user', lazy=True)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "name": self.name,
            "full_name": self.name, # keeping full_name for backward compatibility with frontend
            "role": self.role,
            "oauth_data": self.oauth_data,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), default='pending', nullable=False) # 'pending', 'assigned', 'in_progress', 'submitted', 'accepted', 'revision_requested'
    priority = db.Column(db.String(50), default='medium', nullable=False) # 'low', 'medium', 'high'
    due_date = db.Column(db.DateTime)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    assigned_to = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'))
    product_image_url = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    generated_images = db.relationship('GeneratedImage', backref='task', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "created_by": str(self.created_by),
            "assigned_to": str(self.assigned_to) if self.assigned_to else None,
            "product_image_url": self.product_image_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "creator_name": self.creator.name if self.creator else "Unknown",
            "assignee_name": self.assignee.name if self.assignee else "Unassigned",
            "assignee_email": self.assignee.email if self.assignee else None,
            "assignee_avatar": self.assignee.avatar_url if self.assignee else None
        }

class GeneratedImage(db.Model):
    __tablename__ = 'generated_images'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = db.Column(UUID(as_uuid=True), db.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    image_type = db.Column(db.String(50), nullable=False)
    image_url = db.Column(db.Text, nullable=False)
    prompt_used = db.Column(db.Text, nullable=False)
    meta_data = db.Column('metadata', JSONB) # mapped to column 'metadata' to bypass reserved keyword
    angle = db.Column(db.String(50))
    is_final = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "task_id": str(self.task_id),
            "image_type": self.image_type,
            "image_url": self.image_url,
            "prompt_used": self.prompt_used,
            "metadata": self.meta_data, # keeping key as 'metadata' for frontend API compatibility
            "angle": self.angle,
            "is_final": self.is_final,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'))
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(UUID(as_uuid=True))
    details = db.Column(JSONB)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": str(self.target_id) if self.target_id else None,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_name": self.user.name if self.user else "System"
        }
