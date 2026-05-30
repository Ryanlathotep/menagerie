import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [resetSending, setResetSending] = useState(false);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
          return;
        }
        
        toast.success('Welcome back!');
        navigate('/');
      } else {
        // Use the hashed root so itch.io builds (HashRouter) land on a real route.
        const redirectUrl = `${window.location.origin}${window.location.pathname}#/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Try logging in instead.');
          } else {
            toast.error(error.message);
          }
          return;
        }
        
        toast.success('Account created! Welcome to Monster Menagerie!');
        navigate('/');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      emailSchema.parse(email);
    } catch {
      setErrors((e) => ({ ...e, email: 'Enter your email above first' }));
      return;
    }
    setResetSending(true);
    // HashRouter — recovery tokens must land on the hashed route.
    const redirectUrl = `${window.location.origin}${window.location.pathname}#/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    setResetSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password reset email sent. Check your inbox.');
  };

  const handleContinueAsGuest = () => {
    navigate('/');
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Monster Menagerie
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Welcome back, trainer!' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            {!isLogin && (
              <p className="text-sm text-muted-foreground">
                Must be at least 6 characters.
              </p>
            )}
            {errors.password && (
              <p className="text-sm font-medium text-destructive">{errors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-secondary"
            disabled={loading}
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="text-center space-y-3">
          {isLogin && (
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors block w-full"
              onClick={handleForgotPassword}
              disabled={resetSending}
            >
              {resetSending ? 'Sending reset email…' : 'Forgot your password?'}
            </button>
          )}
          <button
            type="button"
            className="text-base font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleContinueAsGuest}
          >
            Continue as Guest
          </Button>
          <p className="text-xs text-muted-foreground">
            Guest progress is saved locally only
          </p>
        </div>
      </Card>
    </main>
  );
}
