const db = require('../config/db');

/**
 * GET /api/users/me/dms
 * Returns all active DM conversations of the current user.
 * Auto-seeds default DMs if none exist.
 */
async function getMyDMs(req, res) {
  try {
    const userId = req.user.id;

    // Check if user has any DMs
    let dmsResult = await db.query(
      `SELECT ud.id as dm_id, ud.dm_user_id, u.username 
       FROM user_dms ud
       JOIN users u ON ud.dm_user_id = u.id
       WHERE ud.user_id = $1 AND ud.active = TRUE
       ORDER BY ud.created_at DESC`,
      [userId]
    );

    // Auto-seed DMs if empty
    if (dmsResult.rowCount === 0) {
      // Find seed users
      const seedUsers = await db.query(
        "SELECT id FROM users WHERE username IN ('Alex Mercer', 'Sarah Connor') AND id != $1",
        [userId]
      );

      for (const row of seedUsers.rows) {
        await db.query(
          `INSERT INTO user_dms (user_id, dm_user_id, active) 
           VALUES ($1, $2, TRUE) 
           ON CONFLICT (user_id, dm_user_id) 
           DO UPDATE SET active = TRUE`,
          [userId, row.id]
        );
      }

      // Query again
      dmsResult = await db.query(
        `SELECT ud.id as dm_id, ud.dm_user_id, u.username 
         FROM user_dms ud
         JOIN users u ON ud.dm_user_id = u.id
         WHERE ud.user_id = $1 AND ud.active = TRUE
         ORDER BY ud.created_at DESC`,
        [userId]
      );
    }

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
    let friendsResult = await db.query(
      `SELECT f.status as friend_status, u.id as friend_id, u.username, u.email
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1`,
      [userId]
    );

    // Auto-seed some friends if user has 0 friends
    if (friendsResult.rowCount === 0) {
      const seedUsers = await db.query(
        "SELECT id, username FROM users WHERE username IN ('Alex Mercer', 'Sarah Connor', 'Bruce Wayne', 'Peter Parker', 'Viet Nguyen') AND id != $1",
        [userId]
      );

      for (const row of seedUsers.rows) {
        // Seed some as accepted (Alex, Sarah, Bruce, Peter) and some as pending (Viet)
        const fStatus = row.username === 'Viet Nguyen' ? 'pending' : 'accepted';
        await db.query(
          `INSERT INTO friends (user_id, friend_id, status) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (user_id, friend_id) DO NOTHING`,
          [userId, row.id, fStatus]
        );
      }

      // Query again
      friendsResult = await db.query(
        `SELECT f.status as friend_status, u.id as friend_id, u.username, u.email
         FROM friends f
         JOIN users u ON f.friend_id = u.id
         WHERE f.user_id = $1`,
         [userId]
      );
    }

    // Process and filter based on 'status' query param
    // We will simulate presence ('online' vs 'offline') for the seed friends
    // Let's say: Alex Mercer, Sarah Connor, Bruce Wayne are 'online'; others are 'offline'
    const onlineUsernames = ['Alex Mercer', 'Sarah Connor', 'Bruce Wayne'];

    let friends = friendsResult.rows.map(row => {
      const isOnline = onlineUsernames.includes(row.username);
      return {
        id: row.friend_id,
        username: row.username,
        email: row.email,
        friendStatus: row.friend_status, // 'accepted' or 'pending'
        status: isOnline ? 'online' : 'offline', // simulated network presence status
        customStatus: isOnline ? 'Active on desktop' : 'Offline'
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

module.exports = {
  getMyDMs,
  hideDM,
  getMyFriends,
  addFriend,
  getActivities,
  startDM
};
