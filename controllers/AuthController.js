import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';

class AuthController {
  // GET /connect
  static async getConnect(req, res) {
    try {
      // Get Authorization header
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Decode Base64 credentials
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [email, password] = credentials.split(':');

      if (!email || !password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Find user in MongoDB
      const usersCollection = dbClient.db.collection('users');
      const hashedPassword = sha1(password);
      const user = await usersCollection.findOne({ email, password: hashedPassword });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Generate token and store in Redis
      const token = uuidv4();
      const key = `auth_${token}`;
      await redisClient.set(key, user._id.toString(), 24 * 60 * 60); // 24 hours

      // Return token
      return res.status(200).json({ token });
    } catch (err) {
      console.error('Error during sign-in:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // GET /disconnect
  static async getDisconnect(req, res) {
    try {
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if token exists in Redis
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Delete token from Redis
      await redisClient.del(`auth_${token}`);

      // Return 204 No Content
      return res.status(204).send();
    } catch (err) {
      console.error('Error during sign-out:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AuthController;
