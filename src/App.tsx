import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useDismissTooltipsOnTap } from "./hooks/useDismissTooltipsOnTap";
import { supabase } from "@/integrations/supabase/client";
import { setMoveOverrides } from "@/game/moveOverrides";
import { setEquipmentIconOverrides } from "@/game/equipmentIconOverrides";
import { FloatingBugButton } from "@/game/FloatingBugButton";

const queryClient = new QueryClient();

const AppRoutes = () => {
  // Tap anywhere to dismiss lingering hover-cards / tooltips (esp. on mobile).
  useDismissTooltipsOnTap();

  // Pull admin-defined move overrides + custom moves once on boot so they
  // influence getMonsterMoves immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('game_data_overrides')
        .select('data_type, data_key, data_value')
        .in('data_type', ['moves', 'sprites']);
      if (cancelled || error || !data) return;
      const rows = data as { data_type: string; data_key: string; data_value: Record<string, unknown> }[];
      setMoveOverrides(rows.filter((r) => r.data_type === 'moves'));
      setEquipmentIconOverrides(rows.filter((r) => r.data_type === 'sprites'));
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
        <FloatingBugButton />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
