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
      blog_post_views: {
        Row: {
          id: string
          post_id: string
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          post_id: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          body_md: string
          category: Database["public"]["Enums"]["blog_category"]
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_featured: boolean
          published_at: string | null
          read_time_minutes: number | null
          review_note: string | null
          scheduled_for: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_post_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body_md?: string
          category?: Database["public"]["Enums"]["blog_category"]
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_featured?: boolean
          published_at?: string | null
          read_time_minutes?: number | null
          review_note?: string | null
          scheduled_for?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_md?: string
          category?: Database["public"]["Enums"]["blog_category"]
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_featured?: boolean
          published_at?: string | null
          read_time_minutes?: number | null
          review_note?: string | null
          scheduled_for?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bounties: {
        Row: {
          check_in_token: string | null
          check_in_token_expires_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          location: string | null
          max_participants: number | null
          min_participants: number
          on_chain_id: number | null
          on_chain_tx_hash: string | null
          reward_amount: number
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          check_in_token?: string | null
          check_in_token_expires_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          max_participants?: number | null
          min_participants?: number
          on_chain_id?: number | null
          on_chain_tx_hash?: string | null
          reward_amount: number
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          check_in_token?: string | null
          check_in_token_expires_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          max_participants?: number | null
          min_participants?: number
          on_chain_id?: number | null
          on_chain_tx_hash?: string | null
          reward_amount?: number
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bounty_draft_votes: {
        Row: {
          choice: string
          created_at: string
          draft_id: string
          id: string
          updated_at: string
          voter_id: string
          voter_wallet: string | null
        }
        Insert: {
          choice: string
          created_at?: string
          draft_id: string
          id?: string
          updated_at?: string
          voter_id: string
          voter_wallet?: string | null
        }
        Update: {
          choice?: string
          created_at?: string
          draft_id?: string
          id?: string
          updated_at?: string
          voter_id?: string
          voter_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bounty_draft_votes_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "bounty_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_drafts: {
        Row: {
          abstain_count: number
          catalyst_id: string | null
          completed_participants: number | null
          created_at: string
          dao_proposal_id: string | null
          deck_filename: string | null
          deck_url: string | null
          description: string | null
          executed_at: string | null
          executed_by: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          location: string | null
          max_participants: number
          name: string
          no_count: number
          on_chain_bounty_id: number | null
          on_chain_tx_hash: string | null
          outcome_notes: string | null
          proposer_id: string
          purpose_minted_snapshot: number | null
          reward_purpose: number
          snapshot_at: string | null
          status: string
          updated_at: string
          video_url: string | null
          vote_closes_at: string
          vote_opens_at: string
          yes_count: number
        }
        Insert: {
          abstain_count?: number
          catalyst_id?: string | null
          completed_participants?: number | null
          created_at?: string
          dao_proposal_id?: string | null
          deck_filename?: string | null
          deck_url?: string | null
          description?: string | null
          executed_at?: string | null
          executed_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          location?: string | null
          max_participants: number
          name: string
          no_count?: number
          on_chain_bounty_id?: number | null
          on_chain_tx_hash?: string | null
          outcome_notes?: string | null
          proposer_id: string
          purpose_minted_snapshot?: number | null
          reward_purpose: number
          snapshot_at?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
          vote_closes_at?: string
          vote_opens_at?: string
          yes_count?: number
        }
        Update: {
          abstain_count?: number
          catalyst_id?: string | null
          completed_participants?: number | null
          created_at?: string
          dao_proposal_id?: string | null
          deck_filename?: string | null
          deck_url?: string | null
          description?: string | null
          executed_at?: string | null
          executed_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          location?: string | null
          max_participants?: number
          name?: string
          no_count?: number
          on_chain_bounty_id?: number | null
          on_chain_tx_hash?: string | null
          outcome_notes?: string | null
          proposer_id?: string
          purpose_minted_snapshot?: number | null
          reward_purpose?: number
          snapshot_at?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
          vote_closes_at?: string
          vote_opens_at?: string
          yes_count?: number
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
      bounty_signups: {
        Row: {
          added_at: string | null
          added_by: string | null
          added_tx_hash: string | null
          bounty_id: string
          checked_in_at: string | null
          created_at: string
          id: string
          on_chain_bounty_id: number | null
          status: string
          updated_at: string
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          added_tx_hash?: string | null
          bounty_id: string
          checked_in_at?: string | null
          created_at?: string
          id?: string
          on_chain_bounty_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          added_tx_hash?: string | null
          bounty_id?: string
          checked_in_at?: string | null
          created_at?: string
          id?: string
          on_chain_bounty_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
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
      champion_applications: {
        Row: {
          champion_email: string | null
          champion_name: string
          created_at: string
          date_of_birth: string
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          guardian_relationship: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school: string
          status: string
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          champion_email?: string | null
          champion_name: string
          created_at?: string
          date_of_birth: string
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          guardian_relationship: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school: string
          status?: string
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          champion_email?: string | null
          champion_name?: string
          created_at?: string
          date_of_birth?: string
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          guardian_relationship?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school?: string
          status?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount_usdc: number
          block_number: number | null
          champion_referral: string | null
          charge_id: string | null
          created_at: string
          donor_wallet: string
          id: string
          log_index: number | null
          source: string
          status: string
          tx_hash: string | null
        }
        Insert: {
          amount_usdc: number
          block_number?: number | null
          champion_referral?: string | null
          charge_id?: string | null
          created_at?: string
          donor_wallet: string
          id?: string
          log_index?: number | null
          source: string
          status?: string
          tx_hash?: string | null
        }
        Update: {
          amount_usdc?: number
          block_number?: number | null
          champion_referral?: string | null
          charge_id?: string | null
          created_at?: string
          donor_wallet?: string
          id?: string
          log_index?: number | null
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
      membership_editions: {
        Row: {
          active: boolean
          animation_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          animation_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          animation_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_mints: {
        Row: {
          contract_address: string | null
          created_at: string
          donor_wallet: string
          edition_id: string | null
          id: string
          month_key: number
          status: string
          token_id: number | null
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          contract_address?: string | null
          created_at?: string
          donor_wallet: string
          edition_id?: string | null
          id?: string
          month_key: number
          status?: string
          token_id?: number | null
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          contract_address?: string | null
          created_at?: string
          donor_wallet?: string
          edition_id?: string | null
          id?: string
          month_key?: number
          status?: string
          token_id?: number | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_mints_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "membership_editions"
            referencedColumns: ["id"]
          },
        ]
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
      receipt_email_log: {
        Row: {
          charge_id: string | null
          error: string | null
          id: string
          receipt_token_id: number
          recipient_email: string
          recipient_kind: string
          resend_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          charge_id?: string | null
          error?: string | null
          id?: string
          receipt_token_id: number
          recipient_email: string
          recipient_kind: string
          resend_id?: string | null
          sent_at?: string
          status: string
        }
        Update: {
          charge_id?: string | null
          error?: string | null
          id?: string
          receipt_token_id?: number
          recipient_email?: string
          recipient_kind?: string
          resend_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      refund_pool_ledger: {
        Row: {
          actor: string | null
          amount_usdc: number
          charge_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          tx_hash: string | null
        }
        Insert: {
          actor?: string | null
          amount_usdc: number
          charge_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          tx_hash?: string | null
        }
        Update: {
          actor?: string | null
          amount_usdc?: number
          charge_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          tx_hash?: string | null
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
      vendor_charges: {
        Row: {
          auth_window_seconds: number | null
          cancel_tx_hash: string | null
          cancelled_at: string | null
          capture_tx_hash: string | null
          captured_at: string | null
          champion_signature: string | null
          champion_wallet: string
          created_at: string
          error: string | null
          expires_at: string
          id: string
          lock_tx_hash: string | null
          locked_at: string | null
          memo: string | null
          nonce: string
          purpose_amount_wei: number
          receipt_emailed_at: string | null
          receipt_error: string | null
          receipt_minted_at: string | null
          receipt_token_id: number | null
          receipt_tx_hash: string | null
          refund_reason: string | null
          refund_source: string | null
          refund_tx_hash: string | null
          refund_window_seconds: number | null
          refunded_at: string | null
          settled_at: string | null
          status: string
          sweep_tx_hash: string | null
          swept_at: string | null
          tx_hash: string | null
          updated_at: string
          usdc_payout: number | null
          vendor_user_id: string | null
          vendor_wallet: string
        }
        Insert: {
          auth_window_seconds?: number | null
          cancel_tx_hash?: string | null
          cancelled_at?: string | null
          capture_tx_hash?: string | null
          captured_at?: string | null
          champion_signature?: string | null
          champion_wallet: string
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          lock_tx_hash?: string | null
          locked_at?: string | null
          memo?: string | null
          nonce: string
          purpose_amount_wei: number
          receipt_emailed_at?: string | null
          receipt_error?: string | null
          receipt_minted_at?: string | null
          receipt_token_id?: number | null
          receipt_tx_hash?: string | null
          refund_reason?: string | null
          refund_source?: string | null
          refund_tx_hash?: string | null
          refund_window_seconds?: number | null
          refunded_at?: string | null
          settled_at?: string | null
          status?: string
          sweep_tx_hash?: string | null
          swept_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          usdc_payout?: number | null
          vendor_user_id?: string | null
          vendor_wallet: string
        }
        Update: {
          auth_window_seconds?: number | null
          cancel_tx_hash?: string | null
          cancelled_at?: string | null
          capture_tx_hash?: string | null
          captured_at?: string | null
          champion_signature?: string | null
          champion_wallet?: string
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          lock_tx_hash?: string | null
          locked_at?: string | null
          memo?: string | null
          nonce?: string
          purpose_amount_wei?: number
          receipt_emailed_at?: string | null
          receipt_error?: string | null
          receipt_minted_at?: string | null
          receipt_token_id?: number | null
          receipt_tx_hash?: string | null
          refund_reason?: string | null
          refund_source?: string | null
          refund_tx_hash?: string | null
          refund_window_seconds?: number | null
          refunded_at?: string | null
          settled_at?: string | null
          status?: string
          sweep_tx_hash?: string | null
          swept_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          usdc_payout?: number | null
          vendor_user_id?: string | null
          vendor_wallet?: string
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
      vendor_refund_config: {
        Row: {
          auth_window_seconds: number
          refund_window_seconds: number
          updated_at: string
          updated_by: string | null
          vendor_wallet: string
        }
        Insert: {
          auth_window_seconds: number
          refund_window_seconds: number
          updated_at?: string
          updated_by?: string | null
          vendor_wallet: string
        }
        Update: {
          auth_window_seconds?: number
          refund_window_seconds?: number
          updated_at?: string
          updated_by?: string | null
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
      waitlist_signups: {
        Row: {
          city: string
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
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
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          id: string | null
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      vendors_public_view: {
        Row: {
          approved: boolean | null
          business_name: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          logo_url: string | null
          wallet_address: string | null
        }
        Insert: {
          approved?: boolean | null
          business_name?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          wallet_address?: string | null
        }
        Update: {
          approved?: boolean | null
          business_name?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      eligible_vote_weight: { Args: { _wallet: string }; Returns: number }
      has_active_membership: { Args: { _wallet: string }; Returns: boolean }
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
      public_role_count: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      snapshot_bounty_draft_metrics: {
        Args: { _draft_id: string }
        Returns: {
          abstain_count: number
          catalyst_id: string | null
          completed_participants: number | null
          created_at: string
          dao_proposal_id: string | null
          deck_filename: string | null
          deck_url: string | null
          description: string | null
          executed_at: string | null
          executed_by: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          location: string | null
          max_participants: number
          name: string
          no_count: number
          on_chain_bounty_id: number | null
          on_chain_tx_hash: string | null
          outcome_notes: string | null
          proposer_id: string
          purpose_minted_snapshot: number | null
          reward_purpose: number
          snapshot_at: string | null
          status: string
          updated_at: string
          video_url: string | null
          vote_closes_at: string
          vote_opens_at: string
          yes_count: number
        }
        SetofOptions: {
          from: "*"
          to: "bounty_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
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
      blog_category:
        | "champion_story"
        | "bounty_recap"
        | "update"
        | "announcement"
        | "feature"
      blog_post_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "published"
        | "archived"
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
      blog_category: [
        "champion_story",
        "bounty_recap",
        "update",
        "announcement",
        "feature",
      ],
      blog_post_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "published",
        "archived",
      ],
    },
  },
} as const
