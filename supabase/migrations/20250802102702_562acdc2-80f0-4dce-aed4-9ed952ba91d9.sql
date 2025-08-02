-- Add missing tables and functions for PrawoAsystent AI

-- 1. Create AI conversations table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create AI messages table
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create processing queue table
CREATE TABLE IF NOT EXISTS public.processing_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL DEFAULT 'document_analysis',
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    task_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Enable RLS on new tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- 5. Create enqueue_document_processing function
CREATE OR REPLACE FUNCTION public.enqueue_document_processing(
    p_document_id UUID,
    p_task_type TEXT DEFAULT 'document_analysis',
    p_task_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    queue_id UUID;
BEGIN
    INSERT INTO public.processing_queue (document_id, task_type, task_data)
    VALUES (p_document_id, p_task_type, p_task_data)
    RETURNING id INTO queue_id;
    
    RETURN queue_id;
END;
$$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_case_id ON public.ai_conversations(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON public.processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_document_id ON public.processing_queue(document_id);

-- 7. Create triggers for updated_at
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at
BEFORE UPDATE ON public.processing_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
