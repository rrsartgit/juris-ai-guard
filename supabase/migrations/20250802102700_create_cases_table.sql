CREATE TABLE public.cases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    law_firm_id UUID NOT NULL,
    client_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status case_status NOT NULL DEFAULT 'pending',
    priority case_priority NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
