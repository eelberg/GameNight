export * from './database'

// BGG API Types
export interface BGGGame {
  bggId: number
  name: string
  thumbnail?: string
  image?: string
  minPlayers: number
  maxPlayers: number
  playingTime: number
  bggRating?: number
  yearPublished?: number
  description?: string
}

export interface BGGCollectionItem extends BGGGame {
  userRating?: number
  own: boolean
  wantToPlay: boolean
  numPlays: number
  expansions?: BGGExpansion[]
}

export interface BGGExpansion {
  bggId: number
  name: string
  thumbnail?: string
}

// App-specific types
export interface UserProfile {
  id: string
  email: string
  name: string
  bggUsername?: string
  avatarUrl?: string
  preferences?: UserPreferences
}

export interface UserPreferences {
  notifications: {
    email: boolean
    push: boolean
  }
  defaultResponseDeadlineDays: number
  preferredPlayerCount?: {
    min: number
    max: number
  }
}

export interface Friend {
  id: string
  name: string
  email: string
  bggUsername?: string
  avatarUrl?: string
  status: 'pending' | 'accepted'
  isRequester: boolean
}

export interface GameWithOwner {
  game: BGGGame
  owners: {
    userId: string
    userName: string
    userRating?: number
  }[]
}

export interface EventWithDetails {
  id: string
  title: string
  description?: string
  location?: string
  responseDeadline: string
  status: 'draft' | 'pending' | 'confirmed' | 'cancelled' | 'completed'
  organizer: {
    id: string
    name: string
    avatarUrl?: string
  }
  dates: EventDate[]
  games: EventGameWithDetails[]
  participants: EventParticipantWithDetails[]
  finalDate?: EventDate
  finalGames?: FinalGameWithDetails[]
}

export interface EventDate {
  id: string
  proposedDate: string
  startTime?: string
  endTime?: string
  votes?: number
}

export interface EventGameWithDetails {
  id: string
  game: BGGGame
  proposedBy: {
    id: string
    name: string
  }
  isRecommended: boolean
  owner?: {
    id: string
    name: string
  }
  votes: number
}

export interface EventParticipantWithDetails {
  id: string
  user: {
    id: string
    name: string
    avatarUrl?: string
  }
  status: 'pending' | 'interested' | 'confirmed' | 'declined'
  invitedAt: string
  respondedAt?: string
  dateVotes?: {
    dateId: string
    available: boolean
  }[]
  gameVotes?: {
    eventGameId: string
    vote: number
  }[]
}

export interface FinalGameWithDetails {
  game: BGGGame
  responsible: {
    id: string
    name: string
  }
}

export interface DateRecommendation {
  date: EventDate
  availableCount: number
  percentage: number
}

export interface GameRecommendation {
  game: EventGameWithDetails
  score: number
  reasons: string[]
}
