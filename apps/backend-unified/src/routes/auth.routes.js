const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Public auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);

module.exports = router;
