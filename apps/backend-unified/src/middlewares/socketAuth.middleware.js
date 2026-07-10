const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production';

/**
 * Socket.io Handshake Middleware to authenticate connecting clients.
 * Reads token from handshake auth payload or headers.
 */
module.exports = (socket, next) => {
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

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
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
  } catch (error) {
    console.error('Error during WebSocket handshake auth:', error);
    next(new Error('Internal authentication handler error'));
  }
};
