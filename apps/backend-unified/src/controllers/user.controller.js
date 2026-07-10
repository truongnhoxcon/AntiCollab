const db = require('../config/db');
const bcrypt = require('bcryptjs');


/**
 * GET /api/users/me/dms
 * Returns all active DM conversations of the current user.
 * Auto-seeds default DMs if none exist.
 */
async function getMyDMs(req, res) {
  try {
    const userId = req.user.id;

    // Check if user has any DMs
    const dmsResult = await db.query(
      `SELECT ud.id as dm_id, ud.dm_user_id, u.username 
       FROM user_dms ud
       JOIN users u ON ud.dm_user_id = u.id
       WHERE ud.user_id = $1 AND ud.active = TRUE
       ORDER BY ud.created_at DESC`,
      [userId]
    );

    const dms = dmsResult.rows.map(row => ({
      id: row.dm_id,
      dmUserId: row.dm_user_id,
      user: {
        id: row.dm_user_id,
        username: row.username
      }
    }));

    return res.status(200).json({ success: true, dms });
  } catch (error) {
    console.error('Error fetching DMs:', error);
    return res.status(500).json({ error: 'Internal server error fetching DMs' });
  }
}

/**
 * DELETE /api/users/me/dms/:dmUserId
 * Hides a DM conversation (sets active = FALSE).
 */
async function hideDM(req, res) {
  try {
    const userId = req.user.id;
    const { dmUserId } = req.params;

    await db.query(
      `UPDATE user_dms 
       SET active = FALSE 
       WHERE user_id = $1 AND dm_user_id = $2`,
      [userId, dmUserId]
    );

    return res.status(200).json({ success: true, message: 'DM conversation hidden' });
  } catch (error) {
    console.error('Error hiding DM:', error);
    return res.status(500).json({ error: 'Internal server error hiding DM' });
  }
}

/**
 * GET /api/users/me/friends
 * Returns list of friends based on status filter ('online', 'all', 'pending').
 * Auto-seeds default friends if none exist.
 */
async function getMyFriends(req, res) {
  try {
    const userId = req.user.id;
    const { status } = req.query; // 'online', 'all', 'pending'

    // Check if user has any friends at all
    const friendsResult = await db.query(
      `SELECT f.status as friend_status, u.id as friend_id, u.username, u.email
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1`,
      [userId]
    );

    let friends = friendsResult.rows.map(row => {
      return {
        id: row.friend_id,
        username: row.username,
        email: row.email,
        friendStatus: row.friend_status, // 'accepted' or 'pending'
        status: 'offline',
        customStatus: 'Offline'
      };
    });

    // Apply filters
    if (status === 'online') {
      friends = friends.filter(f => f.friendStatus === 'accepted' && f.status === 'online');
    } else if (status === 'pending') {
      friends = friends.filter(f => f.friendStatus === 'pending');
    } else {
      // 'all' tab shows all accepted friends
      friends = friends.filter(f => f.friendStatus === 'accepted');
    }

    return res.status(200).json({ success: true, friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    return res.status(500).json({ error: 'Internal server error fetching friends' });
  }
}

/**
 * POST /api/users/me/friends
 * Sends a friend request or adds a friend by username.
 */
async function addFriend(req, res) {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Find the user to add
    const targetUserResult = await db.query(
      'SELECT id, username FROM users WHERE LOWER(username) = $1',
      [username.trim().toLowerCase()]
    );

    if (targetUserResult.rowCount === 0) {
      return res.status(444).json({ error: 'User not found. Check the username capitalization and try again.' });
    }

    const targetUser = targetUserResult.rows[0];

    if (targetUser.id === userId) {
      return res.status(400).json({ error: "You cannot add yourself as a friend." });
    }

    // Create the friend relation (accepted by default for simplicity in this demo)
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) 
       VALUES ($1, $2, 'accepted') 
       ON CONFLICT (user_id, friend_id) 
       DO UPDATE SET status = 'accepted'`,
      [userId, targetUser.id]
    );

    // Also insert mutual relationship so they see you too
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) 
       VALUES ($1, $2, 'accepted') 
       ON CONFLICT (user_id, friend_id) 
       DO UPDATE SET status = 'accepted'`,
      [targetUser.id, userId]
    );

    // Automatically create a DM conversation for convenience
    await db.query(
      `INSERT INTO user_dms (user_id, dm_user_id, active) 
       VALUES ($1, $2, TRUE) 
       ON CONFLICT (user_id, dm_user_id) 
       DO UPDATE SET active = TRUE`,
      [userId, targetUser.id]
    );

    return res.status(200).json({
      success: true,
      message: `Successfully added ${targetUser.username} as a friend!`,
      friend: {
        id: targetUser.id,
        username: targetUser.username,
        status: 'online', // default mock
        friendStatus: 'accepted'
      }
    });
  } catch (error) {
    console.error('Error adding friend:', error);
    return res.status(500).json({ error: 'Internal server error adding friend' });
  }
}

