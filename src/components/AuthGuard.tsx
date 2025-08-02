import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, Scale } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_OUT') {
          navigate('/auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy-light to-gold/20 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gold/20 rounded-full animate-pulse">
              <Scale className="h-8 w-8 text-gold" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">PrawoAsystent AI</h1>
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
          <p className="text-navy-light/80 mt-2">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // If no user and not on auth page, redirect to auth
  if (!user && location.pathname !== '/auth') {
    navigate('/auth');
    return null;
  }

  // If user exists and on auth page, redirect to dashboard
  if (user && location.pathname === '/auth') {
    navigate('/');
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;