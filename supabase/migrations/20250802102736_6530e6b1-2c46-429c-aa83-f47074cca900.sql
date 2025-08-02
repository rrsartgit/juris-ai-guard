-- Add missing columns to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS title TEXT;
UPDATE public.documents SET title = name WHERE title IS NULL;
ALTER TABLE public.documents ALTER COLUMN title SET NOT NULL;
