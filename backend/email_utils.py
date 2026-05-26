import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load env variables
load_dotenv()

from config import Config

def send_email(to_email, subject, html_content, text_content):
    smtp_user     = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    smtp_server   = os.environ.get("SMTP_SERVER", "smtp-relay.brevo.com")
    smtp_port     = int(os.environ.get("SMTP_PORT", 2525))
    # SMTP_FROM = actual sender email shown to recipients
    # SMTP_USER = login credential (Brevo relay user, different from sender)
    smtp_from     = os.environ.get("SMTP_FROM") or smtp_user
    
    if not smtp_user or not smtp_password:
        print("SMTP email configuration is missing or incomplete in .env.")
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Assignly App <{smtp_from}>"
        msg["To"]      = to_email
        
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, to_email, msg.as_string())
        server.quit()
        print(f"Email successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}") 
        return False

def get_task_created_template(task_title, task_description, creator_name, assignee_name, due_date, priority):
    p_color = "#8FBC8B" # green for low
    p_bg = "#E8F5E9"
    if priority.lower() == 'high':
        p_color = "#D98080"
        p_bg = "#FCE8E6"
    elif priority.lower() == 'medium':
        p_color = "#C9A96E"
        p_bg = "#FDF6E2"
        
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #FAF6EE;
                color: #2E2514;
                margin: 0;
                padding: 40px 16px;
            }}
            .container {{
                max-width: 580px;
                margin: 0 auto;
                background-color: #FDFBF7;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(60,35,10,0.06);
                border: 1px solid #E8DCC4;
            }}
            .header {{
                background-color: #FAF6EE;
                border-bottom: 1px solid #E8DCC4;
                padding: 32px;
                text-align: center;
            }}
            .header-logo {{
                font-size: 20px;
                font-weight: 700;
                color: #7A6037;
                letter-spacing: -0.3px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }}
            .content {{
                padding: 40px 32px;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 12px;
                color: #2E2514;
                letter-spacing: -0.2px;
            }}
            .intro {{
                font-size: 15px;
                color: #61533B;
                line-height: 1.6;
                margin-bottom: 28px;
            }}
            .card {{
                background-color: #F4EDE0;
                border: 1px solid #E8DCC4;
                border-radius: 18px;
                padding: 28px;
                margin-bottom: 32px;
            }}
            .card-title {{
                font-size: 18px;
                font-weight: 700;
                color: #2E2514;
                margin: 0 0 12px 0;
                line-height: 1.4;
            }}
            .card-desc {{
                font-size: 14px;
                color: #61533B;
                line-height: 1.6;
                margin: 0 0 20px 0;
            }}
            .meta-grid {{
                border-top: 1px solid #E8DCC4;
                padding-top: 18px;
            }}
            .meta-row {{
                margin-bottom: 10px;
            }}
            .meta-row:last-child {{
                margin-bottom: 0;
            }}
            .meta-label {{
                display: inline-block;
                width: 110px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                color: #8A7550;
                letter-spacing: 0.05em;
            }}
            .meta-value {{
                display: inline-block;
                font-size: 14px;
                color: #2E2514;
                font-weight: 600;
            }}
            .badge {{
                display: inline-block;
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 999px;
                color: {p_color};
                background-color: {p_bg};
                border: 1px solid {p_color}40;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }}
            .btn-container {{
                text-align: center;
            }}
            .btn {{
                display: inline-block;
                background-color: #7A6037;
                color: #FAF6EE !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 14px;
                box-shadow: 0 4px 12px rgba(122,96,55,0.15);
                transition: transform 0.2s ease;
            }}
            .footer {{
                background-color: #FAF6EE;
                padding: 28px;
                text-align: center;
                border-top: 1px solid #E8DCC4;
                font-size: 11px;
                color: #8A7550;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-logo">
                    <span style="color: #C9A96E;">✦</span> Assignly
                </div>
            </div>
            <div class="content">
                <p class="greeting">Hi {assignee_name},</p>
                <p class="intro">You have been assigned a new task by <strong>{creator_name}</strong>. Here are the details:</p>
                
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
                            <span class="meta-value" style="color: #61533B;">{due_date or 'No due date set'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Assigned By:</span>
                            <span class="meta-value">{creator_name}</span>
                        </div>
                    </div>
                </div>
                
                <div class="btn-container">
                    <a href="{Config.FRONTEND_URL}/dashboard" class="btn">View Task on Dashboard</a>
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #FAF6EE;
                color: #2E2514;
                margin: 0;
                padding: 40px 16px;
            }}
            .container {{
                max-width: 580px;
                margin: 0 auto;
                background-color: #FDFBF7;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(60,35,10,0.06);
                border: 1px solid #E8DCC4;
            }}
            .header {{
                background-color: #FAF6EE;
                border-bottom: 1px solid #E8DCC4;
                padding: 32px;
                text-align: center;
            }}
            .header-logo {{
                font-size: 20px;
                font-weight: 700;
                color: #7A6037;
                letter-spacing: -0.3px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }}
            .content {{
                padding: 40px 32px;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 12px;
                color: #2E2514;
                letter-spacing: -0.2px;
            }}
            .intro {{
                font-size: 15px;
                color: #61533B;
                line-height: 1.6;
                margin-bottom: 28px;
            }}
            .card {{
                background-color: #E8F2E7;
                border: 1px solid #C5E0C2;
                border-radius: 18px;
                padding: 28px;
                margin-bottom: 32px;
            }}
            .card-title {{
                font-size: 18px;
                font-weight: 700;
                color: #22541D;
                margin: 0 0 12px 0;
                line-height: 1.4;
                text-decoration: line-through;
            }}
            .card-desc {{
                font-size: 14px;
                color: #2E5A2A;
                line-height: 1.6;
                margin: 0 0 20px 0;
            }}
            .meta-grid {{
                border-top: 1px solid #C5E0C2;
                padding-top: 18px;
            }}
            .meta-row {{
                margin-bottom: 10px;
            }}
            .meta-row:last-child {{
                margin-bottom: 0;
            }}
            .meta-label {{
                display: inline-block;
                width: 120px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                color: #2A5D25;
                letter-spacing: 0.05em;
            }}
            .meta-value {{
                display: inline-block;
                font-size: 14px;
                color: #22541D;
                font-weight: 600;
            }}
            .badge {{
                display: inline-block;
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 999px;
                color: #FAF6EE;
                background-color: #8FBC8B;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }}
            .btn-container {{
                text-align: center;
            }}
            .btn {{
                display: inline-block;
                background-color: #8FBC8B;
                color: #FAF6EE !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 14px;
                box-shadow: 0 4px 12px rgba(143,188,139,0.25);
                transition: transform 0.2s ease;
            }}
            .footer {{
                background-color: #FAF6EE;
                padding: 28px;
                text-align: center;
                border-top: 1px solid #E8DCC4;
                font-size: 11px;
                color: #8A7550;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-logo">
                    <span style="color: #8FBC8B;">✓</span> Assignly
                </div>
            </div>
            <div class="content">
                <p class="greeting">Hi there,</p>
                <p class="intro">Great news! A task has been marked as <strong>completed</strong> on Assignly. Below are the details:</p>
                
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
                    <a href="{Config.FRONTEND_URL}/dashboard" class="btn">View Workspace</a>
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


def get_teammate_invited_template(inviter_name, invitee_name, join_url):
    text_content = f"""
    Hi {invitee_name},
    
    Great news! {inviter_name} has invited you to join the team workspace on Assignly.
    
    Assignly is a beautiful, calm, and productive workspace for your team to assign, track, and complete tasks with ease.
    
    If you don't have an account yet, please sign up by clicking the link below:
    {join_url}
    
    Best regards,
    Team Assignly
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #FAF6EE;
                color: #2E2514;
                margin: 0;
                padding: 40px 16px;
            }}
            .container {{
                max-width: 580px;
                margin: 0 auto;
                background-color: #FDFBF7;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(60,35,10,0.06);
                border: 1px solid #E8DCC4;
            }}
            .header {{
                background-color: #FAF6EE;
                border-bottom: 1px solid #E8DCC4;
                padding: 32px;
                text-align: center;
            }}
            .header-logo {{
                font-size: 20px;
                font-weight: 700;
                color: #7A6037;
                letter-spacing: -0.3px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }}
            .content {{
                padding: 40px 32px;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 12px;
                color: #2E2514;
                letter-spacing: -0.2px;
            }}
            .intro {{
                font-size: 15px;
                color: #61533B;
                line-height: 1.6;
                margin-bottom: 28px;
            }}
            .card {{
                background-color: #FDF6E2;
                border: 1px solid #EDD9B8;
                border-radius: 18px;
                padding: 28px;
                margin-bottom: 32px;
                text-align: center;
            }}
            .card-title {{
                font-size: 18px;
                font-weight: 700;
                color: #7A6037;
                margin: 0 0 12px 0;
                line-height: 1.4;
            }}
            .card-desc {{
                font-size: 14px;
                color: #61533B;
                line-height: 1.6;
                margin: 0;
            }}
            .btn-container {{
                text-align: center;
                margin-top: 8px;
            }}
            .btn {{
                display: inline-block;
                background-color: #C9A96E;
                color: #FAF6EE !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 14px;
                box-shadow: 0 4px 12px rgba(201,169,110,0.25);
                transition: transform 0.2s ease;
            }}
            .footer {{
                background-color: #FAF6EE;
                padding: 28px;
                text-align: center;
                border-top: 1px solid #E8DCC4;
                font-size: 11px;
                color: #8A7550;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-logo">
                    <span style="color: #C9A96E;">✨</span> Assignly
                </div>
            </div>
            <div class="content">
                <p class="greeting">Hi {invitee_name},</p>
                <p class="intro">Great news! <strong>{inviter_name}</strong> has invited you to join their collaborative team workspace on Assignly.</p>
                
                <div class="card">
                    <h3 class="card-title">You're Invited!</h3>
                    <p class="card-desc">Assignly is a beautiful, calm, and productive workspace for your team to assign, track, and complete tasks with ease.</p>
                </div>
                
                <div class="btn-container">
                    <a href="{join_url}" class="btn">Join Workspace & Create Account</a>
                </div>
            </div>
            <div class="footer">
                <p>If you already have an account, clicking the button will take you directly to your dashboard.<br>&copy; 2026 Assignly. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content, text_content

def get_task_assigned_template_with_image(task_title, task_description, creator_name, assignee_name, due_date, priority, product_image_url):
    p_color = "#8FBC8B" # green for low
    p_bg = "#E8F5E9"
    if priority.lower() == 'high':
        p_color = "#D98080"
        p_bg = "#FCE8E6"
    elif priority.lower() == 'medium':
        p_color = "#C9A96E"
        p_bg = "#FDF6E2"
        
    img_html = ""
    if product_image_url:
        img_html = f"""
        <div style="text-align: center; margin: 20px 0; border: 1px solid #E8DCC4; border-radius: 12px; overflow: hidden; background: #FAF6EE; padding: 12px;">
            <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8A7550; letter-spacing: 0.05em;">Product Image Preview</p>
            <img src="{product_image_url}" alt="Product" style="max-width: 100%; max-height: 240px; object-fit: contain; border-radius: 8px;" />
        </div>
        """
        
    text_content = f"""
    Hi {assignee_name},
    
    A new AI Image Generation task '{task_title}' has been assigned to you by {creator_name} on Assignly.
    
    Description: {task_description or 'No description provided.'}
    Due Date: {due_date or 'No due date set'}
    Priority: {priority.upper()}
    
    Please log in to your dashboard to open the AI Studio and generate the 8 required variations.
    
    Best regards,
    Team Assignly
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #FAF6EE;
                color: #2E2514;
                margin: 0;
                padding: 40px 16px;
            }}
            .container {{
                max-width: 580px;
                margin: 0 auto;
                background-color: #FDFBF7;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(60,35,10,0.06);
                border: 1px solid #E8DCC4;
            }}
            .header {{
                background-color: #FAF6EE;
                border-bottom: 1px solid #E8DCC4;
                padding: 32px;
                text-align: center;
            }}
            .header-logo {{
                font-size: 20px;
                font-weight: 700;
                color: #7A6037;
                letter-spacing: -0.3px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }}
            .content {{
                padding: 40px 32px;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 12px;
                color: #2E2514;
                letter-spacing: -0.2px;
            }}
            .intro {{
                font-size: 15px;
                color: #61533B;
                line-height: 1.6;
                margin-bottom: 28px;
            }}
            .card {{
                background-color: #F4EDE0;
                border: 1px solid #E8DCC4;
                border-radius: 18px;
                padding: 28px;
                margin-bottom: 32px;
            }}
            .card-title {{
                font-size: 18px;
                font-weight: 700;
                color: #2E2514;
                margin: 0 0 12px 0;
                line-height: 1.4;
            }}
            .card-desc {{
                font-size: 14px;
                color: #61533B;
                line-height: 1.6;
                margin: 0 0 20px 0;
            }}
            .meta-grid {{
                border-top: 1px solid #E8DCC4;
                padding-top: 18px;
            }}
            .meta-row {{
                margin-bottom: 10px;
            }}
            .meta-row:last-child {{
                margin-bottom: 0;
            }}
            .meta-label {{
                display: inline-block;
                width: 110px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                color: #8A7550;
                letter-spacing: 0.05em;
            }}
            .meta-value {{
                display: inline-block;
                font-size: 14px;
                color: #2E2514;
                font-weight: 600;
            }}
            .badge {{
                display: inline-block;
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 999px;
                color: {p_color};
                background-color: {p_bg};
                border: 1px solid {p_color}40;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }}
            .btn-container {{
                text-align: center;
            }}
            .btn {{
                display: inline-block;
                background-color: #7A6037;
                color: #FAF6EE !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 14px;
                box-shadow: 0 4px 12px rgba(122,96,55,0.15);
                transition: transform 0.2s ease;
            }}
            .footer {{
                background-color: #FAF6EE;
                padding: 28px;
                text-align: center;
                border-top: 1px solid #E8DCC4;
                font-size: 11px;
                color: #8A7550;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-logo">
                    <span style="color: #C9A96E;">✦</span> Assignly AI Studio
                </div>
            </div>
            <div class="content">
                <p class="greeting">Hi {assignee_name},</p>
                <p class="intro">A new product showcase task has been assigned to you by <strong>{creator_name}</strong>. Please use the AI Studio to generate the consistent image variants.</p>
                
                <div class="card">
                    <h3 class="card-title">{task_title}</h3>
                    <p class="card-desc">{task_description or 'No description provided.'}</p>
                    
                    {img_html}
                    
                    <div class="meta-grid">
                        <div class="meta-row">
                            <span class="meta-label">Priority:</span>
                            <span class="meta-value"><span class="badge">{priority.upper()}</span></span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Due Date:</span>
                            <span class="meta-value" style="color: #61533B;">{due_date or 'No due date set'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Assigned By:</span>
                            <span class="meta-value">{creator_name}</span>
                        </div>
                    </div>
                </div>
                
                <div class="btn-container">
                    <a href="{Config.FRONTEND_URL}/dashboard" class="btn">Open task in AI Studio</a>
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

def get_task_submitted_template(task_title, user_name, review_url):
    text_content = f"""
    Hi Admin,
    
    Great news! The task '{task_title}' has been completed by {user_name}.
    
    All 8 AI generated variations have been successfully created and are ready for your review.
    
    Please review the submission here: {review_url}
    
    Best regards,
    Team Assignly AI Studio
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #FAF6EE;
                color: #2E2514;
                margin: 0;
                padding: 40px 16px;
            }}
            .container {{
                max-width: 580px;
                margin: 0 auto;
                background-color: #FDFBF7;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(60,35,10,0.06);
                border: 1px solid #E8DCC4;
            }}
            .header {{
                background-color: #FAF6EE;
                border-bottom: 1px solid #E8DCC4;
                padding: 32px;
                text-align: center;
            }}
            .header-logo {{
                font-size: 20px;
                font-weight: 700;
                color: #7A6037;
                letter-spacing: -0.3px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }}
            .content {{
                padding: 40px 32px;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 12px;
                color: #2E2514;
                letter-spacing: -0.2px;
            }}
            .intro {{
                font-size: 15px;
                color: #61533B;
                line-height: 1.6;
                margin-bottom: 28px;
            }}
            .card {{
                background-color: #E8F2E7;
                border: 1px solid #C5E0C2;
                border-radius: 18px;
                padding: 28px;
                margin-bottom: 32px;
            }}
            .card-title {{
                font-size: 18px;
                font-weight: 700;
                color: #22541D;
                margin: 0 0 12px 0;
                line-height: 1.4;
            }}
            .btn-container {{
                text-align: center;
            }}
            .btn {{
                display: inline-block;
                background-color: #8FBC8B;
                color: #FAF6EE !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 14px;
                box-shadow: 0 4px 12px rgba(143,188,139,0.25);
            }}
            .footer {{
                background-color: #FAF6EE;
                padding: 28px;
                text-align: center;
                border-top: 1px solid #E8DCC4;
                font-size: 11px;
                color: #8A7550;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-logo">
                    <span style="color: #8FBC8B;">✦</span> Assignly Review
                </div>
            </div>
            <div class="content">
                <p class="greeting">Hi Admin,</p>
                <p class="intro">The AI generation task has been successfully <strong>submitted</strong> and is ready for your review.</p>
                
                <div class="card">
                    <h3 class="card-title">{task_title}</h3>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #2E5A2A;">Submitted by: <strong>{user_name}</strong></p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #2E5A2A;">Contains exactly 8 generated image variations.</p>
                </div>
                
                <div class="btn-container">
                    <a href="{review_url}" class="btn">Review Submitted Gallery</a>
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

def get_task_review_action_template(task_title, action_type, feedback, reviewer_name):
    # Determine look and feel based on Accept or Revision
    is_accepted = action_type.lower() == 'accepted'
    theme_bg = "#E8F2E7" if is_accepted else "#FCE8E6"
    theme_border = "#C5E0C2" if is_accepted else "#FCD3D1"
    theme_color = "#22541D" if is_accepted else "#A82B2B"
    badge_bg = "#8FBC8B" if is_accepted else "#D98080"
    badge_label = "ACCEPTED" if is_accepted else "REVISION REQUESTED"
    
    text_content = f"""
    Hi,
    
    Your submission for the task '{task_title}' has been reviewed by {reviewer_name}.
    
    Decision: {badge_label}
    
    Feedback: {feedback or 'No additional feedback provided.'}
    
    Please log in to your dashboard to view details.
    
    Best regards,
    Team Assignly AI Studio
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #FAF6EE;
                color: #2E2514;
                margin: 0;
                padding: 40px 16px;
            }}
            .container {{
                max-width: 580px;
                margin: 0 auto;
                background-color: #FDFBF7;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(60,35,10,0.06);
                border: 1px solid #E8DCC4;
            }}
            .header {{
                background-color: #FAF6EE;
                border-bottom: 1px solid #E8DCC4;
                padding: 32px;
                text-align: center;
            }}
            .header-logo {{
                font-size: 20px;
                font-weight: 700;
                color: #7A6037;
                letter-spacing: -0.3px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }}
            .content {{
                padding: 40px 32px;
            }}
            .greeting {{
                font-size: 20px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 12px;
                color: #2E2514;
            }}
            .intro {{
                font-size: 15px;
                color: #61533B;
                line-height: 1.6;
                margin-bottom: 28px;
            }}
            .card {{
                background-color: {theme_bg};
                border: 1px solid {theme_border};
                border-radius: 18px;
                padding: 28px;
                margin-bottom: 32px;
            }}
            .card-title {{
                font-size: 18px;
                font-weight: 700;
                color: {theme_color};
                margin: 0 0 16px 0;
                line-height: 1.4;
            }}
            .badge {{
                display: inline-block;
                padding: 4px 12px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 999px;
                color: #FAF6EE;
                background-color: {badge_bg};
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 16px;
            }}
            .feedback-label {{
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                color: {theme_color};
                letter-spacing: 0.05em;
                margin-bottom: 6px;
                display: block;
            }}
            .feedback-val {{
                font-size: 14px;
                color: #2E2514;
                line-height: 1.6;
                background: rgba(255,255,255,0.4);
                padding: 12px 16px;
                border-radius: 8px;
                margin: 0;
            }}
            .btn-container {{
                text-align: center;
            }}
            .btn {{
                display: inline-block;
                background-color: #7A6037;
                color: #FAF6EE !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 14px;
            }}
            .footer {{
                background-color: #FAF6EE;
                padding: 28px;
                text-align: center;
                border-top: 1px solid #E8DCC4;
                font-size: 11px;
                color: #8A7550;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-logo">
                    <span style="color: #C9A96E;">✦</span> Assignly AI Studio
                </div>
            </div>
            <div class="content">
                <p class="greeting">Hi there,</p>
                <p class="intro">Your submitted task has been reviewed by <strong>{reviewer_name}</strong>. Here is the decision:</p>
                
                <div class="card">
                    <span class="badge">{badge_label}</span>
                    <h3 class="card-title" style="margin: 0 0 16px 0;">{task_title}</h3>
                    
                    <span class="feedback-label">Reviewer Comments:</span>
                    <p class="feedback-val">{feedback or 'No additional feedback provided.'}</p>
                </div>
                
                <div class="btn-container">
                    <a href="{Config.FRONTEND_URL}/dashboard" class="btn">View Task on Dashboard</a>
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
