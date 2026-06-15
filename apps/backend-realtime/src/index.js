const { startServer } = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

startServer(PORT)
  .then(() => {
    console.log('Real-time Collaboration Engine bootstrap completed successfully.');
  })
  .catch((err) => {
    console.error('Real-time Collaboration Engine bootstrap crashed:', err);
    process.exit(1);
  });
