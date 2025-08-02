import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import DocumentUploader from "@/components/DocumentUploader";
import AIAssistant from "@/components/AIAssistant";
import { useToast } from "@/hooks/use-toast";
import { Scale, Shield, Brain, FileText, Users, LogOut, Plus, Calendar } from "lucide-react";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Get user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setProfile(profileData);

        // Get user's cases
        const { data: casesData } = await supabase
          .from('cases')
          .select(`
            *,
            clients(first_name, last_name),
            law_firms(name)
          `)
          .or(`client_id.in.(select id from clients where user_id = '${user.id}'),law_firm_id.in.(select id from law_firms where id = '${profileData?.law_firm_id}')`)
          .order('created_at', { ascending: false });

        setCases(casesData || []);
        
        if (casesData && casesData.length > 0) {
          setSelectedCase(casesData[0].id);
        }
      }
      
      setLoading(false);
    };

    getProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of PrawoAsystent AI",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy-light to-gold/20 flex items-center justify-center">
        <div className="text-center">
          <Scale className="h-12 w-12 animate-pulse text-gold mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-light to-gold/20">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-navy/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy rounded-lg">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-navy">PrawoAsystent AI</h1>
                <p className="text-sm text-muted-foreground">Secure Legal Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {profile && (
                <div className="text-right">
                  <p className="font-medium text-navy">
                    {profile.first_name} {profile.last_name}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {profile.role}
                  </Badge>
                </div>
              )}
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back, {profile?.first_name}!
          </h2>
          <p className="text-navy-light/80">
            Manage your legal cases with AI-powered document analysis and secure encryption.
          </p>
        </div>

        {/* Cases Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Active Cases
            </CardTitle>
            <CardDescription>
              Select a case to work with documents and AI assistant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No cases found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Contact your law firm administrator to be assigned to cases.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Request Case Access
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cases.map((case_) => (
                  <Card
                    key={case_.id}
                    className={`cursor-pointer transition-all border-2 ${
                      selectedCase === case_.id
                        ? 'border-navy bg-navy/5'
                        : 'border-border hover:border-navy/50'
                    }`}
                    onClick={() => setSelectedCase(case_.id)}
                  >
                    <CardContent className="p-4">
                      <h3 className="font-medium mb-2">{case_.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {case_.description || "No description"}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(case_.created_at).toLocaleDateString()}
                        </div>
                        <Badge variant={case_.status === 'active' ? 'default' : 'secondary'}>
                          {case_.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Workspace */}
        {selectedCase ? (
          <Tabs defaultValue="documents" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="ai-assistant" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Assistant
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-6">
              <DocumentUploader
                caseId={selectedCase}
                onUploadComplete={(documentId) => {
                  toast({
                    title: "Document uploaded",
                    description: "Document has been securely uploaded and will be processed shortly.",
                  });
                }}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Case Documents</CardTitle>
                  <CardDescription>
                    All documents for this case with encryption status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4" />
                    <p>Document list will appear here after uploading</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-assistant">
              <AIAssistant caseId={selectedCase} />
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Document Analysis</CardTitle>
                  <CardDescription>
                    AI-powered insights and document analysis results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4" />
                    <p>Analysis results will appear here after processing documents</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Case</h3>
              <p className="text-muted-foreground">
                Choose a case from the list above to start working with documents and AI assistant.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Security Features Footer */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 text-gold mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">End-to-End Encryption</h3>
              <p className="text-sm text-navy-light/80">
                All documents protected with AES-256 envelope encryption
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <Brain className="h-12 w-12 text-gold mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">AI-Powered Analysis</h3>
              <p className="text-sm text-navy-light/80">
                Advanced legal document analysis with OpenAI and Gemini
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 text-gold mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Secure Collaboration</h3>
              <p className="text-sm text-navy-light/80">
                Role-based access control for law firms and clients
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
