import { NextRequest } from 'next/server'

// Edge runtime has 30s timeout on free tier (vs 10s for serverless)
export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const username = searchParams.get('username')

  if (!username) {
    return new Response(JSON.stringify({ error: 'Username is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const BGG_URL = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`
  
  // Single attempt - client will handle retries
  try {
    const response = await fetch(BGG_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    
    // BGG returns 202 when request is queued - tell client to retry
    if (response.status === 202) {
      return new Response(JSON.stringify({ 
        status: 'processing',
        message: 'BGG está procesando tu colección'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: `BGG error: ${response.status}` 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    const xml = await response.text()
    
    // Check for queued message in XML
    if (xml.includes('Your request for this collection has been accepted')) {
      return new Response(JSON.stringify({ 
        status: 'processing',
        message: 'BGG está procesando tu colección'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // Return the XML directly
    return new Response(xml, {
      status: 200,
      headers: { 
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
