import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Bell,
  HelpCircle,
  Shield,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AvatarInicial } from '@/components/AvatarInicial';
import { StatusDot } from '@/components/StatusDot';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import logoTfa from '@/assets/logo-tfa.png';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number | null;
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_GESTOR: NavSection[] = [
  {
    title: 'Gestão',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/gestor/dashboard' },
      { icon: Users, label: 'Atendentes', path: '/gestor/atendentes' },
      { icon: Smartphone, label: 'WhatsApp', path: '/gestor/whatsapp' },
      { icon: Smartphone, label: 'Documentos', path: '#', disabled: true },
      { icon: MessageCircle, label: 'Clientes', path: '#', disabled: true },
      { icon: TrendingUp, label: 'Relatórios', path: '#', disabled: true },
    ],
  },
];

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNav = (path: string, disabled?: boolean) => {
    if (disabled || path === '#') return;
    navigate(path);
  };

  const isActive = (path: string) =>
    path !== '#' && location.pathname.startsWith(path);

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-60';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-secondary">
      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarWidth} relative flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}
        style={{
          background: 'linear-gradient(180deg, hsl(184 60% 11%) 0%, hsl(184 55% 7%) 100%)',
          borderRight: '1px solid hsl(184 40% 18%)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 shrink-0 overflow-hidden">
          <img
            src={logoTfa}
            alt="TFA Viagens"
            className="h-9 w-9 rounded-xl object-contain shrink-0"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-tight truncate">TFA Viagens</p>
              <p className="text-[10px] text-white/50 truncate">Painel do Gestor</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 mb-2 border-t border-white/10" />

        {/* Role badge */}
        {!collapsed && (
          <div className="mx-4 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-white/70 uppercase tracking-wide">
              <Shield className="h-2.5 w-2.5" />
              Gestor
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-5 pb-4">
          {NAV_GESTOR.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  const btn = (
                    <button
                      key={item.label}
                      aria-label={item.label}
                      disabled={item.disabled}
                      onClick={() => handleNav(item.path, item.disabled)}
                      className={`
                        w-full flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-150 group relative
                        ${active
                          ? 'bg-white/15 text-white shadow-inner'
                          : item.disabled
                          ? 'text-white/25 cursor-not-allowed'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                        }
                      `}
                    >
                      {/* Active pill */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[hsl(184_98%_55%)]" />
                      )}

                      <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[hsl(184_98%_65%)]' : ''}`} />

                      {!collapsed && (
                        <>
                          <span className="text-sm font-medium truncate flex-1 text-left">
                            {item.label}
                          </span>
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto bg-[hsl(184_98%_28%)] text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                              {item.badge}
                            </span>
                          )}
                          {item.disabled && (
                            <span className="text-[9px] text-white/30 uppercase tracking-wide">Em breve</span>
                          )}
                        </>
                      )}
                    </button>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.label}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent side="right" className="flex items-center gap-2">
                          {item.label}
                          {item.disabled && <span className="text-xs text-muted-foreground">(em breve)</span>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return btn;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="shrink-0 px-3 pb-4 space-y-1 border-t border-white/10 pt-3">
          {/* Help */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label="Ajuda"
                  className="w-full flex items-center justify-center py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <HelpCircle className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Ajuda</TooltipContent>
            </Tooltip>
          ) : (
            <button
              aria-label="Ajuda"
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <HelpCircle className="h-[18px] w-[18px] shrink-0" />
              <span className="text-sm font-medium">Ajuda</span>
            </button>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  aria-label="Sair"
                  className="w-full flex items-center justify-center py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              aria-label="Sair"
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-white/10 mt-2 pt-3">
            {collapsed ? (
              <div className="flex justify-center">
                <div className="relative">
                  <AvatarInicial nome={user?.nome || 'U'} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <StatusDot status="ONLINE" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-2">
                <div className="relative shrink-0">
                  <AvatarInicial nome={user?.nome || 'U'} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <StatusDot status="ONLINE" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.nome || 'Usuário'}</p>
                  <p className="text-[11px] text-white/40 truncate">{user?.email || ''}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute top-1/2 -right-3 -translate-y-1/2 h-6 w-6 rounded-full bg-[hsl(184_50%_18%)] border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-[hsl(184_50%_25%)] transition-all shadow-lg z-10"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-hidden bg-surface-secondary flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
