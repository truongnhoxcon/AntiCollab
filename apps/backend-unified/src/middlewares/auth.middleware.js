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
    console.log(`[Auth Middleware] AWS Cognito Verifier initialized with 10s fetch timeout for User Pool: ${userPoolId}`);
  } catch (err) {
    console.error("[Auth Middleware] Failed to initialize Cognito verifier:", err);
  }
} else {
  console.log("[Auth Middleware] AWS Cognito environment variables missing. Falling back to local JWT secret verification.");
}

/**
 * Middleware to authenticate user requests using Cognito / JWT.
 */
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid. Use format: Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];

    if (cognitoVerifier) {
      try {
        // Verify via AWS Cognito
        const payload = await cognitoVerifier.verify(token);
        const email = payload.email;
        
        // Extract preferred_username, nickname, or name before falling back to UUID
        const cognitoUsername = payload.preferred_username || payload.nickname || payload.name || payload["cognito:username"] || payload.username || email.split('@')[0];

        // Sync with local PostgreSQL users table
        let userResult = await db.query(
          'SELECT id, username, email, display_name FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        let dbUser;
        if (userResult.rowCount === 0) {
          // Auto-insert user on first request
          const insertResult = await db.query(
            'INSERT INTO users (username, email, display_name) VALUES ($1, $2, $3) RETURNING id, username, email, display_name',
            [cognitoUsername, email.toLowerCase(), cognitoUsername]
          );
          dbUser = insertResult.rows[0];
          console.log(`[Auth Middleware] Auto-registered Cognito user in database: ${dbUser.username} (${dbUser.id})`);
        } else {
          dbUser = userResult.rows[0];
          
          // Auto-repair username and display_name if they were registered with a UUID previously
          const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
          if (uuidRegex.test(dbUser.username) && cognitoUsername !== dbUser.username) {
            console.log(`[Auth Middleware] Auto-repairing UUID profile for user ${email} to preferred_username: ${cognitoUsername}`);
            const updateResult = await db.query(
              'UPDATE users SET username = $1, display_name = $2 WHERE id = $3 RETURNING id, username, email, display_name',
              [cognitoUsername, cognitoUsername, dbUser.id]
            );
            dbUser = updateResult.rows[0];
          }
        }

        req.user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email
        };
        return next();
      } catch (cognitoErr) {
        console.error('[Auth Middleware] Cognito verification failed:', cognitoErr.message);
        return res.status(401).json({ error: 'Token is invalid or expired' });
      }
    } else {
      // Local JWT Fallback
      jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired' });
          }
          return res.status(401).json({ error: 'Token is invalid' });
        }

        try {
          const userResult = await db.query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [decoded.id]
          );
          if (userResult.rowCount === 0) {
            return res.status(401).json({ error: 'User does not exist in local database' });
          }
          req.user = userResult.rows[0];
          next();
        } catch (dbErr) {
          console.error('[Auth Middleware] DB lookup failed:', dbErr);
          return res.status(500).json({ error: 'Internal database error' });
        }
      });
    }
  } catch (error) {
    console.error('Error in authentication middleware:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
