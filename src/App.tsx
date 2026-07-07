import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdminQA from "./pages/AdminQA";
import AdminTiles from "./pages/AdminTiles";
import NotFound from "./pages/NotFound";
import { useDismissTooltipsOnTap } from "./hooks/useDismissTooltipsOnTap";
import { supabase } from "@/integrations/supabase/client";
import { setMoveOverrides } from "@/game/moveOverrides";
import { setEquipmentIconOverrides } from "@/game/equipmentIconOverrides";
import { setAssetOverrides } from "@/game/assetOverrides";
import {
  setParticleTemplateOverrides,
  setParticleEffectOverrides,
  setParticleDefaultOverrides,
} from "@/game/particles/registry";
import { setWorldGenOverrides } from "@/game/worldGenConfig";

import { FloatingBugButton } from "@/game/FloatingBugButton";
import { FloatingFeatureButton } from "@/game/FloatingFeatureButton";
import { FloatingDockProvider } from "@/game/floating/FloatingDock";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

function normalizeHashRouteFromPath() {
  if (typeof window === 'undefined') return;
  if (window.location.hash || window.location.pathname === '/') return;

  const base = import.meta.env.BASE_URL || '/';
  const basePath = base.replace(/\/$/, '');
  const routePath = basePath && window.location.pathname.startsWith(basePath)
    ? window.location.pathname.slice(basePath.length) || '/'
    : window.location.pathname;

  if (routePath === '/') return;
  window.history.replaceState(null, '', `${base}${window.location.search}#${routePath}`);
}

normalizeHashRouteFromPath();

const AppRoutes = () => {
  // Tap anywhere to dismiss lingering hover-cards / tooltips (esp. on mobile).
  useDismissTooltipsOnTap();

  // Pull admin-defined move overrides + custom moves + image assets + particle
  // FX once on boot so they influence game rendering immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('game_data_overrides')
        .select('data_type, data_key, data_value')
        .in('data_type', ['moves', 'sprites', 'asset_image', 'particle_template', 'particle_effect', 'particle_default', 'world_gen']);
      if (cancelled || error || !data) return;
      const rows = data as { data_type: string; data_key: string; data_value: Record<string, unknown> }[];
      setMoveOverrides(rows.filter((r) => r.data_type === 'moves'));
      setEquipmentIconOverrides(rows.filter((r) => r.data_type === 'sprites'));
      setAssetOverrides(rows.filter((r) => r.data_type === 'asset_image'));
      setParticleTemplateOverrides(rows.filter((r) => r.data_type === 'particle_template'));
      setParticleEffectOverrides(rows.filter((r) => r.data_type === 'particle_effect'));
      setParticleDefaultOverrides(rows.filter((r) => r.data_type === 'particle_default'));
      setWorldGenOverrides(rows.filter((r) => r.data_type === 'world_gen'));

    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/qa" element={<AdminQA />} />
      <Route path="/admin/tiles" element={<AdminTiles />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AppRoutes />
          <FloatingBugButton />
          <FloatingFeatureButton />
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
