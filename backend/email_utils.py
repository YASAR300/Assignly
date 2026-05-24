import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load env variables
load_dotenv()

def send_email(to_email, subject, html_content, text_content):
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    
    if not smtp_user or not smtp_password:
        print("SMTP email configuration is missing or incomplete in .env.")
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Assignly App <{smtp_user}>"
        msg["To"] = to_email
        
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.quit()
        print(f"Email successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False

def get_task_created_template(task_title, task_description, creator_name, assignee_name, due_date, priority):
    # Format priority badge color
    p_color = "#3b82f6" # default medium
    if priority.lower() == 'high':
        p_color = "#ef4444"
    elif priority.lower() == 'low':
        p_color = "#10b981"
        
    text_content = f"""
    Hi {assignee_name},
    
    A new task '{task_title}' has been assigned to you by {creator_name} on Assignly.
    
    Description: {task_description or 'No description provided.'}
    Due Date: {due_date or 'No due date set'}
    Priority: {priority.upper()}
    
    Please log in to your dashboard to review it.
    
    Best regards,
    Team Assignly
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 40px 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }}
            .header {{ background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
            .content {{ padding: 32px; }}
            .greeting {{ font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827; }}
            .intro {{ font-size: 15px; color: #4b5563; line-height: 1.5; margin-bottom: 24px; }}
            .card {{ background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 24px; margin-bottom: 24px; }}
            .card-title {{ font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0; }}
            .card-desc {{ font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px 0; }}
            .meta-grid {{ display: table; width: 100%; border-top: 1px solid #e5e7eb; padding-top: 16px; }}
            .meta-row {{ display: table-row; }}
            .meta-label {{ display: table-cell; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #9ca3af; padding: 4px 0; width: 100px; }}
            .meta-value {{ display: table-cell; font-size: 14px; color: #374151; padding: 4px 0; font-weight: 500; }}
            .badge {{ display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; border-radius: 9999px; color: #ffffff; background-color: {p_color}; }}
            .btn-container {{ text-align: center; margin-top: 8px; }}
            .btn {{ display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-size: 15px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); transition: all 0.2s ease; }}
            .footer {{ background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Assignly Notifications</h1>
            </div>
            <div class="content">
                <p class="greeting">Hi {assignee_name},</p>
                <p class="intro">You have been assigned a new task by <strong>{creator_name}</strong>. Below are the details to help you get started:</p>
                
                <div class="card">
                    <h3 class="card-title">{task_title}</h3>
                    <p class="card-desc">{task_description or 'No description provided.'}</p>
                    
                    <div class="meta-grid">
                        <div class="meta-row">
                            <span class="meta-label">Priority:</span>
                            <span class="meta-value"><span class="badge">{priority.upper()}</span></span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Due Date:</span>
                            <span class="meta-value">{due_date or 'No due date set'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Assigned By:</span>
                            <span class="meta-value">{creator_name}</span>
                        </div>
                    </div>
                </div>
                
                <div class="btn-container">
                    <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard" class="btn">View Task on Dashboard</a>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated notification from Assignly.<br>&copy; 2026 Assignly. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content, text_content

def get_task_completed_template(task_title, task_description, creator_name, assignee_name, completed_by_name):
    text_content = f"""
    Hi,
    
    The task '{task_title}' on Assignly has been successfully completed by {completed_by_name}.
    
    Description: {task_description or 'No description provided.'}
    Assigned to: {assignee_name}
    Created by: {creator_name}
    
    Please log in to your dashboard to review the completed work.
    
    Best regards,
    Team Assignly
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 40px 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }}
            .header {{ background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
            .content {{ padding: 32px; }}
            .greeting {{ font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 8px; color: #111827; }}
            .intro {{ font-size: 15px; color: #4b5563; line-height: 1.5; margin-bottom: 24px; }}
            .card {{ background-color: #f0fdf4; border: 1px solid #d1fae5; border-radius: 12px; padding: 24px; margin-bottom: 24px; }}
            .card-title {{ font-size: 18px; font-weight: 700; color: #065f46; margin: 0 0 12px 0; text-decoration: line-through; }}
            .card-desc {{ font-size: 14px; color: #047857; line-height: 1.6; margin: 0 0 16px 0; }}
            .meta-grid {{ display: table; width: 100%; border-top: 1px solid #a7f3d0; padding-top: 16px; }}
            .meta-row {{ display: table-row; }}
            .meta-label {{ display: table-cell; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #059669; padding: 4px 0; width: 120px; }}
            .meta-value {{ display: table-cell; font-size: 14px; color: #065f46; padding: 4px 0; font-weight: 500; }}
            .badge {{ display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; border-radius: 9999px; color: #ffffff; background-color: #10b981; }}
            .btn-container {{ text-align: center; margin-top: 8px; }}
            .btn {{ display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 12px 28px; font-size: 15px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2); transition: all 0.2s ease; }}
            .footer {{ background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Task Completed!</h1>
            </div>
            <div class="content">
                <p class="greeting">Hi there,</p>
                <p class="intro">Great news! A task has been marked as <strong>completed</strong> on Assignly. Below are the task details:</p>
                
                <div class="card">
                    <h3 class="card-title">{task_title}</h3>
                    <p class="card-desc">{task_description or 'No description provided.'}</p>
                    
                    <div class="meta-grid">
                        <div class="meta-row">
                            <span class="meta-label">Status:</span>
                            <span class="meta-value"><span class="badge">COMPLETED</span></span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Completed By:</span>
                            <span class="meta-value">{completed_by_name}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Assigned To:</span>
                            <span class="meta-value">{assignee_name}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Created By:</span>
                            <span class="meta-value">{creator_name}</span>
                        </div>
                    </div>
                </div>
                
                <div class="btn-container">
                    <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard" class="btn">View Workspace</a>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated notification from Assignly.<br>&copy; 2026 Assignly. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content, text_content
