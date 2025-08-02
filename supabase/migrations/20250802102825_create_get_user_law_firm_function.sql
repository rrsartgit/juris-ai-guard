CREATE OR REPLACE FUNCTION public.get_user_law_firm(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    firm_id UUID;
BEGIN
    SELECT law_firm_id INTO firm_id
    FROM public.profiles
    WHERE user_id = p_user_id;
    
    RETURN firm_id;
END;
$$;
