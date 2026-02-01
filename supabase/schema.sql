-- GameNight Database Schema for Supabase
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE event_status AS ENUM ('draft', 'pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE participant_status AS ENUM ('pending', 'interested', 'confirmed', 'declined');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  bgg_username TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Games table (cached from BGG)
CREATE TABLE games (
  bgg_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail TEXT,
  image TEXT,
  min_players INTEGER NOT NULL DEFAULT 1,
  max_players INTEGER NOT NULL DEFAULT 99,
  playing_time INTEGER NOT NULL DEFAULT 0,
  bgg_rating DECIMAL(3,2),
  year_published INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expansions table
CREATE TABLE expansions (
  bgg_id INTEGER PRIMARY KEY,
  base_game_id INTEGER NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  thumbnail TEXT,
  min_players INTEGER,
  max_players INTEGER,
  playing_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game collections (user's owned games)
CREATE TABLE game_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  user_rating DECIMAL(3,2),
  own BOOLEAN DEFAULT true,
  want_to_play BOOLEAN DEFAULT false,
  num_plays INTEGER DEFAULT 0,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Collection expansions (expansions user owns)
CREATE TABLE collection_expansions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES game_collections(id) ON DELETE CASCADE,
  expansion_id INTEGER NOT NULL REFERENCES expansions(bgg_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, expansion_id)
);

-- Events (quedadas)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  response_deadline TIMESTAMPTZ NOT NULL,
  status event_status DEFAULT 'draft',
  final_date_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event proposed dates
CREATE TABLE event_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  proposed_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for final_date after event_dates exists
ALTER TABLE events ADD CONSTRAINT fk_final_date 
  FOREIGN KEY (final_date_id) REFERENCES event_dates(id) ON DELETE SET NULL;

-- Event proposed games
CREATE TABLE event_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_recommended BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, game_id)
);

-- Event participants
CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status participant_status DEFAULT 'pending',
  invitation_token TEXT UNIQUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Date votes
CREATE TABLE date_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  date_id UUID NOT NULL REFERENCES event_dates(id) ON DELETE CASCADE,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, date_id)
);

-- Game votes
CREATE TABLE game_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  event_game_id UUID NOT NULL REFERENCES event_games(id) ON DELETE CASCADE,
  vote INTEGER DEFAULT 0 CHECK (vote >= -1 AND vote <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, event_game_id)
);

-- Final games for confirmed events
CREATE TABLE event_final_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  responsible_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, game_id)
);

-- Indexes for better query performance
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_game_collections_user ON game_collections(user_id);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_user ON event_participants(user_id);
CREATE INDEX idx_event_participants_token ON event_participants(invitation_token);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_expansions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_final_games ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Friendships policies
CREATE POLICY "Users can view their friendships" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create friend requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they're part of" ON friendships
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can delete their own friend requests" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Games policies (public read, service role write)
CREATE POLICY "Games are viewable by everyone" ON games
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert games" ON games
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update games" ON games
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Expansions policies
CREATE POLICY "Expansions are viewable by everyone" ON expansions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert expansions" ON expansions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Game collections policies
CREATE POLICY "Users can view collections of friends and self" ON game_collections
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND addressee_id = user_id)
        OR (addressee_id = auth.uid() AND requester_id = user_id))
    )
  );

CREATE POLICY "Users can manage own collection" ON game_collections
  FOR ALL USING (auth.uid() = user_id);

-- Collection expansions policies
CREATE POLICY "Users can view collection expansions" ON collection_expansions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM game_collections gc
      WHERE gc.id = collection_id
      AND (gc.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM friendships
          WHERE status = 'accepted'
          AND ((requester_id = auth.uid() AND addressee_id = gc.user_id)
            OR (addressee_id = auth.uid() AND requester_id = gc.user_id))
        )
      )
    )
  );

CREATE POLICY "Users can manage own collection expansions" ON collection_expansions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM game_collections gc
      WHERE gc.id = collection_id AND gc.user_id = auth.uid()
    )
  );

-- Events policies
CREATE POLICY "Users can view events they organize or participate in" ON events
  FOR SELECT USING (
    organizer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_id = events.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create events" ON events
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their events" ON events
  FOR UPDATE USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete their events" ON events
  FOR DELETE USING (auth.uid() = organizer_id);

-- Event dates policies
CREATE POLICY "Users can view dates of their events" ON event_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND (organizer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM event_participants
          WHERE event_participants.event_id = events.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Organizers can manage event dates" ON event_dates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id AND organizer_id = auth.uid()
    )
  );

-- Event games policies
CREATE POLICY "Users can view games of their events" ON event_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND (organizer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM event_participants
          WHERE event_participants.event_id = events.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Participants can propose games" ON event_games
  FOR INSERT WITH CHECK (
    auth.uid() = proposed_by AND
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND (organizer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM event_participants
          WHERE event_participants.event_id = events.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Organizers can manage event games" ON event_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id AND organizer_id = auth.uid()
    )
  );

-- Event participants policies
CREATE POLICY "Users can view participants of their events" ON event_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can add participants" ON event_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Participants can update their own status" ON event_participants
  FOR UPDATE USING (user_id = auth.uid());

-- Date votes policies
CREATE POLICY "Users can view votes of their events" ON date_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.id = participant_id
      AND (e.organizer_id = auth.uid() OR ep.user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can manage their date votes" ON date_votes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM event_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Game votes policies
CREATE POLICY "Users can view game votes of their events" ON game_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.id = participant_id
      AND (e.organizer_id = auth.uid() OR ep.user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can manage their game votes" ON game_votes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM event_participants
      WHERE id = participant_id AND user_id = auth.uid()
    )
  );

-- Event final games policies
CREATE POLICY "Users can view final games of their events" ON event_final_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND (organizer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM event_participants
          WHERE event_participants.event_id = events.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Organizers can manage final games" ON event_final_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id AND organizer_id = auth.uid()
    )
  );

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, bgg_username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'bgg_username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
