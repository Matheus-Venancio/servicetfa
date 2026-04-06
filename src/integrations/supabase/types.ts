export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      atendentes: {
        Row: {
          id: string
          nome: string
          email: string
          telefone: string | null
          papel: 'ATENDENTE' | 'GESTOR' | 'ADMIN'
          status: 'ONLINE' | 'OCUPADO' | 'OFFLINE'
          max_leads: number
          avatar_url: string | null
          instance_name: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          email: string
          telefone?: string | null
          papel?: 'ATENDENTE' | 'GESTOR' | 'ADMIN'
          status?: 'ONLINE' | 'OCUPADO' | 'OFFLINE'
          max_leads?: number
          avatar_url?: string | null
          instance_name?: string | null
        }
        Update: { [key: string]: any }
      }
      leads: {
        Row: {
          id: string
          nome: string | null
          telefone: string
          email: string | null
          status: 'NOVO' | 'QUALIFICANDO' | 'AGUARDANDO' | 'EM_ATENDIMENTO' | 'PROPOSTA_ENVIADA' | 'FECHADO' | 'PERDIDO' | 'NURTURING'
          score: 'QUENTE' | 'MORNO' | 'FRIO'
          canal_origem: 'META_ADS' | 'GOOGLE_ADS' | 'TIKTOK_ADS' | 'ORGANICO' | 'INDICACAO' | 'OUTRO'
          campanha_id: string | null
          atendente_id: string | null
          destino: string | null
          data_partida: string | null
          data_retorno: string | null
          numero_pessoas: number | null
          orcamento: number | null
          observacoes: string | null
          bot_etapa: number
          bot_concluido: boolean
          pagina_origem: string | null
          utm_source: string | null
          utm_campaign: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome?: string | null
          telefone: string
          email?: string | null
          status?: 'NOVO' | 'QUALIFICANDO' | 'AGUARDANDO' | 'EM_ATENDIMENTO' | 'PROPOSTA_ENVIADA' | 'FECHADO' | 'PERDIDO' | 'NURTURING'
          score?: 'QUENTE' | 'MORNO' | 'FRIO'
          canal_origem?: 'META_ADS' | 'GOOGLE_ADS' | 'TIKTOK_ADS' | 'ORGANICO' | 'INDICACAO' | 'OUTRO'
          campanha_id?: string | null
          atendente_id?: string | null
          destino?: string | null
          data_partida?: string | null
          data_retorno?: string | null
          numero_pessoas?: number | null
          orcamento?: number | null
          observacoes?: string | null
          bot_etapa?: number
          bot_concluido?: boolean
          pagina_origem?: string | null
          utm_source?: string | null
          utm_campaign?: string | null
        }
        Update: { [key: string]: any }
      }
      mensagens: {
        Row: {
          id: string
          lead_id: string
          atendente_id: string | null
          tipo: 'TEXTO' | 'IMAGEM' | 'DOCUMENTO' | 'AUDIO' | 'NOTA_INTERNA' | 'SISTEMA'
          origem: 'LEAD' | 'ATENDENTE' | 'BOT' | 'SISTEMA'
          conteudo: string
          media_url: string | null
          lida: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          lead_id: string
          atendente_id?: string | null
          tipo?: 'TEXTO' | 'IMAGEM' | 'DOCUMENTO' | 'AUDIO' | 'NOTA_INTERNA' | 'SISTEMA'
          origem: 'LEAD' | 'ATENDENTE' | 'BOT' | 'SISTEMA'
          conteudo: string
          media_url?: string | null
          lida?: boolean
        }
        Update: { [key: string]: any }
      }
      fila_config: {
        Row: {
          id: string
          ultimo_idx: number
          atualizado_em: string
        }
        Insert: {
          id?: string
          ultimo_idx?: number
          atualizado_em?: string
        }
        Update: { [key: string]: any }
      }
      notas_internas: {
        Row: {
          id: string
          lead_id: string
          atendente_id: string
          conteudo: string
          criado_em: string
        }
        Insert: {
          id?: string
          lead_id: string
          atendente_id: string
          conteudo: string
        }
        Update: { [key: string]: any }
      }
      campanhas: {
        Row: {
          id: string
          nome: string
          canal: 'META_ADS' | 'GOOGLE_ADS' | 'TIKTOK_ADS' | 'ORGANICO' | 'INDICACAO' | 'OUTRO'
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          ativa: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          nome: string
          canal: 'META_ADS' | 'GOOGLE_ADS' | 'TIKTOK_ADS' | 'ORGANICO' | 'INDICACAO' | 'OUTRO'
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          ativa?: boolean
        }
        Update: { [key: string]: any }
      }
      conversations: {
        Row: {
          id: string
          contact_name: string | null
          contact_phone: string | null
          status: string | null
          atendente_nome: string | null
          last_message: string | null
          last_message_at: string | null
          unread_count: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          contact_name?: string | null
          contact_phone?: string | null
          status?: string | null
          atendente_nome?: string | null
          last_message?: string | null
          last_message_at?: string | null
          unread_count?: number | null
          created_at?: string | null
        }
        Update: { [key: string]: any }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string | null
          origin: string | null
          content: string | null
          sender_name: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          conversation_id?: string | null
          origin?: string | null
          content?: string | null
          sender_name?: string | null
          created_at?: string | null
        }
        Update: { [key: string]: any }
      }
    }
    Views: Record<string, any>
    Enums: Record<string, any>
    CompositeTypes: Record<string, any>
    Functions: Record<string, any>
  }
}

// ── Tipos derivados para usar no código ──────────────────────────────────────
export type Atendente   = Database['public']['Tables']['atendentes']['Row']
export type Lead        = Database['public']['Tables']['leads']['Row']
export type Mensagem    = Database['public']['Tables']['mensagens']['Row']
export type Campanha    = Database['public']['Tables']['campanhas']['Row']
export type FilaConfig  = Database['public']['Tables']['fila_config']['Row']
export type NotaInterna = Database['public']['Tables']['notas_internas']['Row']

export type LeadStatus  = Lead['status']
export type LeadScore   = Lead['score']
export type CanalOrigem = Lead['canal_origem']
export type AtendentePapel   = Atendente['papel']
export type AtendenteStatus  = Atendente['status']
