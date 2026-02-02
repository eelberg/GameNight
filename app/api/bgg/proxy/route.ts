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
  
  let lastStatus = 0
  let lastError = ''
  
  // Try multiple times - BGG returns 202 while processing
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(BGG_URL, {
        headers: {
          'Accept': 'application/xml',
          'User-Agent': 'GameNight/1.0',
        },
      })
      
      lastStatus = response.status
      
      // BGG returns 202 when request is queued
      if (response.status === 202) {
        await new Promise(resolve => setTimeout(resolve, 3500))
        continue
      }
      
      if (!response.ok) {
        lastError = `BGG returned ${response.status}`
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      
      const xml = await response.text()
      
      // Check for queued message in XML
      if (xml.includes('Your request for this collection has been accepted')) {
        await new Promise(resolve => setTimeout(resolve, 3500))
        continue
      }
      
      // Check for error message
      if (xml.includes('<error>') || xml.includes('<errors>')) {
        lastError = 'BGG returned error in XML'
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
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
      lastError = error instanceof Error ? error.message : 'Unknown error'
      console.error(`BGG fetch error (attempt ${attempt + 1}):`, error)
      if (attempt < 7) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
    }
  }
  
  return new Response(JSON.stringify({ 
    error: `BGG no respondió después de 8 intentos. Último status: ${lastStatus}. Error: ${lastError}. Intenta de nuevo en 30 segundos.`
  }), {
    status: 504,
    headers: { 'Content-Type': 'application/json' },
  })
}
