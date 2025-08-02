/*
  # Make law_firm_id nullable in profiles table

  1. Changes
    - Make `law_firm_id` column in `profiles` table nullable to allow user signup without requiring law firm assignment
  
  2. Security
    - No changes to existing RLS policies
    - Maintains data integrity while allowing flexible user onboarding
*/

-- Make law_firm_id nullable to allow user signup without law firm assignment
ALTER TABLE public.profiles ALTER COLUMN law_firm_id DROP NOT NULL;