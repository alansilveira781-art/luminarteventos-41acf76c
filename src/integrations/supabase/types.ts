export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ca_centros_custo: {
        Row: {
          ativo: boolean
          external_id: string
          id: string
          nome: string
          synced_at: string
        }
        Insert: {
          ativo?: boolean
          external_id: string
          id?: string
          nome: string
          synced_at?: string
        }
        Update: {
          ativo?: boolean
          external_id?: string
          id?: string
          nome?: string
          synced_at?: string
        }
        Relationships: []
      }
      ca_contas_pagar: {
        Row: {
          categoria_external_id: string | null
          centro_custo_external_id: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          documento: string | null
          external_id: string
          fornecedor_nome: string | null
          id: string
          observacoes: string | null
          status: string | null
          synced_at: string
          valor: number
        }
        Insert: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          documento?: string | null
          external_id: string
          fornecedor_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          synced_at?: string
          valor?: number
        }
        Update: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          documento?: string | null
          external_id?: string
          fornecedor_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          synced_at?: string
          valor?: number
        }
        Relationships: []
      }
      ca_contas_receber: {
        Row: {
          categoria_external_id: string | null
          centro_custo_external_id: string | null
          cliente_nome: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          documento: string | null
          external_id: string
          id: string
          observacoes: string | null
          status: string | null
          synced_at: string
          valor: number
        }
        Insert: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          cliente_nome?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          documento?: string | null
          external_id: string
          id?: string
          observacoes?: string | null
          status?: string | null
          synced_at?: string
          valor?: number
        }
        Update: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          cliente_nome?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          documento?: string | null
          external_id?: string
          id?: string
          observacoes?: string | null
          status?: string | null
          synced_at?: string
          valor?: number
        }
        Relationships: []
      }
      ca_dre_estrutura: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          formula: string[]
          id: string
          label: string
          ordem: number
          prefixos: string[]
          sinal: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          formula?: string[]
          id?: string
          label: string
          ordem: number
          prefixos?: string[]
          sinal?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          formula?: string[]
          id?: string
          label?: string
          ordem?: number
          prefixos?: string[]
          sinal?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ca_extrato: {
        Row: {
          categoria_external_id: string | null
          centro_custo_external_id: string | null
          conta_bancaria: string | null
          data: string | null
          descricao: string | null
          external_id: string
          id: string
          synced_at: string
          tipo: string | null
          valor: number
        }
        Insert: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          conta_bancaria?: string | null
          data?: string | null
          descricao?: string | null
          external_id: string
          id?: string
          synced_at?: string
          tipo?: string | null
          valor?: number
        }
        Update: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          conta_bancaria?: string | null
          data?: string | null
          descricao?: string | null
          external_id?: string
          id?: string
          synced_at?: string
          tipo?: string | null
          valor?: number
        }
        Relationships: []
      }
      ca_lancamento_rateios: {
        Row: {
          categoria_external_id: string | null
          centro_custo_external_id: string | null
          id: string
          lancamento_external_id: string
          ordem: number
          percentual: number | null
          synced_at: string
          tipo: string
          valor: number
        }
        Insert: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          id?: string
          lancamento_external_id: string
          ordem: number
          percentual?: number | null
          synced_at?: string
          tipo: string
          valor: number
        }
        Update: {
          categoria_external_id?: string | null
          centro_custo_external_id?: string | null
          id?: string
          lancamento_external_id?: string
          ordem?: number
          percentual?: number | null
          synced_at?: string
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      ca_plano_contas: {
        Row: {
          ativo: boolean
          codigo: string | null
          external_id: string
          id: string
          nome: string
          pai_external_id: string | null
          synced_at: string
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          external_id: string
          id?: string
          nome: string
          pai_external_id?: string | null
          synced_at?: string
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          external_id?: string
          id?: string
          nome?: string
          pai_external_id?: string | null
          synced_at?: string
          tipo?: string | null
        }
        Relationships: []
      }
      ca_sync_jobs: {
        Row: {
          date_from: string | null
          date_to: string | null
          finished_at: string | null
          id: string
          mensagem: string | null
          progress: Json
          started_at: string
          status: string
          tipo: string
        }
        Insert: {
          date_from?: string | null
          date_to?: string | null
          finished_at?: string | null
          id?: string
          mensagem?: string | null
          progress?: Json
          started_at?: string
          status?: string
          tipo: string
        }
        Update: {
          date_from?: string | null
          date_to?: string | null
          finished_at?: string | null
          id?: string
          mensagem?: string | null
          progress?: Json
          started_at?: string
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      ca_sync_log: {
        Row: {
          date_from: string | null
          date_to: string | null
          finished_at: string | null
          id: string
          mensagem: string | null
          qtd_registros: number | null
          recurso: string
          started_at: string
          status: string
        }
        Insert: {
          date_from?: string | null
          date_to?: string | null
          finished_at?: string | null
          id?: string
          mensagem?: string | null
          qtd_registros?: number | null
          recurso: string
          started_at?: string
          status?: string
        }
        Update: {
          date_from?: string | null
          date_to?: string | null
          finished_at?: string | null
          id?: string
          mensagem?: string | null
          qtd_registros?: number | null
          recurso?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      ca_sync_schedule: {
        Row: {
          ativo: boolean
          created_at: string
          horario: string
          id: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          horario: string
          id?: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          horario?: string
          id?: string
          ordem?: number
        }
        Relationships: []
      }
      ca_sync_state: {
        Row: {
          last_run_at: string | null
          last_synced_from: string | null
          last_synced_to: string | null
          qtd_total: number
          recurso: string
          updated_at: string
        }
        Insert: {
          last_run_at?: string | null
          last_synced_from?: string | null
          last_synced_to?: string | null
          qtd_total?: number
          recurso: string
          updated_at?: string
        }
        Update: {
          last_run_at?: string | null
          last_synced_from?: string | null
          last_synced_to?: string | null
          qtd_total?: number
          recurso?: string
          updated_at?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      comercial_cards: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          data_envio: string | null
          evento_data_fim: string | null
          evento_data_inicio: string | null
          evento_nome: string
          id: string
          motivo_perda: string | null
          observacoes: string
          proposta_id: string | null
          responsavel: string
          status: string
          valor_estimado: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          evento_data_fim?: string | null
          evento_data_inicio?: string | null
          evento_nome?: string
          id?: string
          motivo_perda?: string | null
          observacoes?: string
          proposta_id?: string | null
          responsavel?: string
          status?: string
          valor_estimado?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          evento_data_fim?: string | null
          evento_data_inicio?: string | null
          evento_nome?: string
          id?: string
          motivo_perda?: string | null
          observacoes?: string
          proposta_id?: string | null
          responsavel?: string
          status?: string
          valor_estimado?: number
        }
        Relationships: [
          {
            foreignKeyName: "comercial_cards_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "comercial_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_catalogo: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
          tipo_medida: string
          unidade: string
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          tipo_medida?: string
          unidade?: string
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          tipo_medida?: string
          unidade?: string
          valor_unitario?: number
        }
        Relationships: []
      }
      comercial_cerimoniais: {
        Row: {
          created_at: string
          id: string
          nome: string
          percentual_bv: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          percentual_bv?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          percentual_bv?: number
        }
        Relationships: []
      }
      comercial_clientes: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          nome: string
          telefone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome: string
          telefone?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string
        }
        Relationships: []
      }
      comercial_consultores: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      comercial_decoradores: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      comercial_email_log: {
        Row: {
          card_id: string | null
          cliente_email: string
          cliente_nome: string | null
          created_at: string
          enviado_por: string | null
          enviado_por_nome: string | null
          error_message: string | null
          id: string
          mensagem: string | null
          pdf_storage_path: string | null
          pdf_url: string | null
          proposta_id: string | null
          proposta_numero: number | null
          proposta_version: number | null
          status: string
          subject: string
          template_name: string
        }
        Insert: {
          card_id?: string | null
          cliente_email: string
          cliente_nome?: string | null
          created_at?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          error_message?: string | null
          id?: string
          mensagem?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          proposta_id?: string | null
          proposta_numero?: number | null
          proposta_version?: number | null
          status?: string
          subject: string
          template_name: string
        }
        Update: {
          card_id?: string | null
          cliente_email?: string
          cliente_nome?: string | null
          created_at?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          error_message?: string | null
          id?: string
          mensagem?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          proposta_id?: string | null
          proposta_numero?: number | null
          proposta_version?: number | null
          status?: string
          subject?: string
          template_name?: string
        }
        Relationships: []
      }
      comercial_metas: {
        Row: {
          ano: number
          classificacao: string
          created_at: string
          id: string
          mes: number
          updated_at: string
          valor_meta: number
        }
        Insert: {
          ano: number
          classificacao: string
          created_at?: string
          id?: string
          mes: number
          updated_at?: string
          valor_meta?: number
        }
        Update: {
          ano?: number
          classificacao?: string
          created_at?: string
          id?: string
          mes?: number
          updated_at?: string
          valor_meta?: number
        }
        Relationships: []
      }
      comercial_proposta_seq: {
        Row: {
          id: boolean
          valor: number
        }
        Insert: {
          id?: boolean
          valor?: number
        }
        Update: {
          id?: boolean
          valor?: number
        }
        Relationships: []
      }
      comercial_propostas: {
        Row: {
          ambientes: Json
          approved_at: string | null
          card_id: string | null
          cliente: Json
          cliente_id: string | null
          created_at: string
          created_by: string | null
          custos: Json
          evento: Json
          id: string
          numero: number
          parent_id: string | null
          responsavel: string
          resumo: Json
          status: string
          version: number
        }
        Insert: {
          ambientes?: Json
          approved_at?: string | null
          card_id?: string | null
          cliente?: Json
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          custos?: Json
          evento?: Json
          id?: string
          numero: number
          parent_id?: string | null
          responsavel?: string
          resumo?: Json
          status?: string
          version?: number
        }
        Update: {
          ambientes?: Json
          approved_at?: string | null
          card_id?: string | null
          cliente?: Json
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          custos?: Json
          evento?: Json
          id?: string
          numero?: number
          parent_id?: string | null
          responsavel?: string
          resumo?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "comercial_propostas_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "comercial_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_status_defaults: {
        Row: {
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      comercial_vendas: {
        Row: {
          ano: number | null
          ano_evento: number | null
          cerimonial: string | null
          cidade: string | null
          classificacao: string | null
          comissao_consultor: number | null
          comissao_gestor: number | null
          consultor: string | null
          cont_cerimonial: number | null
          cont_decorador: number | null
          created_at: string
          data_evento: string | null
          data_registro: string | null
          decorador: string | null
          desconto: number | null
          empresa: string | null
          estado: string | null
          gestor: string | null
          id: string
          local: string | null
          mes: string | null
          mes_evento: string | null
          nome_evento: string | null
          percentual: number | null
          quantidade: number | null
          row_hash: string | null
          salao: string | null
          semana: number | null
          source: string
          status_bv_rt: string | null
          tipo: string | null
          tipo_comissao: string | null
          tipo_evento: string | null
          trimestre_evento: number | null
          updated_at: string
          valor_bv: number | null
          valor_comissao: number
          valor_final: number | null
          valor_proposta: number | null
        }
        Insert: {
          ano?: number | null
          ano_evento?: number | null
          cerimonial?: string | null
          cidade?: string | null
          classificacao?: string | null
          comissao_consultor?: number | null
          comissao_gestor?: number | null
          consultor?: string | null
          cont_cerimonial?: number | null
          cont_decorador?: number | null
          created_at?: string
          data_evento?: string | null
          data_registro?: string | null
          decorador?: string | null
          desconto?: number | null
          empresa?: string | null
          estado?: string | null
          gestor?: string | null
          id?: string
          local?: string | null
          mes?: string | null
          mes_evento?: string | null
          nome_evento?: string | null
          percentual?: number | null
          quantidade?: number | null
          row_hash?: string | null
          salao?: string | null
          semana?: number | null
          source?: string
          status_bv_rt?: string | null
          tipo?: string | null
          tipo_comissao?: string | null
          tipo_evento?: string | null
          trimestre_evento?: number | null
          updated_at?: string
          valor_bv?: number | null
          valor_comissao?: number
          valor_final?: number | null
          valor_proposta?: number | null
        }
        Update: {
          ano?: number | null
          ano_evento?: number | null
          cerimonial?: string | null
          cidade?: string | null
          classificacao?: string | null
          comissao_consultor?: number | null
          comissao_gestor?: number | null
          consultor?: string | null
          cont_cerimonial?: number | null
          cont_decorador?: number | null
          created_at?: string
          data_evento?: string | null
          data_registro?: string | null
          decorador?: string | null
          desconto?: number | null
          empresa?: string | null
          estado?: string | null
          gestor?: string | null
          id?: string
          local?: string | null
          mes?: string | null
          mes_evento?: string | null
          nome_evento?: string | null
          percentual?: number | null
          quantidade?: number | null
          row_hash?: string | null
          salao?: string | null
          semana?: number | null
          source?: string
          status_bv_rt?: string | null
          tipo?: string | null
          tipo_comissao?: string | null
          tipo_evento?: string | null
          trimestre_evento?: number | null
          updated_at?: string
          valor_bv?: number | null
          valor_comissao?: number
          valor_final?: number | null
          valor_proposta?: number | null
        }
        Relationships: []
      }
      comercial_vendas_sync: {
        Row: {
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          rows_inserted: number | null
          rows_total: number | null
          rows_updated: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          rows_inserted?: number | null
          rows_total?: number | null
          rows_updated?: number | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          rows_inserted?: number | null
          rows_total?: number | null
          rows_updated?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      comercial_vendedores: {
        Row: {
          created_at: string
          id: string
          nome: string
          percentual_comissao: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          percentual_comissao?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          percentual_comissao?: number
        }
        Relationships: []
      }
      compra_anexos: {
        Row: {
          compra_id: string
          created_at: string
          id: string
          mime_type: string | null
          nome: string
          path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          compra_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome: string
          path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          compra_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      compra_comentarios: {
        Row: {
          compra_id: string
          created_at: string
          id: string
          mencoes: string[] | null
          texto: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          compra_id: string
          created_at?: string
          id?: string
          mencoes?: string[] | null
          texto: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          compra_id?: string
          created_at?: string
          id?: string
          mencoes?: string[] | null
          texto?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      compra_historico: {
        Row: {
          acao: string
          compra_id: string
          created_at: string
          detalhes: string | null
          id: string
          status_anterior: Database["public"]["Enums"]["compra_status"] | null
          status_novo: Database["public"]["Enums"]["compra_status"] | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          compra_id: string
          created_at?: string
          detalhes?: string | null
          id?: string
          status_anterior?: Database["public"]["Enums"]["compra_status"] | null
          status_novo?: Database["public"]["Enums"]["compra_status"] | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          compra_id?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          status_anterior?: Database["public"]["Enums"]["compra_status"] | null
          status_novo?: Database["public"]["Enums"]["compra_status"] | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      compra_itens: {
        Row: {
          compra_id: string
          cotacao: string | null
          created_at: string
          desconto_percentual: number | null
          descricao: string
          evento_projeto: string | null
          id: string
          item_id: string | null
          quantidade: number
          quantidade_recebida: number
          recebido: boolean
          recebido_em: string | null
          recebido_por: string | null
          unidade: string | null
          valor_unitario: number | null
        }
        Insert: {
          compra_id: string
          cotacao?: string | null
          created_at?: string
          desconto_percentual?: number | null
          descricao: string
          evento_projeto?: string | null
          id?: string
          item_id?: string | null
          quantidade?: number
          quantidade_recebida?: number
          recebido?: boolean
          recebido_em?: string | null
          recebido_por?: string | null
          unidade?: string | null
          valor_unitario?: number | null
        }
        Update: {
          compra_id?: string
          cotacao?: string | null
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string
          evento_projeto?: string | null
          id?: string
          item_id?: string | null
          quantidade?: number
          quantidade_recebida?: number
          recebido?: boolean
          recebido_em?: string | null
          recebido_por?: string | null
          unidade?: string | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      compradores: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          comprador: string | null
          condicao_pagamento: string | null
          created_at: string
          created_by: string | null
          data_compra: string | null
          data_servico: string | null
          data_solicitacao: string
          documento: string | null
          fornecedor: string | null
          fornecedor_id: string | null
          id: string
          motivo_negacao: string | null
          numero: number | null
          observacoes: string | null
          ordem: number
          parcelamento: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          solicitante: string | null
          solicitante_id: string | null
          status: Database["public"]["Enums"]["compra_status"]
          tipo_compra: string | null
          titulo: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          comprador?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string | null
          data_servico?: string | null
          data_solicitacao?: string
          documento?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          motivo_negacao?: string | null
          numero?: number | null
          observacoes?: string | null
          ordem?: number
          parcelamento?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          solicitante?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          tipo_compra?: string | null
          titulo?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          comprador?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string | null
          data_servico?: string | null
          data_solicitacao?: string
          documento?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          motivo_negacao?: string | null
          numero?: number | null
          observacoes?: string | null
          ordem?: number
          parcelamento?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          solicitante?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          tipo_compra?: string | null
          titulo?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      compras_fornecedores: {
        Row: {
          contato_nome: string | null
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["entity_status"]
          telefone: string | null
          tipo_fornecimento: string | null
          updated_at: string
        }
        Insert: {
          contato_nome?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          tipo_fornecimento?: string | null
          updated_at?: string
        }
        Update: {
          contato_nome?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          tipo_fornecimento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compras_solicitantes: {
        Row: {
          apelido: string | null
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          setor: string | null
          status: Database["public"]["Enums"]["entity_status"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          apelido?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          apelido?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compras_status_defaults: {
        Row: {
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["compra_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status: Database["public"]["Enums"]["compra_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      condicoes_pagamento: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      conta_azul_credentials: {
        Row: {
          access_token: string
          connected_at: string
          connected_by: string | null
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          connected_by?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          connected_by?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contabil_configuracao_aliquotas: {
        Row: {
          aliquota: number
          aliquota_adicional: number
          ativo: boolean
          base_calculo: number
          created_at: string
          empresa: string
          id: string
          imposto: string
          observacoes: string | null
          regime: string
          updated_at: string
        }
        Insert: {
          aliquota?: number
          aliquota_adicional?: number
          ativo?: boolean
          base_calculo?: number
          created_at?: string
          empresa: string
          id?: string
          imposto: string
          observacoes?: string | null
          regime: string
          updated_at?: string
        }
        Update: {
          aliquota?: number
          aliquota_adicional?: number
          ativo?: boolean
          base_calculo?: number
          created_at?: string
          empresa?: string
          id?: string
          imposto?: string
          observacoes?: string | null
          regime?: string
          updated_at?: string
        }
        Relationships: []
      }
      contabil_consultas_impostos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa: string | null
          id: string
          observacoes: string | null
          parametros: Json | null
          periodo_fim: string | null
          periodo_inicio: string | null
          resultado: Json | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa?: string | null
          id?: string
          observacoes?: string | null
          parametros?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          resultado?: Json | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa?: string | null
          id?: string
          observacoes?: string | null
          parametros?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          resultado?: Json | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      contabil_notas_fiscais: {
        Row: {
          created_at: string
          created_by: string | null
          data_emissao: string | null
          empresa: string
          id: string
          impostos: Json | null
          nome_evento: string | null
          numero: string | null
          numero_evento: string | null
          observacoes: string | null
          status: string
          tipo_servico: string | null
          tomador_documento: string | null
          tomador_email: string | null
          tomador_nome: string
          updated_at: string
          valor_bruto: number
          valor_liquido: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          empresa: string
          id?: string
          impostos?: Json | null
          nome_evento?: string | null
          numero?: string | null
          numero_evento?: string | null
          observacoes?: string | null
          status?: string
          tipo_servico?: string | null
          tomador_documento?: string | null
          tomador_email?: string | null
          tomador_nome: string
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          empresa?: string
          id?: string
          impostos?: Json | null
          nome_evento?: string | null
          numero?: string | null
          numero_evento?: string | null
          observacoes?: string | null
          status?: string
          tipo_servico?: string | null
          tomador_documento?: string | null
          tomador_email?: string | null
          tomador_nome?: string
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number | null
        }
        Relationships: []
      }
      contabil_recebimentos: {
        Row: {
          banco: string | null
          created_at: string
          created_by: string | null
          data_recebimento: string
          empresa: string
          id: string
          nota_id: string | null
          numero_nf: string | null
          observacoes: string | null
          updated_at: string
          valor_recebido: number
        }
        Insert: {
          banco?: string | null
          created_at?: string
          created_by?: string | null
          data_recebimento: string
          empresa: string
          id?: string
          nota_id?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          updated_at?: string
          valor_recebido?: number
        }
        Update: {
          banco?: string | null
          created_at?: string
          created_by?: string | null
          data_recebimento?: string
          empresa?: string
          id?: string
          nota_id?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          updated_at?: string
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "contabil_recebimentos_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "contabil_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_anexos: {
        Row: {
          created_at: string
          demanda_id: string
          id: string
          mime_type: string | null
          nome: string
          path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          demanda_id: string
          id?: string
          mime_type?: string | null
          nome: string
          path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          demanda_id?: string
          id?: string
          mime_type?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      demanda_comentarios: {
        Row: {
          created_at: string
          demanda_id: string
          id: string
          mencoes: string[] | null
          texto: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          created_at?: string
          demanda_id: string
          id?: string
          mencoes?: string[] | null
          texto: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          created_at?: string
          demanda_id?: string
          id?: string
          mencoes?: string[] | null
          texto?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      demanda_historico: {
        Row: {
          acao: string
          created_at: string
          demanda_id: string
          detalhes: string | null
          id: string
          status_anterior: Database["public"]["Enums"]["compra_status"] | null
          status_novo: Database["public"]["Enums"]["compra_status"] | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          demanda_id: string
          detalhes?: string | null
          id?: string
          status_anterior?: Database["public"]["Enums"]["compra_status"] | null
          status_novo?: Database["public"]["Enums"]["compra_status"] | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          demanda_id?: string
          detalhes?: string | null
          id?: string
          status_anterior?: Database["public"]["Enums"]["compra_status"] | null
          status_novo?: Database["public"]["Enums"]["compra_status"] | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      demanda_patrimonio_registros: {
        Row: {
          demanda_id: string
          id: string
          observacoes: string | null
          pat_item_id: string | null
          registrado_em: string
          registrado_por: string | null
        }
        Insert: {
          demanda_id: string
          id?: string
          observacoes?: string | null
          pat_item_id?: string | null
          registrado_em?: string
          registrado_por?: string | null
        }
        Update: {
          demanda_id?: string
          id?: string
          observacoes?: string | null
          pat_item_id?: string | null
          registrado_em?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demanda_patrimonio_registros_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: true
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_patrimonio_registros_pat_item_id_fkey"
            columns: ["pat_item_id"]
            isOneToOne: false
            referencedRelation: "pat_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          categoria_external_id: string | null
          comprador: string | null
          condicao_pagamento: string | null
          created_at: string
          created_by: string | null
          data_compra: string | null
          data_solicitacao: string
          descritivo: string | null
          documento: string | null
          evento_projeto: string | null
          evento_projeto_id: string | null
          fornecedor: string | null
          fornecedor_id: string | null
          id: string
          motivo_negacao: string | null
          numero: number | null
          observacoes: string | null
          ordem: number
          parcelamento: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          solicitante: string | null
          solicitante_id: string | null
          status: Database["public"]["Enums"]["compra_status"]
          tipo_demanda: string | null
          titulo: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          categoria_external_id?: string | null
          comprador?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string | null
          data_solicitacao?: string
          descritivo?: string | null
          documento?: string | null
          evento_projeto?: string | null
          evento_projeto_id?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          motivo_negacao?: string | null
          numero?: number | null
          observacoes?: string | null
          ordem?: number
          parcelamento?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          solicitante?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          tipo_demanda?: string | null
          titulo?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          categoria_external_id?: string | null
          comprador?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string | null
          data_solicitacao?: string
          descritivo?: string | null
          documento?: string | null
          evento_projeto?: string | null
          evento_projeto_id?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          motivo_negacao?: string | null
          numero?: number | null
          observacoes?: string | null
          ordem?: number
          parcelamento?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          solicitante?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          tipo_demanda?: string | null
          titulo?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_evento_projeto_id_fkey"
            columns: ["evento_projeto_id"]
            isOneToOne: false
            referencedRelation: "eventos_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_projetos: {
        Row: {
          codigo: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          desmontagem_fim: string | null
          desmontagem_inicio: string | null
          id: string
          local: string | null
          montagem_fim: string | null
          montagem_inicio: string | null
          nome: string
          observacoes: string | null
          produtor: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          desmontagem_fim?: string | null
          desmontagem_inicio?: string | null
          id?: string
          local?: string | null
          montagem_fim?: string | null
          montagem_inicio?: string | null
          nome: string
          observacoes?: string | null
          produtor?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          desmontagem_fim?: string | null
          desmontagem_inicio?: string | null
          id?: string
          local?: string | null
          montagem_fim?: string | null
          montagem_inicio?: string | null
          nome?: string
          observacoes?: string | null
          produtor?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_rotina_anexos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nome: string
          path: string
          rotina_id: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome: string
          path: string
          rotina_id: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome?: string
          path?: string
          rotina_id?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_rotina_anexos_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "financeiro_rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_rotina_execucao_anexos: {
        Row: {
          created_at: string
          execucao_id: string
          id: string
          mime_type: string | null
          nome: string
          path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          execucao_id: string
          id?: string
          mime_type?: string | null
          nome: string
          path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          execucao_id?: string
          id?: string
          mime_type?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_rotina_execucao_anexos_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_rotina_execucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_rotina_execucoes: {
        Row: {
          created_at: string
          data_referencia: string
          executada: boolean
          executada_em: string
          executada_por: string | null
          executada_por_nome: string | null
          id: string
          observacoes: string | null
          rotina_id: string
          validacao_observacao: string | null
          validacao_status: string
          validado_em: string | null
          validado_por: string | null
          validado_por_nome: string | null
        }
        Insert: {
          created_at?: string
          data_referencia: string
          executada?: boolean
          executada_em?: string
          executada_por?: string | null
          executada_por_nome?: string | null
          id?: string
          observacoes?: string | null
          rotina_id: string
          validacao_observacao?: string | null
          validacao_status?: string
          validado_em?: string | null
          validado_por?: string | null
          validado_por_nome?: string | null
        }
        Update: {
          created_at?: string
          data_referencia?: string
          executada?: boolean
          executada_em?: string
          executada_por?: string | null
          executada_por_nome?: string | null
          id?: string
          observacoes?: string | null
          rotina_id?: string
          validacao_observacao?: string | null
          validacao_status?: string
          validado_em?: string | null
          validado_por?: string | null
          validado_por_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_rotina_execucoes_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "financeiro_rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_rotinas: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          dias_semana: number[] | null
          encerrada: boolean
          exige_validacao: boolean
          frequencia: string
          hora: string
          id: string
          max_ocorrencias: number | null
          ocorrencias_realizadas: number
          proxima_data: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          dias_semana?: number[] | null
          encerrada?: boolean
          exige_validacao?: boolean
          frequencia: string
          hora?: string
          id?: string
          max_ocorrencias?: number | null
          ocorrencias_realizadas?: number
          proxima_data?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          dias_semana?: number[] | null
          encerrada?: boolean
          exige_validacao?: boolean
          frequencia?: string
          hora?: string
          id?: string
          max_ocorrencias?: number | null
          ocorrencias_realizadas?: number
          proxima_data?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_status_defaults: {
        Row: {
          created_at: string
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["compra_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status: Database["public"]["Enums"]["compra_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["compra_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          contato_nome: string | null
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["entity_status"]
          telefone: string | null
          tipo_fornecimento: string | null
          updated_at: string
        }
        Insert: {
          contato_nome?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          tipo_fornecimento?: string | null
          updated_at?: string
        }
        Update: {
          contato_nome?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          tipo_fornecimento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      itens: {
        Row: {
          categoria: string | null
          codigo: string
          codigo_proprio: string | null
          created_at: string
          descricao: string | null
          foto_url: string | null
          id: string
          localizacao: string | null
          nome: string
          observacoes: string | null
          quantidade_atual: number
          quantidade_minima: number
          status: Database["public"]["Enums"]["item_status"]
          subcategoria: string | null
          unidade: string
          updated_at: string
          valor_unitario: number | null
        }
        Insert: {
          categoria?: string | null
          codigo: string
          codigo_proprio?: string | null
          created_at?: string
          descricao?: string | null
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          observacoes?: string | null
          quantidade_atual?: number
          quantidade_minima?: number
          status?: Database["public"]["Enums"]["item_status"]
          subcategoria?: string | null
          unidade?: string
          updated_at?: string
          valor_unitario?: number | null
        }
        Update: {
          categoria?: string | null
          codigo?: string
          codigo_proprio?: string | null
          created_at?: string
          descricao?: string | null
          foto_url?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          observacoes?: string | null
          quantidade_atual?: number
          quantidade_minima?: number
          status?: Database["public"]["Enums"]["item_status"]
          subcategoria?: string | null
          unidade?: string
          updated_at?: string
          valor_unitario?: number | null
        }
        Relationships: []
      }
      juridico_contratos: {
        Row: {
          cliente_documento: string | null
          cliente_email: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          corpo_html: string | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_fechamento: string | null
          empresa: string | null
          forma_pagamento: string | null
          id: string
          modelo_id: string | null
          observacoes: string | null
          ordem: number
          proposta_numero: number | null
          proposta_ref: string | null
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
          valor: number | null
          variaveis_valores: Json | null
        }
        Insert: {
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          corpo_html?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_fechamento?: string | null
          empresa?: string | null
          forma_pagamento?: string | null
          id?: string
          modelo_id?: string | null
          observacoes?: string | null
          ordem?: number
          proposta_numero?: number | null
          proposta_ref?: string | null
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
          valor?: number | null
          variaveis_valores?: Json | null
        }
        Update: {
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          corpo_html?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_fechamento?: string | null
          empresa?: string | null
          forma_pagamento?: string | null
          id?: string
          modelo_id?: string | null
          observacoes?: string | null
          ordem?: number
          proposta_numero?: number | null
          proposta_ref?: string | null
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          valor?: number | null
          variaveis_valores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "juridico_contratos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "juridico_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_modelos: {
        Row: {
          ativo: boolean
          corpo_html: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
          variaveis: Json
        }
        Insert: {
          ativo?: boolean
          corpo_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          ativo?: boolean
          corpo_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          variaveis?: Json
        }
        Relationships: []
      }
      modulos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          rota: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          rota?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          rota?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacao_itens: {
        Row: {
          created_at: string
          id: string
          item_id: string
          movimentacao_id: string
          quantidade: number
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          movimentacao_id: string
          quantidade: number
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          movimentacao_id?: string
          quantidade?: number
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacao_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_itens_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          condicao: Database["public"]["Enums"]["devolucao_condicao"] | null
          created_at: string
          data_movimento: string
          data_prevista_devolucao: string | null
          desconto: number | null
          empresa: string | null
          entrada_tipo: Database["public"]["Enums"]["entrada_tipo"] | null
          evento_projeto: string | null
          finalidade: string | null
          fornecedor_id: string | null
          frete: number | null
          id: string
          ipi: number | null
          item_id: string | null
          nota_fiscal: string | null
          observacoes: string | null
          outros_custos: number | null
          quantidade: number | null
          quantidade_solicitada: number | null
          requisicao_numero: number | null
          responsavel_lancamento: string | null
          responsavel_recebimento: string | null
          responsavel_retirada: string | null
          saida_origem_id: string | null
          saida_status: Database["public"]["Enums"]["saida_status"] | null
          saida_tipo: Database["public"]["Enums"]["saida_tipo"] | null
          solicitante_id: string | null
          tipo: Database["public"]["Enums"]["movement_kind"]
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          condicao?: Database["public"]["Enums"]["devolucao_condicao"] | null
          created_at?: string
          data_movimento?: string
          data_prevista_devolucao?: string | null
          desconto?: number | null
          empresa?: string | null
          entrada_tipo?: Database["public"]["Enums"]["entrada_tipo"] | null
          evento_projeto?: string | null
          finalidade?: string | null
          fornecedor_id?: string | null
          frete?: number | null
          id?: string
          ipi?: number | null
          item_id?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          outros_custos?: number | null
          quantidade?: number | null
          quantidade_solicitada?: number | null
          requisicao_numero?: number | null
          responsavel_lancamento?: string | null
          responsavel_recebimento?: string | null
          responsavel_retirada?: string | null
          saida_origem_id?: string | null
          saida_status?: Database["public"]["Enums"]["saida_status"] | null
          saida_tipo?: Database["public"]["Enums"]["saida_tipo"] | null
          solicitante_id?: string | null
          tipo: Database["public"]["Enums"]["movement_kind"]
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          condicao?: Database["public"]["Enums"]["devolucao_condicao"] | null
          created_at?: string
          data_movimento?: string
          data_prevista_devolucao?: string | null
          desconto?: number | null
          empresa?: string | null
          entrada_tipo?: Database["public"]["Enums"]["entrada_tipo"] | null
          evento_projeto?: string | null
          finalidade?: string | null
          fornecedor_id?: string | null
          frete?: number | null
          id?: string
          ipi?: number | null
          item_id?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          outros_custos?: number | null
          quantidade?: number | null
          quantidade_solicitada?: number | null
          requisicao_numero?: number | null
          responsavel_lancamento?: string | null
          responsavel_recebimento?: string | null
          responsavel_retirada?: string | null
          saida_origem_id?: string | null
          saida_status?: Database["public"]["Enums"]["saida_status"] | null
          saida_tipo?: Database["public"]["Enums"]["saida_tipo"] | null
          solicitante_id?: string | null
          tipo?: Database["public"]["Enums"]["movement_kind"]
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_saida_origem_id_fkey"
            columns: ["saida_origem_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "solicitantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_consultas: {
        Row: {
          chave: string
          data_emissao: string | null
          destinatario_cnpj: string | null
          destinatario_nome: string | null
          emitente_cnpj: string | null
          emitente_nome: string | null
          empresa: string
          id: string
          numero: string | null
          raw: Json | null
          serie: string | null
          status: string | null
          synced_at: string
          valor: number | null
          xml_url: string | null
        }
        Insert: {
          chave: string
          data_emissao?: string | null
          destinatario_cnpj?: string | null
          destinatario_nome?: string | null
          emitente_cnpj?: string | null
          emitente_nome?: string | null
          empresa: string
          id?: string
          numero?: string | null
          raw?: Json | null
          serie?: string | null
          status?: string | null
          synced_at?: string
          valor?: number | null
          xml_url?: string | null
        }
        Update: {
          chave?: string
          data_emissao?: string | null
          destinatario_cnpj?: string | null
          destinatario_nome?: string | null
          emitente_cnpj?: string | null
          emitente_nome?: string | null
          empresa?: string
          id?: string
          numero?: string | null
          raw?: Json | null
          serie?: string | null
          status?: string | null
          synced_at?: string
          valor?: number | null
          xml_url?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          concluida: boolean
          concluida_em: string | null
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_mutes: {
        Row: {
          created_at: string
          id: string
          modulo_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modulo_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modulo_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      parcelamentos: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      pat_itens: {
        Row: {
          categoria: string | null
          cod: number | null
          created_at: string
          data_compra: string | null
          dimensoes: string | null
          especificacao: string | null
          estado: string
          id: string
          id_item: string | null
          imagem_url: string | null
          localizacao: string | null
          nome: string
          observacoes: string | null
          quantidade: number
          subcategoria: string | null
          unidade: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          cod?: number | null
          created_at?: string
          data_compra?: string | null
          dimensoes?: string | null
          especificacao?: string | null
          estado?: string
          id?: string
          id_item?: string | null
          imagem_url?: string | null
          localizacao?: string | null
          nome: string
          observacoes?: string | null
          quantidade?: number
          subcategoria?: string | null
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          cod?: number | null
          created_at?: string
          data_compra?: string | null
          dimensoes?: string | null
          especificacao?: string | null
          estado?: string
          id?: string
          id_item?: string | null
          imagem_url?: string | null
          localizacao?: string | null
          nome?: string
          observacoes?: string | null
          quantidade?: number
          subcategoria?: string | null
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      pat_movimentacoes: {
        Row: {
          condicao: string | null
          created_at: string
          created_by: string | null
          data_movimento: string
          data_prevista_devolucao: string | null
          evento_projeto: string | null
          finalidade: string | null
          id: string
          item_id: string | null
          observacoes: string | null
          quantidade: number
          requisicao_numero: number | null
          responsavel: string | null
          saida_origem_id: string | null
          saida_status: string | null
          tipo: string
        }
        Insert: {
          condicao?: string | null
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          data_prevista_devolucao?: string | null
          evento_projeto?: string | null
          finalidade?: string | null
          id?: string
          item_id?: string | null
          observacoes?: string | null
          quantidade?: number
          requisicao_numero?: number | null
          responsavel?: string | null
          saida_origem_id?: string | null
          saida_status?: string | null
          tipo: string
        }
        Update: {
          condicao?: string | null
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          data_prevista_devolucao?: string | null
          evento_projeto?: string | null
          finalidade?: string | null
          id?: string
          item_id?: string | null
          observacoes?: string | null
          quantidade?: number
          requisicao_numero?: number | null
          responsavel?: string | null
          saida_origem_id?: string | null
          saida_status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pat_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pat_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pat_movimentacoes_saida_origem_id_fkey"
            columns: ["saida_origem_id"]
            isOneToOne: false
            referencedRelation: "pat_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rh_vagas: {
        Row: {
          candidato_email: string | null
          candidato_nome: string | null
          candidato_telefone: string | null
          created_at: string
          created_by: string | null
          departamento: string | null
          descricao: string | null
          empresa: string | null
          fonte: string | null
          id: string
          observacoes: string | null
          ordem: number
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          candidato_email?: string | null
          candidato_nome?: string | null
          candidato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          descricao?: string | null
          empresa?: string | null
          fonte?: string | null
          id?: string
          observacoes?: string | null
          ordem?: number
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          candidato_email?: string | null
          candidato_nome?: string | null
          candidato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          descricao?: string | null
          empresa?: string | null
          fonte?: string | null
          id?: string
          observacoes?: string | null
          ordem?: number
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitantes: {
        Row: {
          apelido: string | null
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          setor: string | null
          status: Database["public"]["Enums"]["entity_status"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          apelido?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          apelido?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_modulos: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          modulo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          modulo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          modulo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_proxima_data_rotina: {
        Args: {
          p_data_base: string
          p_dias_semana: number[]
          p_frequencia: string
        }
        Returns: string
      }
      enqueue_notificacoes: { Args: { rows: Json }; Returns: undefined }
      get_profile_names: {
        Args: { _ids: string[] }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      has_module_access: {
        Args: { _slug: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_module_admin: {
        Args: { _slug: string; _user_id: string }
        Returns: boolean
      }
      move_compra_status: {
        Args: {
          p_id: string
          p_responsavel_id?: string
          p_responsavel_nome?: string
          p_status: Database["public"]["Enums"]["compra_status"]
        }
        Returns: undefined
      }
      next_pat_requisicao_numero: { Args: never; Returns: number }
      next_proposta_numero: { Args: never; Returns: number }
      next_requisicao_numero: { Args: never; Returns: number }
      primeira_data_rotina: {
        Args: {
          p_data_inicio: string
          p_dias_semana: number[]
          p_frequencia: string
        }
        Returns: string
      }
      reconciliar_estoque: { Args: { p_item_id: string }; Returns: number }
      refresh_item_status: { Args: { p_item_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
      compra_status:
        | "solicitacao"
        | "analise"
        | "negada"
        | "pendente_aprovacao"
        | "aprovada"
        | "em_andamento"
        | "a_receber"
        | "finalizado"
      devolucao_condicao:
        | "perfeito"
        | "danificado"
        | "quebrado"
        | "faltando_peca"
        | "em_manutencao"
        | "perdido"
      entity_status: "ativo" | "inativo"
      entrada_tipo:
        | "compra"
        | "doacao"
        | "ajuste"
        | "retorno"
        | "transferencia"
        | "outros"
      item_status:
        | "disponivel"
        | "baixo_estoque"
        | "sem_estoque"
        | "em_manutencao"
        | "inativo"
      movement_kind: "entrada" | "saida" | "devolucao" | "ajuste"
      saida_status:
        | "aberta"
        | "parcialmente_devolvida"
        | "devolvida"
        | "finalizada"
        | "cancelada"
      saida_tipo:
        | "evento"
        | "emprestimo"
        | "consumo"
        | "perda"
        | "quebra"
        | "manutencao"
        | "transferencia"
        | "outros"
        | "epi_fardamento"
        | "epi"
        | "fardamento"
        | "producao_novos_itens"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      compra_status: [
        "solicitacao",
        "analise",
        "negada",
        "pendente_aprovacao",
        "aprovada",
        "em_andamento",
        "a_receber",
        "finalizado",
      ],
      devolucao_condicao: [
        "perfeito",
        "danificado",
        "quebrado",
        "faltando_peca",
        "em_manutencao",
        "perdido",
      ],
      entity_status: ["ativo", "inativo"],
      entrada_tipo: [
        "compra",
        "doacao",
        "ajuste",
        "retorno",
        "transferencia",
        "outros",
      ],
      item_status: [
        "disponivel",
        "baixo_estoque",
        "sem_estoque",
        "em_manutencao",
        "inativo",
      ],
      movement_kind: ["entrada", "saida", "devolucao", "ajuste"],
      saida_status: [
        "aberta",
        "parcialmente_devolvida",
        "devolvida",
        "finalizada",
        "cancelada",
      ],
      saida_tipo: [
        "evento",
        "emprestimo",
        "consumo",
        "perda",
        "quebra",
        "manutencao",
        "transferencia",
        "outros",
        "epi_fardamento",
        "epi",
        "fardamento",
        "producao_novos_itens",
      ],
    },
  },
} as const