/**
 * GET /api/users/me/activities
 * Returns recent activities of friends.
 */
async function getActivities(req, res) {
  try {
    const userId = req.user.id;

    // Get activities of accepted friends
    const activitiesResult = await db.query(
      `SELECT a.name, a.type, a.details, u.username, u.id as user_id 
       FROM activities a
       JOIN users u ON a.user_id = u.id
       JOIN friends f ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       ORDER BY a.created_at DESC`,
      [userId]
    );

    const activities = activitiesResult.rows.map(row => ({
      user: {
        id: row.user_id,
        username: row.username
      },
      name: row.name,
      type: row.type,
      details: row.details
    }));

    return res.status(200).json({ success: true, activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return res.status(500).json({ error: 'Internal server error fetching activities' });
  }
}

/**
 * POST /api/users/me/dms
 * Starts or activates a DM conversation.
 */
async function startDM(req, res) {
  try {
    const userId = req.user.id;
    const { dmUserId } = req.body;

    if (!dmUserId) {
      return res.status(400).json({ error: 'dmUserId is required' });
    }

    await db.query(
      `INSERT INTO user_dms (user_id, dm_user_id, active) 
       VALUES ($1, $2, TRUE) 
       ON CONFLICT (user_id, dm_user_id) 
       DO UPDATE SET active = TRUE`,
      [userId, dmUserId]
    );

    return res.status(200).json({ success: true, message: 'DM conversation started' });
  } catch (error) {
    console.error('Error starting DM:', error);
    return res.status(500).json({ error: 'Internal server error starting DM' });
  }
}

/**
 * GET /api/users/me
 * Returns current user's profile details.
 */
async function getMe(req, res) {
  try {
    const userId = req.user.id;
    const userResult = await db.query(
      'SELECT id, username, email, display_name as "displayName", avatar_url as "avatarUrl", about_me as "aboutMe", banner_color as "bannerColor", custom_status as "customStatus", created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        aboutMe: user.aboutMe,
        bannerColor: user.bannerColor,
        customStatus: user.customStatus,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Internal server error fetching profile' });
  }
}

/**
 * POST /api/users/me/verify-password
 * Verifies current user's password and returns the real email.
 */
async function verifyPassword(req, res) {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const userResult = await db.query(
      'SELECT password_hash, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    if (!user.password_hash) {
      return res.status(400).json({ error: 'This account does not have a password set (registered via Google OAuth).' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.status(200).json({
      success: true,
      email: user.email
    });
  } catch (error) {
    console.error('Error verifying password:', error);
    return res.status(500).json({ error: 'Internal server error verifying password' });
  }
}

/**
 * PATCH /api/users/me
 * Updates current user's profile details.
 */
async function updateMe(req, res) {
  try {
    const userId = req.user.id;
    const { displayName, aboutMe, bannerColor, customStatus, removeAvatar } = req.body;
    let avatarUrl = undefined;

    // Check if file was uploaded
    if (req.file) {
      avatarUrl = `/api/uploads/${req.file.filename}`;
    } else if (removeAvatar === 'true') {
      avatarUrl = '';
    }

    // Retrieve current values first to handle optional parameters
    const currentResult = await db.query(
      'SELECT display_name, avatar_url, about_me, banner_color, custom_status FROM users WHERE id = $1',
      [userId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentProfile = currentResult.rows[0];
    const finalDisplayName = displayName !== undefined ? displayName : currentProfile.display_name;
    const finalAboutMe = aboutMe !== undefined ? aboutMe : currentProfile.about_me;
    const finalBannerColor = bannerColor !== undefined ? bannerColor : currentProfile.banner_color;
    const finalCustomStatus = customStatus !== undefined ? customStatus : currentProfile.custom_status;
    const finalAvatarUrl = avatarUrl !== undefined ? avatarUrl : currentProfile.avatar_url;

    const result = await db.query(
      `UPDATE users 
       SET display_name = $1, avatar_url = $2, about_me = $3, banner_color = $4, custom_status = $5
       WHERE id = $6 
       RETURNING id, username, email, display_name as "displayName", avatar_url as "avatarUrl", about_me as "aboutMe", banner_color as "bannerColor", custom_status as "customStatus", created_at`,
      [finalDisplayName || '', finalAvatarUrl || '', finalAboutMe || '', finalBannerColor || '#5865F2', finalCustomStatus || '', userId]
    );

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Internal server error updating user profile' });
  }
}

module.exports = {
  getMyDMs,
  hideDM,
  getMyFriends,
  addFriend,
  getActivities,
  startDM,
  getMe,
  verifyPassword,
  updateMe
};


