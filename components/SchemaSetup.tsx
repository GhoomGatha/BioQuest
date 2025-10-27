

import React, { useState } from 'react';

interface SchemaSetupProps {
  onRetry: () => void;
}

const sqlScript = `-- BioQuest Supabase Schema Setup
-- Run this script in your Supabase project's SQL Editor to set up the necessary tables and policies.

-- 0. Create Storage Bucket for Avatars
-- Go to Storage -> Buckets -> Create Bucket
-- Bucket name: avatars
-- Public bucket: Yes
-- After creation, go to the bucket's policies and add the following:

-- This single policy allows authenticated users to view, upload, update, and delete their own
-- files in a folder named after their user ID. This is crucial for avatar management.
CREATE POLICY "User can manage their own avatar folder."
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );


-- 1. PROFILES TABLE: Stores public user data.
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  phone_number text,
  age integer,
  gender text,
  address text,
  date_of_birth date,
  avatar_url text,
  updated_at timestamptz
);

-- 2. Enable Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Function and Trigger to create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. QUESTIONS TABLE: Stores all questions created by users.
-- Note: Supabase JS client maps camelCase (e.g., usedIn) to snake_case (used_in) for column names.
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  class integer NOT NULL,
  chapter text NOT NULL,
  text text NOT NULL,
  answer text,
  marks integer NOT NULL,
  difficulty text NOT NULL,
  used_in jsonb DEFAULT '[]'::jsonb,
  source text NOT NULL,
  year integer NOT NULL,
  semester text NOT NULL,
  tags text[],
  image_data_url text
);

-- 5. Enable RLS for questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own questions." ON public.questions FOR ALL USING (auth.uid() = user_id);

-- 6. PAPERS TABLE: Stores generated or uploaded question papers.
CREATE TABLE public.papers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  year integer NOT NULL,
  class integer NOT NULL,
  semester text NOT NULL,
  source text NOT NULL,
  file_type text,
  text text,
  data_url text,
  questions jsonb DEFAULT '[]'::jsonb
);

-- 7. Enable RLS for papers
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own papers." ON public.papers FOR ALL USING (auth.uid() = user_id);
`;

const SchemaSetup: React.FC<SchemaSetupProps> = ({ onRetry }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-3xl p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center font-serif-display text-slate-800">
          Database Setup Required
        </h1>
        <p className="text-center text-slate-600">
          Welcome to BioQuest! To get started, you need to set up your database tables. Please follow the steps below.
        </p>
        <div className="space-y-4 text-left">
          <div>
            <h2 className="font-semibold text-lg text-slate-700">Step 1: Go to the SQL Editor in Supabase</h2>
            <p className="text-sm text-slate-500">
              Open your Supabase project dashboard, find the "SQL Editor" section in the sidebar (it has a <code className="bg-slate-200 text-xs p-1 rounded">{'<>'}</code> icon), and click on "New query".
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-700">Step 2: Copy and Run the SQL Script</h2>
            <p className="text-sm text-slate-500 mb-2">
              Click the button below to copy the entire SQL script. Paste it into the SQL Editor and click "Run". This will create all the necessary tables and security policies for the app to function correctly.
            </p>
            <div className="relative">
              <pre className="bg-slate-800 text-white p-4 rounded-lg text-xs overflow-auto max-h-60">
                <code>{sqlScript}</code>
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-3 py-1 bg-slate-600 text-white text-xs font-semibold rounded-md hover:bg-slate-500 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
             <p className="text-sm text-slate-500 mt-2">
              <strong>Important:</strong> You also need to create a Storage bucket named "avatars" and set its policies for profile pictures to work. The instructions are commented at the top of the SQL script.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-700">Step 3: All Done!</h2>
            <p className="text-sm text-slate-500">
              Once the script has finished running successfully, come back here and click the button below to continue to the app.
            </p>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="w-full mt-4 px-4 py-3 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-semibold transition-transform hover:scale-105"
        >
          I've run the script, let's go!
        </button>
      </div>
    </div>
  );
};

export default SchemaSetup;