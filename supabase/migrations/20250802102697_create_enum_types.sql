-- Create missing enum types required for authentication

-- 1. Create user_role enum
CREATE TYPE user_role AS ENUM ('client', 'lawyer', 'admin');

-- 2. Create case_status enum  
CREATE TYPE case_status AS ENUM ('pending', 'active', 'completed', 'cancelled');

-- 3. Create case_priority enum
CREATE TYPE case_priority AS ENUM ('low', 'medium', 'high', 'urgent');
