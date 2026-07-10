const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production';

/**
 * Handle user registration (Register)
 */
async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists (email or username)
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ error: 'Username or email already registered' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user to database
    const insertResult = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email.toLowerCase(), passwordHash]
    );

    const newUser = insertResult.rows[0];

    // Generate JWT token (expires in 1 hour)
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.created_at,
      },
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

/**
 * Handle user login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Retrieve user from DB
    const userResult = await db.query(
      'SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Verify password
    if (!user.password_hash) {
      return res.status(400).json({ error: 'This account was registered using Google. Please sign in with Google.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token (expires in 1 hour)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

/**
 * Handle Google OAuth login/registration
 */
async function googleLogin(req, res) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID Token is required' });
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Error verifying Google ID token:', verifyError);
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    // Check if user already exists
    const userResult = await db.query(
      'SELECT id, username, email, display_name as "displayName", avatar_url as "avatarUrl", created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    let dbUser;

    if (userResult.rowCount > 0) {
      // User exists, proceed with login
      dbUser = userResult.rows[0];
    } else {
      // User doesn't exist, create a new one
      let baseUsername = name || email.split('@')[0];
      // Clean up base username (keep alphanumeric, space, dot, underscore, dash)
      baseUsername = baseUsername.replace(/[^a-zA-Z0-9._ -]/g, '').trim();
      if (!baseUsername) baseUsername = 'GoogleUser';
      baseUsername = baseUsername.substring(0, 40);

      // Generate a unique username if it conflicts
      let uniqueUsername = baseUsername;
      let counter = 1;
      let usernameExists = true;
      while (usernameExists) {
        const checkUsername = await db.query(
          'SELECT id FROM users WHERE username = $1',
          [uniqueUsername]
        );
        if (checkUsername.rowCount === 0) {
          usernameExists = false;
        } else {
          uniqueUsername = `${baseUsername}${counter}`;
          counter++;
        }
      }

      // Insert new user with no password hash (null), Google's name as display_name, and picture as avatar_url
      const insertResult = await db.query(
        `INSERT INTO users (username, email, password_hash, display_name, avatar_url) 
         VALUES ($1, $2, NULL, $3, $4) 
         RETURNING id, username, email, display_name as "displayName", avatar_url as "avatarUrl", created_at`,
        [uniqueUsername, email.toLowerCase(), name, picture]
      );
      dbUser = insertResult.rows[0];
    }

    // Generate JWT token (expires in 1 hour)
    const token = jwt.sign(
      { id: dbUser.id, username: dbUser.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        displayName: dbUser.displayName || dbUser.username,
        avatarUrl: dbUser.avatarUrl,
        createdAt: dbUser.created_at || dbUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error during Google login:', error);
    return res.status(500).json({ error: 'Internal server error during Google login' });
  }
}

module.exports = {
  register,
  login,
  googleLogin,
};
