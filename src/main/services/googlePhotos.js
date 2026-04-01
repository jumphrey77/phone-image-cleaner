const { OAuth2Client } = require('google-auth-library')

const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata'
]

const GooglePhotosService = {
  getAuthUrl(clientCredentials) {
    try {
      const { clientId, clientSecret, redirectUri } = clientCredentials
      const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
      const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES })
      return { success: true, url }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async exchangeCode(clientCredentials, code) {
    try {
      const { clientId, clientSecret, redirectUri } = clientCredentials
      const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
      const { tokens } = await oauth2Client.getToken(code)
      return { success: true, tokens }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async listByDateRange(tokens, startDate, endDate) {
    // Phase 2: full Google Photos Library API search
    return { success: true, items: [], stub: true }
  },

  async deleteItems(tokens, mediaItemIds) {
    // Phase 2: batchDelete implementation
    return { success: true, deleted: 0, stub: true }
  }
}

module.exports = { GooglePhotosService }
