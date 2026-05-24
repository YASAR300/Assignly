import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-12345")

    database_url = os.environ.get("DATABASE_URL", "")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Supabase REST verification
    SUPABASE_URL     = os.environ.get("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

    # SMTP
    SMTP_USER     = os.environ.get("SMTP_USER")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
    SMTP_SERVER   = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT     = int(os.environ.get("SMTP_PORT", 587))

    # CORS
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
