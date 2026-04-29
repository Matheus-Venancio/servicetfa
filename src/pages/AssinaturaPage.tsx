import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle, FileText, Check } from 'lucide-react';

export default function AssinaturaPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    async function loadContrato() {
      if (!token) {
        setError('Link inválido ou ausente.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('contratos')
          .select('*, lead:leads(nome, email, telefone)')
          .eq('token_assinatura', token)
          .single();

        if (error || !data) {
          throw new Error('Contrato não encontrado ou link expirado.');
        }

        setContrato(data);
        if (data.status === 'ASSINADO' || data.status === 'FATURADO') {
          setSigned(true);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadContrato();
  }, [token]);

  const handleAssinar = async () => {
    setSigning(true);
    try {
      // Coletar IP do cliente
      let ip = 'Desconhecido';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch (e) {
        console.log('Erro ao buscar IP', e);
      }

      // Coletar User-Agent
      const userAgent = navigator.userAgent;

      const { error } = await supabase
        .from('contratos')
        .update({
          status: 'ASSINADO',
          ip_assinatura: ip,
          user_agent_assinatura: userAgent,
          data_assinatura: new Date().toISOString()
        })
        .eq('id', contrato.id);

      if (error) throw error;

      setSigned(true);
    } catch (err: any) {
      alert('Erro ao assinar contrato: ' + err.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="p-8 max-w-md w-full text-center shadow-xl border-red-500/20">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Erro ao carregar documento</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">TFA Viagens</h1>
          <p className="text-muted-foreground">Portal de Assinatura Eletrônica Segura</p>
        </div>

        {signed ? (
          <Card className="p-8 text-center shadow-xl border-green-500/20 bg-green-50/50 dark:bg-green-500/5">
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-500 mb-2">Documento Assinado!</h2>
            <p className="text-muted-foreground">
              Sua assinatura eletrônica foi registrada com sucesso sob o IP <strong>{contrato.ip_assinatura}</strong> em <strong>{new Date(contrato.data_assinatura).toLocaleString('pt-BR')}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Você pode fechar esta página. A cópia estará disponível com o seu consultor.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-xl border-border">
            <div className="bg-primary/5 border-b border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Contrato: {contrato.tipo}</h2>
                <p className="text-sm text-muted-foreground">Revisão e Assinatura</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">Cliente: <strong className="text-foreground">{contrato.lead?.nome}</strong></p>
                <p className="text-muted-foreground">E-mail: {contrato.lead?.email}</p>
              </div>
            </div>

            <div className="p-6 md:p-10 bg-background">
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap font-serif text-gray-800 dark:text-gray-200 border border-border p-6 rounded-md bg-white dark:bg-zinc-950 shadow-inner min-h-[500px]">
                {contrato.conteudo}
              </div>
            </div>

            <div className="p-6 border-t border-border bg-muted/10 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-400">
                <h4 className="font-bold flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4" />
                  Termos de Aceite Eletrônico
                </h4>
                <p>
                  Ao clicar em "Li e Aceito os Termos", você concorda com todas as cláusulas do contrato acima e reconhece que esta ação possui validade jurídica equivalente à sua assinatura física, de acordo com a Medida Provisória nº 2.200-2/2001. Seu IP e informações do dispositivo serão registrados para fins de comprovação.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  size="lg" 
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white shadow-lg font-bold"
                  onClick={handleAssinar}
                  disabled={signing}
                >
                  {signing ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Registrando Assinatura...</>
                  ) : (
                    <><Check className="h-5 w-5 mr-2" /> Li e Aceito os Termos</>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
