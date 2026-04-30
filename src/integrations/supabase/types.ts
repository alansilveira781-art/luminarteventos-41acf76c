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
      fornecedores: {
        Row: {
          contato_nome: string | null
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
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
        }
        Insert: {
          categoria?: string | null
          codigo: string
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
        }
        Update: {
          categoria?: string | null
          codigo?: string
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
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          condicao: Database["public"]["Enums"]["devolucao_condicao"] | null
          created_at: string
          data_movimento: string
          data_prevista_devolucao: string | null
          entrada_tipo: Database["public"]["Enums"]["entrada_tipo"] | null
          evento_projeto: string | null
          finalidade: string | null
          fornecedor_id: string | null
          id: string
          item_id: string
          nota_fiscal: string | null
          observacoes: string | null
          quantidade: number
          quantidade_solicitada: number | null
          responsavel_lancamento: string | null
          responsavel_recebimento: string | null
          responsavel_retirada: string | null
          saida_origem_id: string | null
          saida_status: Database["public"]["Enums"]["saida_status"] | null
          saida_tipo: Database["public"]["Enums"]["saida_tipo"] | null
          solicitante_id: string | null
          tipo: Database["public"]["Enums"]["movement_kind"]
          valor_unitario: number | null
        }
        Insert: {
          condicao?: Database["public"]["Enums"]["devolucao_condicao"] | null
          created_at?: string
          data_movimento?: string
          data_prevista_devolucao?: string | null
          entrada_tipo?: Database["public"]["Enums"]["entrada_tipo"] | null
          evento_projeto?: string | null
          finalidade?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id: string
          nota_fiscal?: string | null
          observacoes?: string | null
          quantidade: number
          quantidade_solicitada?: number | null
          responsavel_lancamento?: string | null
          responsavel_recebimento?: string | null
          responsavel_retirada?: string | null
          saida_origem_id?: string | null
          saida_status?: Database["public"]["Enums"]["saida_status"] | null
          saida_tipo?: Database["public"]["Enums"]["saida_tipo"] | null
          solicitante_id?: string | null
          tipo: Database["public"]["Enums"]["movement_kind"]
          valor_unitario?: number | null
        }
        Update: {
          condicao?: Database["public"]["Enums"]["devolucao_condicao"] | null
          created_at?: string
          data_movimento?: string
          data_prevista_devolucao?: string | null
          entrada_tipo?: Database["public"]["Enums"]["entrada_tipo"] | null
          evento_projeto?: string | null
          finalidade?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          quantidade?: number
          quantidade_solicitada?: number | null
          responsavel_lancamento?: string | null
          responsavel_recebimento?: string | null
          responsavel_retirada?: string | null
          saida_origem_id?: string | null
          saida_status?: Database["public"]["Enums"]["saida_status"] | null
          saida_tipo?: Database["public"]["Enums"]["saida_tipo"] | null
          solicitante_id?: string | null
          tipo?: Database["public"]["Enums"]["movement_kind"]
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
      solicitantes: {
        Row: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_item_status: { Args: { p_item_id: string }; Returns: undefined }
    }
    Enums: {
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
      ],
    },
  },
} as const
