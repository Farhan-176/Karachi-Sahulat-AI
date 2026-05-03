import { useEffect, useState } from 'react';
import { checkUserProfile } from '../services/db';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Logo } from './Logo';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await checkUserProfile(u.uid, u.email || '', u.displayName || '');
        setUser(u);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
      <p className="text-stone-500 font-mono text-sm">Loading Karachi Sahulat...</p>
    </div>;
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-stone-100 p-4">
        <Card className="w-full max-w-sm shadow-xl border-t-4 border-emerald-600">
          <CardHeader className="space-y-2 pb-6">
          <div className="flex justify-center mb-2">
            <Logo size={56} className="mb-4 drop-shadow-sm" />
          </div>
          <CardTitle className="text-center text-2xl font-semibold tracking-tight text-stone-900">Karachi Sahulat AI</CardTitle>
            <CardDescription className="text-center font-medium text-stone-600">
              Empowering Karachiites with local, actionable urban intelligence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-stone-600 text-center pb-8 border-b border-stone-100">
            Get instant neighborhood-specific advice on load-shedding, nullah clearance, traffic, and water tanker schedules.
          </CardContent>
          <CardFooter className="pt-6">
            <Button 
              className="w-full bg-stone-900 hover:bg-stone-800 text-white shadow-md transition-all active:scale-95" 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            >
              Sign in with Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuth() {
  return auth.currentUser;
}
