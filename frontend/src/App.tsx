import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CampaignDashboard } from "@/components/CampaignDashboard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PanelSelector from "./pages/PanelSelector";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PaymentApproved from "./pages/PaymentApproved";
import WhatsAppSAASPage from "./pages/WhatsAppSAAS";
import NotFound from "./pages/NotFound";
import InvitePage from "./pages/InvitePage";
import { ForgotPassword, ResetPassword } from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => {
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Watch for campaign ID changes in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const campaignId = localStorage.getItem('activeCampaignId');
      setActiveCampaignId(campaignId);
    };

    // Check initial state
    const initialCampaignId = localStorage.getItem('activeCampaignId');
    if (initialCampaignId) {
      setActiveCampaignId(initialCampaignId);
    }

    // Listen for storage changes (e.g., from other tabs)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleDashboardClose = () => {
    setActiveCampaignId(null);
    localStorage.removeItem('activeCampaignId');
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/painel-selector" element={<PanelSelector />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/admin/login" element={<Auth />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/payment-approved" element={<PaymentApproved />} />
              <Route path="/whatsapp" element={<WhatsAppSAASPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* Campaign Dashboard Overlay */}
            {activeCampaignId && (
              <CampaignDashboard 
                campaignId={activeCampaignId} 
                onClose={handleDashboardClose}
              />
            )}
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;