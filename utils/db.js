import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    // Set default MongoDB connection parameters from environment variables or fallback values
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    // Create MongoDB connection URI
    const url = `mongodb://${host}:${port}/${database}`;

    // Initialize MongoClient
    this.client = new MongoClient(url, { useUnifiedTopology: true });

    // Connect to MongoDB
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch((err) => {
        console.error('MongoDB Client Error:', err);
      });
  }

  // Check if MongoDB connection is alive
  isAlive() {
    return !!this.client && this.client.isConnected();
  }

  // Get number of documents in the users collection (async)
  async nbUsers() {
    try {
      const usersCollection = this.db.collection('users');
      const count = await usersCollection.countDocuments();
      return count;
    } catch (err) {
      console.error('Error counting users:', err);
      throw err;
    }
  }

  // Get number of documents in the files collection (async)
  async nbFiles() {
    try {
      const filesCollection = this.db.collection('files');
      const count = await filesCollection.countDocuments();
      return count;
    } catch (err) {
      console.error('Error counting files:', err);
      throw err;
    }
  }
}

// Create and export an instance of DBClient
const dbClient = new DBClient();
export default dbClient;
