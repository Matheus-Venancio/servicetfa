import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import AppShell from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ConversasPage from "@/pages/ConversasPage";
import AtendentesPage from "@/pages/AtendentesPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.papel)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Gestor routes */}
          {/* <Route
            element={
              <ProtectedRoute allowedRoles={['GESTOR']}>
                <AppShell />
              </ProtectedRoute>
            }
          > */}
          <Route path="/gestor/dashboard" element={<DashboardPage />} />
          <Route path="/gestor/conversas" element={<ConversasPage role="GESTOR" />} />
          <Route path="/gestor/conversas/:id" element={<ConversasPage role="GESTOR" />} />
          <Route path="/gestor/atendentes" element={<AtendentesPage />} />
          {/* </Route> */}

          {/* Atendente routes */}
          {/* <Route
            element={
              <ProtectedRoute allowedRoles={['ATENDENTE']}>
                <AppShell />
              </ProtectedRoute>
            }
          > */}
          <Route path="/atendente/conversas" element={<ConversasPage role="ATENDENTE" />} />
          <Route path="/atendente/conversas/:id" element={<ConversasPage role="ATENDENTE" />} />
          {/* </Route> */}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
