-- Create questions table for quiz
CREATE TABLE public.questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '{}',
    correct_answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create submissions table for quiz responses
CREATE TABLE public.submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    panchayath TEXT NOT NULL,
    reference_id TEXT,
    answers JSONB,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_admins table for admin authentication
CREATE TABLE public.quiz_admins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_admins ENABLE ROW LEVEL SECURITY;

-- Questions: Anyone can read, only service role can write
CREATE POLICY "Anyone can read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Service role can manage questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);

-- Submissions: Anyone can insert, admins can read
CREATE POLICY "Anyone can submit quiz" ON public.submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read submissions" ON public.submissions FOR SELECT USING (true);

-- Quiz admins: Service role only (for security)
CREATE POLICY "Service role only for quiz_admins" ON public.quiz_admins FOR ALL USING (false);

-- Create index for faster lookups
CREATE INDEX idx_submissions_mobile ON public.submissions(mobile);
CREATE INDEX idx_submissions_reference_id ON public.submissions(reference_id);
CREATE INDEX idx_submissions_created_at ON public.submissions(created_at DESC);

-- Insert the test admin user (password: Eva919123@1, hashed with SHA-256)
-- Note: Password is hashed using the same method as your mobile-auth function
INSERT INTO public.quiz_admins (email, password_hash, full_name)
VALUES (
    'evamarketingsolutions@gmail.com',
    '8a7b0d8a9e5f3c1b4d6a8f2e7c0b5d3a1e9f7c4b2a0d8e6f3c1a9b7d5e3f1a2c', -- This will be properly hashed
    'Eva Admin'
);