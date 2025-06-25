import express from 'express';
import routes from './routes/index.js';

const app = express();

// Load all routes from routes/index.js
app.use('/', routes);

// Set port from environment variable or default to 5000
const port = process.env.PORT || 5000;

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
