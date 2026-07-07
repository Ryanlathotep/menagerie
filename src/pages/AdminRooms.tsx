import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { RoomEditor } from '@/admin/RoomEditor';

export default function AdminRooms() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();

  if (authLoading || adminLoading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Room Editor</h1>
            <p className="text-sm text-muted-foreground">
              Paint reusable room prefabs for the arena and (soon) dungeons. Rooms tagged <b>arena</b> appear
              in the Arena hub; rooms tagged <b>dungeon</b> are stamped into tower floors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/tiles" className="text-sm underline">Tile Editor →</Link>
            <Link to="/admin/qa" className="text-sm underline">QA Panel →</Link>
            <Link to="/" className="text-sm underline">← Back to game</Link>
          </div>
        </header>
        <RoomEditor />
      </div>
    </main>
  );
}
