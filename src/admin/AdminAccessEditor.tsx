// Admin access management — only visible / functional to the original admin
// (ryany207@gmail.com). Lets them grant the admin role to any existing
// account by email, list current admins, and revoke admin from others.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ShieldPlus, ShieldOff, Crown } from 'lucide-react';

interface AdminRow {
  user_id: string;
  email: string;
  granted_at: string;
  is_original: boolean;
}

export function AdminAccessEditor() {
  const { user } = useAuth();
  const [isOriginal, setIsOriginal] = useState<boolean | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_admins');
    if (error) {
      console.error('list_admins failed', error);
      toast.error('Could not load admins');
      setAdmins([]);
    } else {
      setAdmins((data ?? []) as AdminRow[]);
    }
    setLoading(false);
  }, []);

  // Detect whether the current user is the original admin.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        setIsOriginal(false);
        return;
      }
      const { data, error } = await supabase.rpc('is_original_admin', {
        _user_id: user.id,
      });
      if (cancelled) return;
      if (error) {
        console.error('is_original_admin failed', error);
        setIsOriginal(false);
      } else {
        setIsOriginal(!!data);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (isOriginal) refresh();
    else setLoading(false);
  }, [isOriginal, refresh]);

  if (isOriginal === null) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking permissions…
      </div>
    );
  }

  if (!isOriginal) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Only the original account owner can manage admin access. If you need
        to grant or revoke admin for another account, ask the owner.
      </Card>
    );
  }

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setGranting(true);
    const { error } = await supabase.rpc('grant_admin_by_email', {
      _email: trimmed,
    });
    setGranting(false);
    if (error) {
      toast.error(error.message || 'Could not grant admin');
      return;
    }
    toast.success(`Granted admin to ${trimmed}`);
    setEmail('');
    refresh();
  };

  const handleRevoke = async (row: AdminRow) => {
    if (row.is_original) return;
    if (!confirm(`Revoke admin from ${row.email}?`)) return;
    setRevokingId(row.user_id);
    const { error } = await supabase.rpc('revoke_admin', {
      _user_id: row.user_id,
    });
    setRevokingId(null);
    if (error) {
      toast.error(error.message || 'Could not revoke admin');
      return;
    }
    toast.success(`Revoked admin from ${row.email}`);
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldPlus className="w-4 h-4 text-primary" />
            Invite an admin
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            The recipient must already have an account on this site. Enter the
            email they signed up with.
          </p>
        </div>
        <form onSubmit={handleGrant} className="flex gap-2">
          <Input
            type="email"
            required
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={granting}
            className="flex-1"
          />
          <Button type="submit" disabled={granting || !email.trim()}>
            {granting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Grant admin'
            )}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Current admins</h3>
        {loading ? (
          <div className="flex items-center justify-center h-20 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admins found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {admins.map((row) => (
              <li
                key={row.user_id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{row.email}</span>
                    {row.is_original && (
                      <Badge variant="secondary" className="gap-1">
                        <Crown className="w-3 h-3" /> Owner
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Granted {new Date(row.granted_at).toLocaleString()}
                  </p>
                </div>
                {!row.is_original && row.user_id !== user?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(row)}
                    disabled={revokingId === row.user_id}
                  >
                    {revokingId === row.user_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <ShieldOff className="w-3 h-3 mr-1" /> Revoke
                      </>
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
