import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, UserCheck, Shield, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const GerenciaAcessosPage = () => {
  const queryClient = useQueryClient();

  const { data: pendentes, isLoading } = useQuery({
    queryKey: ["solicitacoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_acesso")
        .select("*")
        .eq("status", "PENDENTE")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("solicitacoes_acesso")
        .update({ status: "APROVADO" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-pendentes"] });
      toast.success("Solicitação aprovada!");
    },
    onError: (error: any) => {
      toast.error("Erro ao aprovar: " + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("solicitacoes_acesso")
        .update({ status: "REJEITADO" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-pendentes"] });
      toast.success("Solicitação rejeitada.");
    },
    onError: (error: any) => {
      toast.error("Erro ao rejeitar: " + error.message);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center">Carregando solicitações...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Acessos</h1>
          <p className="text-muted-foreground">Aprove ou rejeite novos pedidos de registro de gerentes.</p>
        </div>
        <Shield className="w-10 h-10 text-primary opacity-20" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Solicitações Pendentes
          </CardTitle>
          <CardDescription>
            {pendentes?.length || 0} usuários aguardando aprovação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Data do Pedido</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendentes?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.nome}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.telefone || "-"}</TableCell>
                  <TableCell>
                    {format(new Date(user.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => approveMutation.mutate(user.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => rejectMutation.mutate(user.id)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pendentes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma solicitação pendente no momento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Acessos Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3 Gerentes Ativos</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GerenciaAcessosPage;
