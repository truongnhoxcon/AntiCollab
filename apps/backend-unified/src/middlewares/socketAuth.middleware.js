const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { SimpleJwksCache } = require("aws-jwt-verify/jwk");
const { SimpleJsonFetcher } = require("aws-jwt-verify/https");
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production';

const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
const clientId = process.env.COGNITO_CLIENT_ID?.trim();

let cognitoVerifier = null;
if (userPoolId && clientId) {
  try {
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: userPoolId,
      tokenUse: "id",
      clientId: clientId,
    }, {
      jwksCache: new SimpleJwksCache({
        fetcher: new SimpleJsonFetcher({
          responseTimeout: 10000, // Increase fetch timeout to 10 seconds to bypass slow DNS/network latency
        }),
      }),
    });
    console.log(`[Socket Auth] AWS Cognito Verifier initialized with 10s fetch timeout for User Pool: ${userPoolId}`);
  } catch (err) {
    console.error("[Socket Auth] Failed to initialize Cognito verifier:", err);
  }
}

/**
 * Socket.io Handshake Middleware to authenticate connecting clients.
 * Reads token from handshake auth payload or headers.
 */
module.exports = async (socket, next) => {
  try {
    let token = socket.handshake.auth ? socket.handshake.auth.token : null;
    
    // Fallback to headers authorization (Bearer format or plain token)
    if (!token && socket.handshake.headers && socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        token = authHeader;
      }
    }

    if (!token) {
      console.warn(`Connection handshake rejected: No authentication token provided. Socket ID: ${socket.id}`);
      return next(new Error('Authentication error: Token is required'));
    }

    if (cognitoVerifier) {
      try {
        const payload = await cognitoVerifier.verify(token);
        const email = payload.email;

        // Fetch user from PostgreSQL by email
        const userResult = await db.query(
          'SELECT id, username FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        if (userResult.rowCount === 0) {
          console.warn(`WebSocket handshake rejected: User ${email} not yet registered in database. Socket ID: ${socket.id}`);
          return next(new Error('Authentication error: User record missing in database'));
        }

        const dbUser = userResult.rows[0];

        socket.user = {
          id: dbUser.id,
          username: dbUser.username,
        };

        console.log(`WebSocket authenticated via Cognito. User: ${dbUser.username} (${dbUser.id}). Socket ID: ${socket.id}`);
        return next();
      } catch (cognitoErr) {
        console.warn(`WebSocket handshake rejected: Invalid Cognito token. Reason: ${cognitoErr.message}. Socket ID: ${socket.id}`);
        return next(new Error('Authentication error: Cognito token is invalid or expired'));
      }
    } else {
      // Local JWT Fallback
      jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
          console.warn(`Connection handshake rejected: Invalid token. Reason: ${err.message}. Socket ID: ${socket.id}`);
          return next(new Error('Authentication error: Token is invalid or expired'));
        }

        // Attach decoded user metadata to the socket session
        socket.user = {
          id: decoded.id,
          username: decoded.username,
        };

        console.log(`Connection authenticated. User: ${decoded.username} (${decoded.id}). Socket ID: ${socket.id}`);
        next();
      });
    }
  } catch (error) {
    console.error('Error during WebSocket handshake auth:', error);
    next(new Error('Internal authentication handler error'));
  }
};
