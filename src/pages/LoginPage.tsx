import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import logoTfa from '@/assets/logo-tfa.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, senha);
    setLoading(false);
    if (ok) {
      const user = useAuthStore.getState().user;
      navigate('/gestor/dashboard');
    } else {
      setError('E-mail ou senha inválidos');
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-tfa">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(184_60%_35%/0.4),transparent_60%)]" />
        <div className="relative z-10 text-center">
          <img src={logoTfa} alt="TFA Viagens" className="h-28 w-28 mx-auto mb-8 drop-shadow-lg" width={112} height={112} />
          <h2 className="text-3xl font-bold mb-3">TFA Viagens</h2>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Sistema de Atendimento inteligente para sua agência de viagens
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background rounded-l-3xl lg:rounded-l-[2rem] shadow-2xl">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src={logoTfa} alt="TFA Viagens" className="h-16 w-16 mb-3" width={64} height={64} />
            <h1 className="text-xl font-bold text-foreground">TFA Viagens</h1>
          </div>

          <div className="lg:block hidden mb-8">
            <h1 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Senha</label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label="Mostrar/ocultar senha"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <p className="text-center text-sm text-muted-foreground hover:text-foreground cursor-pointer">
              Esqueceu sua senha?
            </p>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Demo: gestor@tfa.com / ana@tfa.com — Senha: 123456
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
