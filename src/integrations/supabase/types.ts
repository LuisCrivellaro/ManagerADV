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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      atendimento_canal_config: {
        Row: {
          agente_ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          canal_ativo: string
          fonte_sugestoes: string
          id: boolean
          modo_teste: boolean
        }
        Insert: {
          agente_ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          canal_ativo?: string
          fonte_sugestoes?: string
          id?: boolean
          modo_teste?: boolean
        }
        Update: {
          agente_ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          canal_ativo?: string
          fonte_sugestoes?: string
          id?: boolean
          modo_teste?: boolean
        }
        Relationships: []
      }
      atendimento_contatos_teste: {
        Row: {
          canal: string
          contato_externo: string
          conversa_id: string | null
          criado_em: string
          id: string
          nome: string
          status: string
          telefone_ficticio: string
        }
        Insert: {
          canal?: string
          contato_externo: string
          conversa_id?: string | null
          criado_em?: string
          id?: string
          nome?: string
          status?: string
          telefone_ficticio: string
        }
        Update: {
          canal?: string
          contato_externo?: string
          conversa_id?: string | null
          criado_em?: string
          id?: string
          nome?: string
          status?: string
          telefone_ficticio?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          ator: string
          criado_em: string
          erro: string | null
          id: string
          perfil: string
          resumo: string
          status: string
        }
        Insert: {
          acao: string
          ator: string
          criado_em?: string
          erro?: string | null
          id?: string
          perfil?: string
          resumo?: string
          status?: string
        }
        Update: {
          acao?: string
          ator?: string
          criado_em?: string
          erro?: string | null
          id?: string
          perfil?: string
          resumo?: string
          status?: string
        }
        Relationships: []
      }
      casos: {
        Row: {
          ana_estado: Json | null
          created_at: string
          dados: Json
          etapa: string
          id: string
          nome: string
          ordem: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          ana_estado?: Json | null
          created_at?: string
          dados?: Json
          etapa?: string
          id?: string
          nome: string
          ordem?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          ana_estado?: Json | null
          created_at?: string
          dados?: Json
          etapa?: string
          id?: string
          nome?: string
          ordem?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      casos_modelo: {
        Row: {
          dados: Json
          ordem: number
        }
        Insert: {
          dados: Json
          ordem: number
        }
        Update: {
          dados?: Json
          ordem?: number
        }
        Relationships: []
      }
      checklist_itens: {
        Row: {
          caso_id: string
          id: string
          nome: string
          ordem: number
          owner_id: string
          recebido: boolean
          updated_at: string
        }
        Insert: {
          caso_id: string
          id?: string
          nome: string
          ordem?: number
          owner_id: string
          recebido?: boolean
          updated_at?: string
        }
        Update: {
          caso_id?: string
          id?: string
          nome?: string
          ordem?: number
          owner_id?: string
          recebido?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_review_assignments: {
        Row: {
          caso_id: string
          due_date: string | null
          lawyer_id: string | null
          updated_at: string
        }
        Insert: {
          caso_id: string
          due_date?: string | null
          lawyer_id?: string | null
          updated_at?: string
        }
        Update: {
          caso_id?: string
          due_date?: string | null
          lawyer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_review_assignments_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: true
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_approvals: {
        Row: {
          approved_by: string | null
          caso_id: string
          created_at: string
          id: string
          kind: string
          owner_id: string
          revision: string
        }
        Insert: {
          approved_by?: string | null
          caso_id: string
          created_at?: string
          id?: string
          kind: string
          owner_id: string
          revision: string
        }
        Update: {
          approved_by?: string | null
          caso_id?: string
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          revision?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_approvals_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      office_workspace: {
        Row: {
          dados: Json
          owner_id: string
          updated_at: string
        }
        Insert: {
          dados?: Json
          owner_id: string
          updated_at?: string
        }
        Update: {
          dados?: Json
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cargo?: string
          created_at?: string
          id: string
          nome?: string
        }
        Update: {
          cargo?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      approve_material: {
        Args: { p_case: string; p_kind: string }
        Returns: undefined
      }
      destino_canal: {
        Args: { p_conversa: string }
        Returns: {
          canal: string
          contato_externo: string
          nome: string
          telefone_ficticio: string
        }[]
      }
      draft_approval_queue: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      material_approved: {
        Args: { p_case: string; p_kind: string; p_owner: string }
        Returns: boolean
      }
      material_revision: {
        Args: { p_case: string; p_kind: string; p_owner: string }
        Returns: string
      }
      material_status: { Args: { p_case: string }; Returns: Json }
      registrar_audit_log: {
        Args: {
          p_acao: string
          p_ator: string
          p_erro?: string
          p_perfil: string
          p_resumo: string
          p_status: string
        }
        Returns: undefined
      }
      schedule_draft_review: {
        Args: { p_case: string; p_due?: string; p_lawyer?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "advogada_senior"
        | "advogado_junior"
        | "atendente"
        | "operacoes"
        | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "advogada_senior",
        "advogado_junior",
        "atendente",
        "operacoes",
        "admin",
      ],
    },
  },
} as const
