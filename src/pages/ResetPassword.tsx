import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase fires PASSWORD_RECOVERY when the recovery link is opened.
  // With HashRouter the recovery tokens land in the URL hash; Supabase
  // picks them up automatically via detectSessionInUrl.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    // Also check existing session in case the event fired before mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success('Password updated! You are signed in.');
    navigate('/');
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Reset your password
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {ready
              ? 'Choose a new password for your account.'
              : 'Validating recovery link…'}
          </p>
        </div>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary"
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Update password'}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            If nothing happens, the link may be expired. Request a new reset
            email from the sign-in page.
          </p>
        )}

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            onClick={() => navigate('/auth')}
          >
            Back to sign in
          </button>
        </div>
      </Card>
    </main>
  );
}
