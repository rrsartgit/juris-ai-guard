-- Add RLS policies for new tables

-- Policies for ai_conversations  
CREATE POLICY "Users can view conversations in their cases" 
ON public.ai_conversations FOR SELECT 
USING (
    case_id IN (
        SELECT cases.id FROM cases 
        WHERE (cases.law_firm_id = get_user_law_firm(auth.uid())) 
        OR (cases.client_id IN (
            SELECT clients.id FROM clients 
            WHERE clients.user_id = auth.uid()
        ))
    )
);

CREATE POLICY "Users can create conversations in their cases" 
ON public.ai_conversations FOR INSERT 
WITH CHECK (
    case_id IN (
        SELECT cases.id FROM cases 
        WHERE (cases.law_firm_id = get_user_law_firm(auth.uid())) 
        OR (cases.client_id IN (
            SELECT clients.id FROM clients 
            WHERE clients.user_id = auth.uid()
        ))
    )
);

-- Policies for ai_messages
CREATE POLICY "Users can view messages in their conversations" 
ON public.ai_messages FOR SELECT 
USING (
    conversation_id IN (
        SELECT id FROM public.ai_conversations 
        WHERE case_id IN (
            SELECT cases.id FROM cases 
            WHERE (cases.law_firm_id = get_user_law_firm(auth.uid())) 
            OR (cases.client_id IN (
                SELECT clients.id FROM clients 
                WHERE clients.user_id = auth.uid()
            ))
        )
    )
);

CREATE POLICY "Users can create messages in their conversations" 
ON public.ai_messages FOR INSERT 
WITH CHECK (
    conversation_id IN (
        SELECT id FROM public.ai_conversations 
        WHERE case_id IN (
            SELECT cases.id FROM cases 
            WHERE (cases.law_firm_id = get_user_law_firm(auth.uid())) 
            OR (cases.client_id IN (
                SELECT clients.id FROM clients 
                WHERE clients.user_id = auth.uid()
            ))
        )
    )
);

-- Policies for processing_queue
CREATE POLICY "Users can view their processing queue" 
ON public.processing_queue FOR SELECT 
USING (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE case_id IN (
            SELECT cases.id FROM cases 
            WHERE (cases.law_firm_id = get_user_law_firm(auth.uid())) 
            OR (cases.client_id IN (
                SELECT clients.id FROM clients 
                WHERE clients.user_id = auth.uid()
            ))
        )
    )
);