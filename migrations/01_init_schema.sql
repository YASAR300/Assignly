-- Create profiles table in the public schema
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo' NOT NULL, -- 'todo', 'in_progress', 'completed'
    priority VARCHAR(50) DEFAULT 'medium' NOT NULL, -- 'low', 'medium', 'high'
    due_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read all tasks" ON public.tasks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert tasks" ON public.tasks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow creators or assignees to update tasks" ON public.tasks
    FOR UPDATE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Allow creators to delete tasks" ON public.tasks
    FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Trigger function to automatically insert new user profiles when a user signs up/in
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_id UUID;
BEGIN
    -- Check if a profile already exists for this email
    SELECT id INTO existing_id FROM public.profiles WHERE email = NEW.email;
    
    IF existing_id IS NOT NULL THEN
        -- A placeholder profile already exists!
        -- If the existing profile ID is different from the new auth.users ID, we must update it
        IF existing_id <> NEW.id THEN
            -- Update the profile's ID to match the new auth.users ID
            -- First, update tasks that reference the old ID
            UPDATE public.tasks SET created_by = NEW.id WHERE created_by = existing_id;
            UPDATE public.tasks SET assigned_to = NEW.id WHERE assigned_to = existing_id;
            
            -- Then update the profile itself
            UPDATE public.profiles
            SET id = NEW.id,
                full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', full_name),
                avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', avatar_url),
                updated_at = NOW()
            WHERE id = existing_id;
        END IF;
    ELSE
        -- No placeholder profile exists, insert a brand new one
        INSERT INTO public.profiles (id, email, full_name, avatar_url)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute when a new user signs up in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
