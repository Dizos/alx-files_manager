import sha1 from 'sha1';
import dbClient from '../utils/db.js';

class UsersController {
  // POST /users
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const usersCollection = dbClient.db.collection('users');

      // Check if email already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash password with SHA1
      const hashedPassword = sha1(password);

      // Create new user
      const newUser = {
        email,
        password: hashedPassword,
      };

      // Insert user into database
      const result = await usersCollection.insertOne(newUser);

      // Return user with id and email
      return res.status(201).json({
        id: result.insertedId,
        email,
      });
    } catch (err) {
      console.error('Error creating user:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default UsersController;
