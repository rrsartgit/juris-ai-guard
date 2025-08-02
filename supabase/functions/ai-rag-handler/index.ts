import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AI Provider Factory Pattern
interface AIProvider {
  generateEmbedding(text: string): Promise<number[]>
  generateResponse(prompt: string, context: string[]): Promise<string>
}

class OpenAIProvider implements AIProvider {
  private apiKey: string

  constructor() {
    this.apiKey = Deno.env.get('OPENAI_API_KEY') || ''
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI embedding error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  }

  async generateResponse(prompt: string, context: string[]): Promise<string> {
    const systemPrompt = `Jesteś ekspertem prawniczym AI dla polskich kancelarii prawnych. 
    Odpowiadaj wyłącznie w języku polskim, używając precyzyjnej terminologii prawniczej.
    
    KONTEKST Z DOKUMENTÓW:
    ${context.join('\n\n---\n\n')}
    
    Udzielaj odpowiedzi opartych wyłącznie na udostępnionym kontekście. Jeśli informacja nie znajduje się w kontekście, wyraźnie to zaznacz.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI completion error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }
}

class GeminiProvider implements AIProvider {
  private apiKey: string

  constructor() {
    this.apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: { parts: [{ text }] }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini embedding error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.embedding.values
  }

  async generateResponse(prompt: string, context: string[]): Promise<string> {
    const systemPrompt = `Jesteś ekspertem prawniczym AI dla polskich kancelarii prawnych. 
    Odpowiadaj wyłącznie w języku polskim, używając precyzyjnej terminologii prawniczej.
    
    KONTEKST Z DOKUMENTÓW:
    ${context.join('\n\n---\n\n')}
    
    Udzielaj odpowiedzi opartych wyłącznie na udostępnionym kontekście. Jeśli informacja nie znajduje się w kontekście, wyraźnie to zaznacz.
    
    PYTANIE: ${prompt}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini completion error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  }
}

// AI Provider Factory
class AIProviderFactory {
  static create(provider: string): AIProvider {
    switch (provider.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider()
      case 'gemini':
        return new GeminiProvider()
      default:
        return new OpenAIProvider() // Default fallback
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      message, 
      caseId, 
      conversationId,
      aiProvider = 'openai' 
    } = await req.json()

    if (!message || !caseId) {
      throw new Error('Message and case ID are required')
    }

    // Initialize AI provider
    const ai = AIProviderFactory.create(aiProvider)

    // Generate embedding for the user's question
    const queryEmbedding = await ai.generateEmbedding(message)

    // Search for similar documents using the database function
    const { data: similarDocs, error: searchError } = await supabaseClient
      .rpc('search_similar_documents', {
        p_case_id: caseId,
        p_query_embedding: `[${queryEmbedding.join(',')}]`,
        p_match_threshold: 0.7,
        p_match_count: 5
      })

    if (searchError) {
      console.error('Search error:', searchError)
    }

    // Extract context from similar documents
    const context = similarDocs?.map(doc => doc.content) || []

    // Generate AI response
    const aiResponse = await ai.generateResponse(message, context)

    // Create or get conversation
    let currentConversationId = conversationId

    if (!currentConversationId) {
      const { data: newConversation, error: convError } = await supabaseClient
        .from('ai_conversations')
        .insert({
          case_id: caseId,
          user_id: req.headers.get('x-user-id'), // Would be extracted from JWT in production
          title: message.substring(0, 50) + '...',
          ai_provider: aiProvider
        })
        .select()
        .single()

      if (convError) {
        throw new Error(`Failed to create conversation: ${convError.message}`)
      }

      currentConversationId = newConversation.id
    }

    // Save user message
    await supabaseClient
      .from('ai_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: message
      })

    // Save AI response
    await supabaseClient
      .from('ai_messages')
      .insert({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          sources_used: similarDocs?.length || 0,
          ai_provider: aiProvider,
          similarity_threshold: 0.7
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        conversationId: currentConversationId,
        sourcesCount: similarDocs?.length || 0,
        aiProvider
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('AI RAG handler error:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})