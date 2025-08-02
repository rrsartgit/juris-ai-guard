import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Brain, Search, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sourcesCount?: number;
  aiProvider?: string;
}

interface AIAssistantProps {
  caseId: string;
  conversationId?: string;
}

const AIAssistant = ({ caseId, conversationId }: AIAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load conversation history
  useEffect(() => {
    if (currentConversationId) {
      loadConversationHistory();
    }
  }, [currentConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversationHistory = async () => {
    try {
      // For now, show a placeholder until AI messages are properly implemented
      setMessages([]);
    } catch (error: any) {
      console.error('Error loading conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Call AI RAG handler Edge Function
      const { data, error } = await supabase.functions.invoke('ai-rag-handler', {
        body: {
          message: input,
          caseId,
          conversationId: currentConversationId,
          aiProvider
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sourcesCount: data.sourcesCount,
        aiProvider: data.aiProvider
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update conversation ID if it's a new conversation
      if (!currentConversationId && data.conversationId) {
        setCurrentConversationId(data.conversationId);
      }

      toast({
        title: "AI Response Generated",
        description: `Found ${data.sourcesCount} relevant document sources`,
      });

    } catch (error: any) {
      console.error('AI request error:', error);
      
      const errorMessage: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}. Please try again or contact support if the issue persists.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "AI Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-navy" />
              PrawoAsystent AI
            </CardTitle>
            <CardDescription>
              AI-powered legal assistant with document analysis
            </CardDescription>
          </div>
          
          <Select value={aiProvider} onValueChange={(value: "openai" | "gemini") => setAiProvider(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI GPT-4</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 text-navy/50" />
                <h3 className="font-medium mb-2">Ask me anything about your case</h3>
                <p className="text-sm">I can analyze documents, answer legal questions, and provide insights based on your case files.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="p-2 bg-navy/10 rounded-full">
                      <Bot className="h-4 w-4 text-navy" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-navy text-white'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      
                      {message.role === 'assistant' && (
                        <>
                          {message.sourcesCount !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              <Search className="h-3 w-3 mr-1" />
                              {message.sourcesCount} sources
                            </Badge>
                          )}
                          
                          {message.aiProvider && (
                            <Badge variant="outline" className="text-xs">
                              {message.aiProvider === 'openai' ? 'GPT-4' : 'Gemini'}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="p-2 bg-gold/10 rounded-full">
                      <User className="h-4 w-4 text-gold" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="p-2 bg-navy/10 rounded-full">
                  <Bot className="h-4 w-4 text-navy" />
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your documents, legal questions, case strategy..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              variant="legal"
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Press Enter to send • Shift+Enter for new line</span>
            <span>Powered by {aiProvider === 'openai' ? 'OpenAI GPT-4' : 'Google Gemini'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAssistant;