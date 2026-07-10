const express = require('express');
const router = express.Router();
const friendsController = require('../controllers/friends.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect all friends routes with JWT authentication
router.use(authMiddleware);

router.get('/', friendsController.getFriends);
router.get('/pending', friendsController.getPendingFriends);
router.post('/request', friendsController.sendFriendRequest);
router.put('/accept/:id', friendsController.acceptFriendRequest);
router.delete('/reject/:id', friendsController.rejectFriendRequest);

module.exports = router;
