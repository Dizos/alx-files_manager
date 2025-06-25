import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db.js';

// Create Bull queue
const fileQueue = new Bull('fileQueue');

// Process the queue
fileQueue.process(async (job) => {
  try {
    const { fileId, userId } = job.data;

    // Validate job data
    if (!fileId) {
      throw new Error('Missing fileId');
    }
    if (!userId) {
      throw new Error('Missing userId');
    }

    // Find file in database
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Generate thumbnails for sizes 500, 250, and 100
    const sizes = [500, 250, 100];
    for (const size of sizes) {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const thumbnailPath = `${file.localPath}_${size}`;
      await fs.promises.writeFile(thumbnailPath, thumbnail);
    }
  } catch (err) {
    console.error('Error processing thumbnail job:', err.message);
    throw err;
  }
});

console.log('Worker started');
