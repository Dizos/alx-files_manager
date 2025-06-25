import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

class AppController {
  // GET /status
  static getStatus(req, res) {
    const status = {
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    };
    res.status(200).json(status);
  }

  // GET /stats
  static async getStats(req, res) {
    try {
      const stats = {
        users: await dbClient.nbUsers(),
        files: await dbClient.nbFiles(),
      };
      res.status(200).json(stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AppController;
