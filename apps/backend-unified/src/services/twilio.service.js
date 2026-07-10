const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client only if credentials are set
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Fetch ICE Server list (STUN/TURN) from Twilio.
 * If credentials are not set, falls back to Google's public STUN servers for local development.
 * 
 * @returns {Promise<Object>} ICE Servers configuration for RTCPeerConnection
 */
async function getIceCredentials() {
  if (!client) {
    console.warn('Twilio credentials not configured. Falling back to public Google STUN server for development.');
    return {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
          ],
        },
      ],
      ttl: 86400,
      fallback: true,
    };
  }

  try {
    // Generate credentials with a 24-hour TTL (86400 seconds)
    const token = await client.tokens.create({ ttl: 86400 });
    
    return {
      iceServers: token.iceServers,
      ttl: token.ttl,
      fallback: false,
    };
  } catch (error) {
    console.error('Error fetching ICE credentials from Twilio:', error);
    throw new Error('Failed to retrieve WebRTC network traversal credentials');
  }
}

module.exports = {
  getIceCredentials,
};
