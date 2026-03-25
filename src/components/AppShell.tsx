import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Home, MessageCircle, Users, BarChart3, Settings, LogOut, Plane, Smartphone } from 'lucide-react';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_GESTOR = [
  { icon: Home, label: 'Dashboard', path: '/gestor/dashboard' },
  { icon: MessageCircle, label: 'Conversas', path: '/gestor/conversas' },
  { icon: Users, label: 'Atendentes', path: '/gestor/atendentes' },
  { icon: Smartphone, label: 'WhatsApp', path: '/gestor/whatsapp' },
  { icon: BarChart3, label: 'Relatórios', path: '#' },
  { icon: Settings, label: 'Configurações', path: '#' },
];

const NAV_ATENDENTE = [
  { icon: MessageCircle, label: 'Conversas', path: '/atendente/conversas' },
  { icon: Smartphone, label: 'WhatsApp', path: '/atendente/whatsapp' },
  { icon: Settings, label: 'Configurações', path: '#' },
];

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const nav = user?.papel === 'GESTOR' ? NAV_GESTOR : NAV_ATENDENTE;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 bg-sidebar flex flex-col items-center py-4 shrink-0">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center mb-6">
          <Plane className="h-5 w-5 text-primary-foreground" />
        </div>

        <nav className="flex-1 flex flex-col items-center gap-1">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.path) && item.path !== '#';
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <button
                    aria-label={item.label}
                    onClick={() => item.path !== '#' && navigate(item.path)}
                    className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                      active ? 'bg-sidebar-active text-primary-foreground' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-active/50'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleLogout} aria-label="Sair" className="h-10 w-10 rounded-lg flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-active/50 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
          <div className="relative">
            <AvatarInicial nome={user?.nome || 'U'} size="sm" />
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status="ONLINE" />
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-surface-secondary">
        <Outlet />
      </main>
    </div>
  );
}
