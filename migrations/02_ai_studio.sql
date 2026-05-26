-- Database Migration 02: AI Studio & Task Management
-- Upgrades schema to include 'users' (renamed from profiles), 'generated_images', and 'audit_logs' with RLS policies

BEGIN;

-- 1. Rename profiles to users table if profiles exists, else create users
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')
       AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ALTER TABLE public.profiles RENAME TO users;
        RAISE NOTICE 'Renamed table public.profiles to public.users';
    ELSIF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE TABLE public.users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            role VARCHAR(50) DEFAULT 'user' NOT NULL, -- 'admin' or 'user'
            oauth_data JSONB,
            avatar_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
        RAISE NOTICE 'Created table public.users';
    END IF;
END $$;

-- Add/ensure columns in public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user' NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS oauth_data JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- If renaming occurred, populate 'name' from 'full_name' if available
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name') THEN
        UPDATE public.users SET name = COALESCE(name, full_name);
    END IF;
END $$;

-- 2. Update the Auth trigger function to populate public.users instead of public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_id UUID;
    default_role VARCHAR(50) := 'user';
BEGIN
    -- Check if a user already exists for this email
    SELECT id INTO existing_id FROM public.users WHERE email = NEW.email;
    
    -- First registered user or sypher916@gmail.co/com is automatically Admin for convenience, others are standard users
    IF NOT EXISTS (SELECT 1 FROM public.users) OR NEW.email LIKE '%sypher916@gmail.co%' OR NEW.email LIKE '%sypher916@gmail.com%' THEN
        default_role := 'admin';
    END IF;

    IF existing_id IS NOT NULL THEN
        IF existing_id <> NEW.id THEN
            -- Update references
            UPDATE public.tasks SET created_by = NEW.id WHERE created_by = existing_id;
            UPDATE public.tasks SET assigned_to = NEW.id WHERE assigned_to = existing_id;
            
            -- Update user record
            UPDATE public.users
            SET id = NEW.id,
                name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', name),
                avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', avatar_url),
                oauth_data = NEW.raw_user_meta_data,
                updated_at = NOW()
            WHERE id = existing_id;
        END IF;
    ELSE
        INSERT INTO public.users (id, email, name, role, avatar_url, oauth_data)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
            default_role,
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
            NEW.raw_user_meta_data
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Upgrade public.tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS product_image_url TEXT;

-- Update status constraint on tasks to match the flow:
-- pending -> assigned -> in_progress -> submitted -> accepted -> revision_requested
-- Note: we use VARCHAR(50) to allow flexibility in code, but we can set the default
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'pending';

-- Migrate any old status values to 'pending' or 'in_progress' or 'accepted' (completed)
UPDATE public.tasks SET status = 'pending' WHERE status = 'todo';
UPDATE public.tasks SET status = 'accepted' WHERE status = 'completed';

-- 4. Create public.generated_images table
CREATE TABLE IF NOT EXISTS public.generated_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    image_type VARCHAR(50) NOT NULL, -- e.g. 'white_background', 'theme_marble', etc.
    image_url TEXT NOT NULL,
    prompt_used TEXT NOT NULL,
    metadata JSONB,
    angle VARCHAR(50), -- 'front', 'side', 'closeup' or null
    is_final BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Create public.audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies

-- USERS Table Policies
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read all user records" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;

CREATE POLICY "Users can read all user records" ON public.users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own user record" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- TASKS Table Policies
DROP POLICY IF EXISTS "Allow authenticated users to read all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow users to insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow creators or assignees to update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow creators to delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their tasks, admins see all" ON public.tasks;
DROP POLICY IF EXISTS "Admins can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators or assignees can update tasks, admins see all" ON public.tasks;
DROP POLICY IF EXISTS "Creators or admins can delete tasks" ON public.tasks;

CREATE POLICY "Users can view their tasks, admins see all" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        assigned_to = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can create tasks" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Creators or assignees can update tasks, admins see all" ON public.tasks
    FOR UPDATE TO authenticated
    USING (
        assigned_to = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Creators or admins can delete tasks" ON public.tasks
    FOR DELETE TO authenticated
    USING (
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- GENERATED IMAGES Table Policies
DROP POLICY IF EXISTS "Users can view images for accessible tasks" ON public.generated_images;
DROP POLICY IF EXISTS "Users can manage images for accessible tasks" ON public.generated_images;

CREATE POLICY "Users can view images for accessible tasks" ON public.generated_images
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_id AND (
                t.assigned_to = auth.uid() OR
                t.created_by = auth.uid() OR
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
            )
        )
    );

CREATE POLICY "Users can manage images for accessible tasks" ON public.generated_images
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_id AND (
                t.assigned_to = auth.uid() OR
                t.created_by = auth.uid() OR
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
            )
        )
    );

-- AUDIT LOGS Table Policies
DROP POLICY IF EXISTS "Admins see all logs, users see own logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.audit_logs;

CREATE POLICY "Admins see all logs, users see own logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

CREATE POLICY "Anyone can insert logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

COMMIT;
