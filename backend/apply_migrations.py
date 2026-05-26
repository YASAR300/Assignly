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
        # Paths to migrations
        migrations_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "migrations"))
        migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])
        
        for file_name in migration_files:
            file_path = os.path.join(migrations_dir, file_name)
            print(f"\n--- Processing: {file_name} ---")
            with open(file_path, "r", encoding="utf-8") as f:
                sql = f.read()
                
            print(f"Applying migration to Supabase...")
            try:
                with psycopg2.connect(db_url) as file_conn:
                    with file_conn.cursor() as cursor:
                        cursor.execute(sql)
                print(f"Migration {file_name} successfully checked/applied!")
            except Exception as file_err:
                print(f"Notice/Error applying {file_name}: {str(file_err)}")
                print("Continuing to next migration...")
            
        print("\nAll migration checks completed.")
    except Exception as e:
        print(f"Failed to connect or apply migrations: {str(e)}")

if __name__ == "__main__":
    apply_migrations()
