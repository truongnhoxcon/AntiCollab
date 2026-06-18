const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect all user routes with JWT authentication middleware
router.use(authMiddleware);

router.get('/me/dms', userController.getMyDMs);
router.post('/me/dms', userController.startDM);
router.delete('/me/dms/:dmUserId', userController.hideDM);
router.get('/me/friends', userController.getMyFriends);
router.post('/me/friends', userController.addFriend);
router.get('/me/activities', userController.getActivities);

module.exports = router;
