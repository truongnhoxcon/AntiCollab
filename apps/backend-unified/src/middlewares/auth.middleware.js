const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production';

/**
 * Middleware to authenticate user requests using JWT.
 */
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid. Use format: Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token has expired' });
        }
        return res.status(401).json({ error: 'Token is invalid' });
      }

      // Attach decoded user info to request object
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('Error in authentication middleware:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
