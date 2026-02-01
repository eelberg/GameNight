export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type EventStatus = 'draft' | 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected'
export type ParticipantStatus = 'pending' | 'interested' | 'confirmed' | 'declined'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          bgg_username: string | null
          avatar_url: string | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          bgg_username?: string | null
          avatar_url?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          bgg_username?: string | null
          avatar_url?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: FriendshipStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: FriendshipStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          addressee_id?: string
          status?: FriendshipStatus
          created_at?: string
          updated_at?: string
        }
      }
      games: {
        Row: {
          bgg_id: number
          name: string
          thumbnail: string | null
          image: string | null
          min_players: number
          max_players: number
          playing_time: number
          bgg_rating: number | null
          year_published: number | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          bgg_id: number
          name: string
          thumbnail?: string | null
          image?: string | null
          min_players: number
          max_players: number
          playing_time: number
          bgg_rating?: number | null
          year_published?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          bgg_id?: number
          name?: string
          thumbnail?: string | null
          image?: string | null
          min_players?: number
          max_players?: number
          playing_time?: number
          bgg_rating?: number | null
          year_published?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      expansions: {
        Row: {
          bgg_id: number
          base_game_id: number
          name: string
          thumbnail: string | null
          min_players: number | null
          max_players: number | null
          playing_time: number | null
          created_at: string
        }
        Insert: {
          bgg_id: number
          base_game_id: number
          name: string
          thumbnail?: string | null
          min_players?: number | null
          max_players?: number | null
          playing_time?: number | null
          created_at?: string
        }
        Update: {
          bgg_id?: number
          base_game_id?: number
          name?: string
          thumbnail?: string | null
          min_players?: number | null
          max_players?: number | null
          playing_time?: number | null
          created_at?: string
        }
      }
      game_collections: {
        Row: {
          id: string
          user_id: string
          game_id: number
          user_rating: number | null
          own: boolean
          want_to_play: boolean
          num_plays: number
          last_synced: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          game_id: number
          user_rating?: number | null
          own?: boolean
          want_to_play?: boolean
          num_plays?: number
          last_synced?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_id?: number
          user_rating?: number | null
          own?: boolean
          want_to_play?: boolean
          num_plays?: number
          last_synced?: string
          created_at?: string
        }
      }
      collection_expansions: {
        Row: {
          id: string
          collection_id: string
          expansion_id: number
          created_at: string
        }
        Insert: {
          id?: string
          collection_id: string
          expansion_id: number
          created_at?: string
        }
        Update: {
          id?: string
          collection_id?: string
          expansion_id?: number
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          location: string | null
          response_deadline: string
          status: EventStatus
          final_date_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          title: string
          description?: string | null
          location?: string | null
          response_deadline: string
          status?: EventStatus
          final_date_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string
          title?: string
          description?: string | null
          location?: string | null
          response_deadline?: string
          status?: EventStatus
          final_date_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      event_dates: {
        Row: {
          id: string
          event_id: string
          proposed_date: string
          start_time: string | null
          end_time: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          proposed_date: string
          start_time?: string | null
          end_time?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          proposed_date?: string
          start_time?: string | null
          end_time?: string | null
          created_at?: string
        }
      }
      event_games: {
        Row: {
          id: string
          event_id: string
          game_id: number
          proposed_by: string
          is_recommended: boolean
          owner_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          game_id: number
          proposed_by: string
          is_recommended?: boolean
          owner_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          game_id?: number
          proposed_by?: string
          is_recommended?: boolean
          owner_id?: string | null
          created_at?: string
        }
      }
      event_participants: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: ParticipantStatus
          invitation_token: string | null
          invited_at: string
          responded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status?: ParticipantStatus
          invitation_token?: string | null
          invited_at?: string
          responded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: ParticipantStatus
          invitation_token?: string | null
          invited_at?: string
          responded_at?: string | null
          created_at?: string
        }
      }
      date_votes: {
        Row: {
          id: string
          participant_id: string
          date_id: string
          available: boolean
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          date_id: string
          available?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          date_id?: string
          available?: boolean
          created_at?: string
        }
      }
      game_votes: {
        Row: {
          id: string
          participant_id: string
          event_game_id: string
          vote: number
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          event_game_id: string
          vote?: number
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          event_game_id?: string
          vote?: number
          created_at?: string
        }
      }
      event_final_games: {
        Row: {
          id: string
          event_id: string
          game_id: number
          responsible_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          game_id: number
          responsible_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          game_id?: number
          responsible_user_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_status: EventStatus
      friendship_status: FriendshipStatus
      participant_status: ParticipantStatus
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
