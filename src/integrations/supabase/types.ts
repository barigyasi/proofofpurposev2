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
      bounties: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          location: string | null
          on_chain_id: number | null
          on_chain_tx_hash: string | null
          reward_amount: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          on_chain_id?: number | null
          on_chain_tx_hash?: string | null
          reward_amount: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          on_chain_id?: number | null
          on_chain_tx_hash?: string | null
          reward_amount?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bounty_drafts: {
        Row: {
          catalyst_id: string | null
          created_at: string
          dao_proposal_id: number | null
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          location: string | null
          max_participants: number
          name: string
          on_chain_bounty_id: number | null
          on_chain_tx_hash: string | null
          proposer_id: string
          reward_purpose: number
          status: string
          updated_at: string
        }
        Insert: {
          catalyst_id?: string | null
          created_at?: string
          dao_proposal_id?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          max_participants: number
          name: string
          on_chain_bounty_id?: number | null
          on_chain_tx_hash?: string | null
          proposer_id: string
          reward_purpose: number
          status?: string
          updated_at?: string
        }
        Update: {
          catalyst_id?: string | null
          created_at?: string
          dao_proposal_id?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          max_participants?: number
          name?: string
          on_chain_bounty_id?: number | null
          on_chain_tx_hash?: string | null
          proposer_id?: string
          reward_purpose?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_drafts_catalyst_id_fkey"
            columns: ["catalyst_id"]
            isOneToOne: false
            referencedRelation: "catalyst_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_rewards: {
        Row: {
          bounty_id: string | null
          created_at: string
          id: string
          mint_tx_hash: string | null
          on_chain_bounty_id: number | null
          participant_wallet: string
          purpose_amount: number
        }
        Insert: {
          bounty_id?: string | null
          created_at?: string
          id?: string
          mint_tx_hash?: string | null
          on_chain_bounty_id?: number | null
          participant_wallet: string
          purpose_amount: number
        }
        Update: {
          bounty_id?: string | null
          created_at?: string
          id?: string
          mint_tx_hash?: string | null
          on_chain_bounty_id?: number | null
          participant_wallet?: string
          purpose_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "bounty_rewards_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_comments: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          post_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          post_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "bulletin_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_posts: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: []
      }
      catalyst_orgs: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          contact_email: string | null
          created_at: string
          id: string
          location: string | null
          logo_url: string | null
          mission: string | null
          org_name: string
          updated_at: string
          user_id: string
          wallet_address: string
          website: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          mission?: string | null
          org_name: string
          updated_at?: string
          user_id: string
          wallet_address: string
          website?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          mission?: string | null
          org_name?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string
          website?: string | null
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount_usdc: number
          champion_referral: string | null
          charge_id: string | null
          created_at: string
          donor_wallet: string
          id: string
          source: string
          status: string
          tx_hash: string | null
        }
        Insert: {
          amount_usdc: number
          champion_referral?: string | null
          charge_id?: string | null
          created_at?: string
          donor_wallet: string
          id?: string
          source: string
          status?: string
          tx_hash?: string | null
        }
        Update: {
          amount_usdc?: number
          champion_referral?: string | null
          charge_id?: string | null
          created_at?: string
          donor_wallet?: string
          id?: string
          source?: string
          status?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      governance_config: {
        Row: {
          id: number
          updated_at: string
          vote_contract_address: string | null
          vote_token_address: string | null
        }
        Insert: {
          id?: number
          updated_at?: string
          vote_contract_address?: string | null
          vote_token_address?: string | null
        }
        Update: {
          id?: number
          updated_at?: string
          vote_contract_address?: string | null
          vote_token_address?: string | null
        }
        Relationships: []
      }
      pending_applicants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          wallet_address?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          username: string | null
          wallet_address: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          username?: string | null
          wallet_address: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          username?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          id: string
          text: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          text: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          text?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_redemptions: {
        Row: {
          champion_wallet: string
          created_at: string
          id: string
          purpose_amount_wei: number
          tx_hash: string | null
          usdc_payout: number
          vendor_wallet: string
        }
        Insert: {
          champion_wallet: string
          created_at?: string
          id?: string
          purpose_amount_wei: number
          tx_hash?: string | null
          usdc_payout: number
          vendor_wallet: string
        }
        Update: {
          champion_wallet?: string
          created_at?: string
          id?: string
          purpose_amount_wei?: number
          tx_hash?: string | null
          usdc_payout?: number
          vendor_wallet?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          approved: boolean
          approved_tx_hash: string | null
          business_name: string
          category: string | null
          contact_email: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string
          w9_url: string | null
          wallet_address: string
        }
        Insert: {
          approved?: boolean
          approved_tx_hash?: string | null
          business_name: string
          category?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          w9_url?: string | null
          wallet_address: string
        }
        Update: {
          approved?: boolean
          approved_tx_hash?: string | null
          business_name?: string
          category?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          w9_url?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          choice: string
          created_at: string
          id: string
          proposal_id: string | null
          voter_id: string
          voter_wallet: string
        }
        Insert: {
          choice: string
          created_at?: string
          id?: string
          proposal_id?: string | null
          voter_id: string
          voter_wallet: string
        }
        Update: {
          choice?: string
          created_at?: string
          id?: string
          proposal_id?: string | null
          voter_id?: string
          voter_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_auth_nonces: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          nonce: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "vendor"
        | "champion"
        | "donor"
        | "support"
        | "catalyst"
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
      app_role: ["admin", "vendor", "champion", "donor", "support", "catalyst"],
    },
  },
} as const
