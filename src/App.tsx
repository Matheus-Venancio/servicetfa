import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import AppShell from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ConversasPage from "@/pages/ConversasPage";
import ClientesPage from "@/pages/ClientesPage";
import AtendentesPage from "@/pages/AtendentesPage";
import AtendenteConversasPage from "@/pages/AtendenteConversasPage";
import DocumentosPage from "@/pages/DocumentosPage";
import GerenciaAcessosPage from "@/pages/GerenciaAcessosPage";
import AssinaturaPage from "@/pages/AssinaturaPage";
import NotFound from "./pages/NotFound.tsx";


const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.papel)) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

const App = () => {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/assinatura/:token" element={<AssinaturaPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Gestor routes — AppShell as layout */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/gestor/dashboard" element={<DashboardPage />} />
              <Route path="/gestor/conversas" element={<ConversasPage role="GESTOR" />} />
              <Route path="/gestor/conversas/:id" element={<ConversasPage role="GESTOR" />} />
              <Route path="/gestor/atendentes" element={<AtendentesPage />} />
              <Route path="/gestor/atendentes/:atendenteId/conversas" element={<AtendenteConversasPage />} />
              <Route path="/gestor/clientes" element={<ClientesPage />} />
              <Route path="/gestor/documentos" element={<DocumentosPage />} />
              <Route path="/gestor/acessos" element={<GerenciaAcessosPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
