import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { TileAssetManager } from '@/admin/TileAssetManager';
import { Link } from 'react-router-dom';

export default function AdminTiles() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();

  if (authLoading || adminLoading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tile Asset Manager</h1>
            <p className="text-sm text-muted-foreground">
              Bulk upload, slice sheets, and tag tile assets for dungeons and the overworld.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/qa" className="text-sm underline">QA Panel →</Link>
            <Link to="/" className="text-sm underline">← Back to game</Link>
          </div>
        </header>
        <TileAssetManager />
      </div>
    </main>
  );
}
