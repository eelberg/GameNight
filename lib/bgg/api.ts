import { parseStringPromise } from 'xml2js'
import type { BGGGame, BGGCollectionItem, BGGExpansion } from '@/types'

const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2'

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  let lastError: Error | null = null
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/xml',
        },
      })
      
      // BGG returns 202 when the request is queued - need to wait longer
      if (response.status === 202) {
        console.log(`BGG returned 202, attempt ${i + 1}/${retries}, waiting...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
        continue
      }
      
      if (response.ok) {
        return response
      }
      
      console.log(`BGG returned ${response.status}, attempt ${i + 1}/${retries}`)
      lastError = new Error(`BGG returned status ${response.status}`)
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)))
      }
    } catch (error) {
      console.log(`BGG fetch error, attempt ${i + 1}/${retries}:`, error)
      lastError = error instanceof Error ? error : new Error('Unknown fetch error')
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)))
      }
    }
  }
  
  throw new Error(`Failed to fetch from BGG API after ${retries} retries: ${lastError?.message || 'Unknown error'}`)
}

export async function getUserCollection(username: string): Promise<BGGCollectionItem[]> {
  const cacheKey = `collection:${username}`
  const cached = getCached<BGGCollectionItem[]>(cacheKey)
  if (cached) return cached

  const url = `${BGG_API_BASE}/collection?username=${encodeURIComponent(username)}&own=1&stats=1`
  const response = await fetchWithRetry(url)
  const xml = await response.text()
  const result = await parseStringPromise(xml, { explicitArray: false })

  if (!result.items?.item) {
    return []
  }

  const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item]
  
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const collection: BGGCollectionItem[] = items.map((item: any) => {
    const stats = item.stats
    const rating = stats?.rating
    
    return {
      bggId: parseInt(item.$.objectid, 10),
      name: typeof item.name === 'object' ? item.name._ : item.name,
      thumbnail: item.thumbnail,
      image: item.image,
      minPlayers: parseInt(stats?.$?.minplayers || '1', 10),
      maxPlayers: parseInt(stats?.$?.maxplayers || '99', 10),
      playingTime: parseInt(stats?.$?.playingtime || '0', 10),
      bggRating: rating?.average?.$?.value ? parseFloat(rating.average.$.value) : undefined,
      yearPublished: item.yearpublished ? parseInt(item.yearpublished, 10) : undefined,
      userRating: rating?.$?.value && rating.$.value !== 'N/A' ? parseFloat(rating.$.value) : undefined,
      own: item.status?.$?.own === '1',
      wantToPlay: item.status?.$?.wanttoplay === '1',
      numPlays: parseInt(item.numplays || '0', 10),
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  setCache(cacheKey, collection)
  return collection
}

export async function getGameDetails(gameIds: number[]): Promise<BGGGame[]> {
  if (gameIds.length === 0) return []

  const cacheKey = `games:${gameIds.sort().join(',')}`
  const cached = getCached<BGGGame[]>(cacheKey)
  if (cached) return cached

  // BGG allows up to 20 games per request
  const chunks: number[][] = []
  for (let i = 0; i < gameIds.length; i += 20) {
    chunks.push(gameIds.slice(i, i + 20))
  }

  const allGames: BGGGame[] = []

  for (const chunk of chunks) {
    const url = `${BGG_API_BASE}/thing?id=${chunk.join(',')}&stats=1`
    const response = await fetchWithRetry(url)
    const xml = await response.text()
    const result = await parseStringPromise(xml, { explicitArray: false })

    if (!result.items?.item) continue

    const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item]

    /* eslint-disable @typescript-eslint/no-explicit-any */
    for (const item of items as any[]) {
      const name = Array.isArray(item.name) 
        ? item.name.find((n: any) => n.$.type === 'primary')?.$.value 
        : item.name?.$.value

      const statistics = item.statistics?.ratings
      
      allGames.push({
        bggId: parseInt(item.$.id, 10),
        name: name || 'Unknown',
        thumbnail: item.thumbnail,
        image: item.image,
        minPlayers: parseInt(item.minplayers?.$.value || '1', 10),
        maxPlayers: parseInt(item.maxplayers?.$.value || '99', 10),
        playingTime: parseInt(item.playingtime?.$.value || '0', 10),
        bggRating: statistics?.average?.$.value ? parseFloat(statistics.average.$.value) : undefined,
        yearPublished: item.yearpublished?.$.value ? parseInt(item.yearpublished.$.value, 10) : undefined,
        description: item.description,
      })
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  setCache(cacheKey, allGames)
  return allGames
}

export async function getGameExpansions(gameId: number): Promise<BGGExpansion[]> {
  const cacheKey = `expansions:${gameId}`
  const cached = getCached<BGGExpansion[]>(cacheKey)
  if (cached) return cached

  const url = `${BGG_API_BASE}/thing?id=${gameId}&type=boardgameexpansion`
  const response = await fetchWithRetry(url)
  const xml = await response.text()
  const result = await parseStringPromise(xml, { explicitArray: false })

  if (!result.items?.item) {
    return []
  }

  const item = result.items.item
  const links = Array.isArray(item.link) ? item.link : [item.link]
  
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const expansionLinks = links.filter(
    (link: any) => 
      link.$.type === 'boardgameexpansion' && 
      link.$.inbound !== 'true'
  )

  if (expansionLinks.length === 0) {
    setCache(cacheKey, [])
    return []
  }

  const expansionIds = expansionLinks.map(
    (link: any) => parseInt(link.$.id, 10)
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Fetch expansion details
  const expansionDetails = await getGameDetails(expansionIds)
  
  const expansions: BGGExpansion[] = expansionDetails.map(exp => ({
    bggId: exp.bggId,
    name: exp.name,
    thumbnail: exp.thumbnail,
  }))

  setCache(cacheKey, expansions)
  return expansions
}

export async function searchGames(query: string): Promise<BGGGame[]> {
  if (!query || query.length < 2) return []

  const cacheKey = `search:${query.toLowerCase()}`
  const cached = getCached<BGGGame[]>(cacheKey)
  if (cached) return cached

  const url = `${BGG_API_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`
  const response = await fetchWithRetry(url)
  const xml = await response.text()
  const result = await parseStringPromise(xml, { explicitArray: false })

  if (!result.items?.item) {
    return []
  }

  const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item]
  
  // Get only first 10 results and fetch their details
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const gameIds = items.slice(0, 10).map(
    (item: any) => parseInt(item.$.id, 10)
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const games = await getGameDetails(gameIds)
  
  setCache(cacheKey, games)
  return games
}
