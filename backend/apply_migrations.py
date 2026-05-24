import os
import psycopg2
from dotenv import load_dotenv

# Load env variables
load_dotenv()

def apply_migrations():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL is not set in environment variables.")
        return
        
    print("Connecting to Supabase PostgreSQL database...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Read the migration SQL file
        migration_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "migrations", "01_init_schema.sql"))
        print(f"Reading migration file: {migration_file}")
        with open(migration_file, "r") as f:
            sql = f.read()
            
        print("Applying migrations on Supabase...")
        cursor.execute(sql)
        print("Migrations successfully applied! Tables and triggers are now live on Supabase.")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Failed to apply migrations: {str(e)}")

if __name__ == "__main__":
    apply_migrations()
