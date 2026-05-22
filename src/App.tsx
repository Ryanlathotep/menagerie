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
        .select('data_key, data_value')
        .eq('data_type', 'moves');
      if (cancelled || error || !data) return;
      setMoveOverrides(data as { data_key: string; data_value: Record<string, unknown> }[]);
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
