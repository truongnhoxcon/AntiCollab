const { CognitoJwtVerifier } = require("aws-jwt-verify");
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production';

let cognitoVerifier = null;
if (process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID) {
  try {
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: "id",
      clientId: process.env.COGNITO_CLIENT_ID,
    });
    console.log(`[Auth Middleware] AWS Cognito Verifier initialized for User Pool: ${process.env.COGNITO_USER_POOL_ID}`);
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
        const cognitoUsername = payload["cognito:username"] || payload.username || email.split('@')[0];

        // Sync with local PostgreSQL users table
        let userResult = await db.query(
          'SELECT id, username, email FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        let dbUser;
        if (userResult.rowCount === 0) {
          // Auto-insert user on first request
          const insertResult = await db.query(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username, email',
            [cognitoUsername, email.toLowerCase()]
          );
          dbUser = insertResult.rows[0];
          console.log(`[Auth Middleware] Auto-registered Cognito user in database: ${dbUser.username} (${dbUser.id})`);
        } else {
          dbUser = userResult.rows[0];
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
