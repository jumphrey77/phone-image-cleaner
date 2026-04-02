const { OAuth2Client } = require('google-auth-library')
const http = require('http')
const https = require('https')

const SCOPES = [
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
]
const REDIRECT_PORT = 8765
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function gpPost(accessToken, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const options = {
      hostname: 'photoslibrary.googleapis.com',
      path,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }
    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (c) => (raw += c))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) })
        } catch { resolve({ status: res.statusCode, data: raw }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function getAccessToken(tokens, clientId, clientSecret) {
  const client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI)
  // Use only the refresh_token — forces a fresh access token every time,
  // avoiding stale access_tokens from previous OAuth sessions with wrong scopes
  client.setCredentials({ refresh_token: tokens.refresh_token })
  const { credentials } = await client.refreshAccessToken()
  return { accessToken: credentials.access_token, credentials }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseGpDate(isoString) {
  // GP dates are ISO 8601: "2024-06-01T12:34:56Z"
  return isoString ? isoString.substring(0, 10) : null
}

function dateToGpFilter(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

// ── Service ───────────────────────────────────────────────────────────────────

const GooglePhotosService = {
  // Returns the redirect URI so the renderer can display it for setup instructions
  getRedirectUri() {
    return REDIRECT_URI
  },

  // Returns { success, authUrl, tokenPromise }
  // Caller opens authUrl in browser, then awaits tokenPromise for tokens
  prepareOAuth(clientId, clientSecret) {
    try {
      const client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI)
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      })

      const tokenPromise = new Promise((resolve) => {
        let server = null

        const timeout = setTimeout(() => {
          if (server) server.close()
          resolve({ success: false, error: 'OAuth timed out (5 minutes).' })
        }, 5 * 60 * 1000)

        server = http.createServer(async (req, res) => {
          const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          if (error || !code) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<html><body><h2>❌ Authorization denied.</h2><p>You can close this window.</p></body></html>')
            clearTimeout(timeout)
            server.close()
            resolve({ success: false, error: `OAuth denied: ${error || 'no code'}` })
            return
          }

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>✅ Connected to Google Photos!</h2><p>You can close this window and return to the app.</p></body></html>')
          clearTimeout(timeout)
          server.close()

          try {
            const { tokens } = await client.getToken(code)
            resolve({ success: true, tokens })
          } catch (err) {
            resolve({ success: false, error: err.message })
          }
        })

        server.on('error', (err) => {
          clearTimeout(timeout)
          resolve({ success: false, error: `Local server error: ${err.message}` })
        })

        server.listen(REDIRECT_PORT, 'localhost')
      })

      return { success: true, authUrl, tokenPromise }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // ── Picker API ────────────────────────────────────────────────────────────

  // Step 1: Create a picker session — returns { sessionId, pickerUri }
  // Note: Picker API does NOT support any filters on the session object (confirmed 400 error).
  // Date filtering is handled client-side after items are retrieved.
  // dateRange param is kept in signature so callers don't break, but is ignored here.
  async createPickerSession(tokens, clientId, clientSecret, dateRange = null) {
    try {
      const { accessToken } = await getAccessToken(tokens, clientId, clientSecret)

      const resp = await new Promise((resolve, reject) => {
        const data = JSON.stringify({})
        const options = {
          hostname: 'photospicker.googleapis.com',
          path: '/v1/sessions',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        }
        const req = https.request(options, (res) => {
          let raw = ''
          res.on('data', (c) => (raw += c))
          res.on('end', () => {
            try { resolve({ status: res.statusCode, data: JSON.parse(raw) })
            } catch { resolve({ status: res.statusCode, data: raw }) }
          })
        })
        req.on('error', reject)
        req.write(data)
        req.end()
      })
      if (resp.status !== 200) {
        return { success: false, error: `Picker API ${resp.status}: ${JSON.stringify(resp.data)}` }
      }
      return {
        success: true,
        sessionId: resp.data.id,
        pickerUri: resp.data.pickerUri
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // Step 2: Poll until user finishes selecting (mediaItemsSet = true)
  async pollPickerSession(tokens, clientId, clientSecret, sessionId) {
    try {
      const { accessToken } = await getAccessToken(tokens, clientId, clientSecret)
      // Poll up to 10 minutes, every 3 seconds
      const maxAttempts = 200
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const resp = await new Promise((resolve, reject) => {
          const options = {
            hostname: 'photospicker.googleapis.com',
            path: `/v1/sessions/${sessionId}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
          }
          const req = https.request(options, (res) => {
            let raw = ''
            res.on('data', (c) => (raw += c))
            res.on('end', () => {
              try { resolve({ status: res.statusCode, data: JSON.parse(raw) })
              } catch { resolve({ status: res.statusCode, data: raw }) }
            })
          })
          req.on('error', reject)
          req.end()
        })
        if (resp.data.mediaItemsSet === true) {
          return { success: true, done: true }
        }
      }
      return { success: false, error: 'Picker timed out — no selection made within 10 minutes.' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // Step 3: Fetch the selected media items
  async getPickerItems(tokens, clientId, clientSecret, sessionId) {
    try {
      const { accessToken } = await getAccessToken(tokens, clientId, clientSecret)
      let items = []
      let pageToken = null

      do {
        let path = `/v1/mediaItems?sessionId=${sessionId}&pageSize=100`
        if (pageToken) path += `&pageToken=${pageToken}`

        const resp = await new Promise((resolve, reject) => {
          const options = {
            hostname: 'photospicker.googleapis.com',
            path,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
          }
          const req = https.request(options, (res) => {
            let raw = ''
            res.on('data', (c) => (raw += c))
            res.on('end', () => {
              try { resolve({ status: res.statusCode, data: JSON.parse(raw) })
              } catch { resolve({ status: res.statusCode, data: raw }) }
            })
          })
          req.on('error', reject)
          req.end()
        })

        if (resp.status !== 200) {
          return { success: false, error: `Picker items API ${resp.status}: ${JSON.stringify(resp.data)}` }
        }

        const page = resp.data.mediaItems || []
        items = items.concat(page.map((item) => ({
          id: item.id,
          filename: item.mediaFile?.filename || '',
          mimeType: item.mediaFile?.mimeType || '',
          createTime: item.createTime,
          date: item.createTime ? item.createTime.substring(0, 10) : null,
          type: (item.mediaFile?.mimeType || '').startsWith('video') ? 'video' : 'photo'
        })))

        pageToken = resp.data.nextPageToken || null
      } while (pageToken)

      return { success: true, items, total: items.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // ── Library API (legacy stubs) ─────────────────────────────────────────────

  // List media items by date range — returns array of { id, filename, date }
  async listByDateRange(tokens, startDate, endDate, clientId, clientSecret) {
    try {
      const { accessToken } = await getAccessToken(tokens, clientId, clientSecret)
      let items = []
      let pageToken = null

      do {
        const body = {
          filters: {
            dateFilter: {
              ranges: [{
                startDate: dateToGpFilter(startDate),
                endDate: dateToGpFilter(endDate)
              }]
            }
          },
          pageSize: 100
        }
        if (pageToken) body.pageToken = pageToken

        const resp = await gpPost(accessToken, '/v1/mediaItems:search', body)

        if (resp.status !== 200) {
          return { success: false, error: `GP API error ${resp.status}: ${JSON.stringify(resp.data)}` }
        }

        const page = resp.data.mediaItems || []
        items = items.concat(page.map((item) => ({
          id: item.id,
          filename: item.filename,
          date: parseGpDate(item.mediaMetadata?.creationTime)
        })))

        pageToken = resp.data.nextPageToken || null
      } while (pageToken)

      return { success: true, items }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // Delete media items by ID array — returns { success, deleted, failed }
  async batchDelete(tokens, mediaItemIds, clientId, clientSecret) {
    if (!mediaItemIds || mediaItemIds.length === 0) {
      return { success: true, deleted: 0, failed: 0 }
    }
    try {
      const { accessToken } = await getAccessToken(tokens, clientId, clientSecret)
      // GP batchDelete accepts max 50 IDs at a time
      const chunks = []
      for (let i = 0; i < mediaItemIds.length; i += 50) {
        chunks.push(mediaItemIds.slice(i, i + 50))
      }

      let deleted = 0
      let failed = 0
      for (const chunk of chunks) {
        const resp = await gpPost(accessToken, '/v1/mediaItems:batchDelete', { mediaItemIds: chunk })
        if (resp.status === 200) {
          deleted += chunk.length
        } else {
          failed += chunk.length
        }
      }
      return { success: true, deleted, failed }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // Check if tokens are valid / refresh if needed
  async checkAuth(tokens, clientId, clientSecret) {
    try {
      const { accessToken } = await getAccessToken(tokens, clientId, clientSecret)
      return { success: true, valid: !!accessToken }
    } catch (err) {
      return { success: false, valid: false, error: err.message }
    }
  }
}

module.exports = { GooglePhotosService }
