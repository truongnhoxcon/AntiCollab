const db = require('../config/db');

// GET /api/friends
async function getFriends(req, res) {
  try {
    const userId = req.user.id;
    // Get all friends where status is accepted
    const result = await db.query(
      `SELECT u.id, u.username, u.email, f.status as friend_status
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'accepted'`,
      [userId]
    );
    
    // Format response to match the expected format
    const friends = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      friendStatus: 'accepted',
      status: 'offline', // simulated status, will be filtered dynamically on frontend by globalOnlineUserIds
      customStatus: 'Offline'
    }));

    return res.status(200).json({ success: true, friends });
  } catch (error) {
    console.error('Error in getFriends:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/friends/pending
async function getPendingFriends(req, res) {
  try {
    const userId = req.user.id;
    // Get all friends where status is pending_sent or pending_received
    const result = await db.query(
      `SELECT u.id, u.username, u.email, f.status as friend_status
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status IN ('pending_sent', 'pending_received')`,
      [userId]
    );
    
    // Map status to Request Type for frontend
    const pending = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      type: row.friend_status === 'pending_sent' ? 'outgoing' : 'incoming'
    }));

    return res.status(200).json({ success: true, pending });
  } catch (error) {
    console.error('Error in getPendingFriends:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/friends/request
async function sendFriendRequest(req, res) {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Find user by username (case-insensitive)
    const targetUserRes = await db.query(
      'SELECT id, username FROM users WHERE LOWER(username) = $1',
      [username.trim().toLowerCase()]
    );

    if (targetUserRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found. Check spelling and try again.' });
    }

    const targetUser = targetUserRes.rows[0];

    if (targetUser.id === userId) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    // Check if they are already friends or have a pending request
    const existingRelation = await db.query(
      'SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2',
      [userId, targetUser.id]
    );

    if (existingRelation.rowCount > 0) {
      const rel = existingRelation.rows[0].status;
      if (rel === 'accepted') {
        return res.status(400).json({ error: 'You are already friends with this user' });
      } else if (rel === 'pending_sent') {
        return res.status(400).json({ error: 'You have already sent a friend request to this user' });
      } else if (rel === 'pending_received') {
        return res.status(400).json({ error: 'This user has already sent you a friend request. Accept it in the Pending tab!' });
      }
    }

    // Insert relationship
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending_sent')`,
      [userId, targetUser.id]
    );
    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending_received')`,
      [targetUser.id, userId]
    );

    return res.status(200).json({ success: true, message: 'Friend request sent!' });
  } catch (error) {
    console.error('Error in sendFriendRequest:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/friends/accept/:id
async function acceptFriendRequest(req, res) {
  try {
    const userId = req.user.id;
    const friendId = req.params.id; // other user's ID

    // Check if pending relationship exists
    const relation = await db.query(
      `SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2`,
      [userId, friendId]
    );

    if (relation.rowCount === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (relation.rows[0].status !== 'pending_received') {
      return res.status(400).json({ error: 'No incoming friend request to accept' });
    }

    // Update status to accepted for both rows
    await db.query(
      `UPDATE friends SET status = 'accepted' WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId]
    );

    // Create mutual DM conversation automatically
    await db.query(
      `INSERT INTO user_dms (user_id, dm_user_id, active) 
       VALUES ($1, $2, TRUE)
       ON CONFLICT (user_id, dm_user_id) DO UPDATE SET active = TRUE`,
      [userId, friendId]
    );
    await db.query(
      `INSERT INTO user_dms (user_id, dm_user_id, active) 
       VALUES ($1, $2, TRUE)
       ON CONFLICT (user_id, dm_user_id) DO UPDATE SET active = TRUE`,
      [friendId, userId]
    );

    return res.status(200).json({ success: true, message: 'Friend request accepted!' });
  } catch (error) {
    console.error('Error in acceptFriendRequest:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/friends/reject/:id
async function rejectFriendRequest(req, res) {
  try {
    const userId = req.user.id;
    const friendId = req.params.id; // other user's ID

    // Delete relation from both sides (reject incoming, cancel outgoing, or unfriend)
    const result = await db.query(
      `DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Friendship or request not found' });
    }

    return res.status(200).json({ success: true, message: 'Request rejected/canceled or friend removed' });
  } catch (error) {
    console.error('Error in rejectFriendRequest:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getFriends,
  getPendingFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest
};
