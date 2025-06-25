import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';

class FilesController {
  static async postUpload(req, res) {
    try {
      // Authenticate user
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get request body parameters
      const { name, type, parentId = '0', isPublic = false, data } = req.body;

      // Validate name
      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      // Validate type
      const validTypes = ['folder', 'file', 'image'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      // Validate data for non-folder types
      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      const filesCollection = dbClient.db.collection('files');

      // Validate parentId if provided
      if (parentId !== '0') {
        const parentFile = await filesCollection.findOne({ _id: new ObjectId(parentId) });
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      // Prepare file document
      const fileDoc = {
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId === '0' ? '0' : new ObjectId(parentId),
      };

      // Handle folder creation
      if (type === 'folder') {
        const result = await filesCollection.insertOne(fileDoc);
        return res.status(201).json({
          id: result.insertedId,
          userId: fileDoc.userId,
          name: fileDoc.name,
          type: fileDoc.type,
          isPublic: fileDoc.isPublic,
          parentId: fileDoc.parentId,
        });
      }

      // Handle file/image creation
      // Determine storage folder
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      // Create folder if it doesn't exist
      await fs.promises.mkdir(folderPath, { recursive: true });

      // Generate UUID for filename
      const fileUuid = uuidv4();
      const localPath = path.join(folderPath, fileUuid);

      // Decode Base64 data and write to disk
      const fileData = Buffer.from(data, 'base64');
      await fs.promises.writeFile(localPath, fileData);

      // Add localPath to file document
      fileDoc.localPath = localPath;

      // Insert file document into database
      const result = await filesCollection.insertOne(fileDoc);

      // Return new file document
      return res.status(201).json({
        id: result.insertedId,
        userId: fileDoc.userId,
        name: fileDoc.name,
        type: fileDoc.type,
        isPublic: fileDoc.isPublic,
        parentId: fileDoc.parentId,
      });
    } catch (err) {
      console.error('Error uploading file:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(req, res) {
    try {
      // Authenticate user
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get file by ID
      const fileId = req.params.id;
      const filesCollection = dbClient.db.collection('files');
      const file = await filesCollection.findOne({
        _id: new ObjectId(fileId),
        userId: new ObjectId(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Return file document
      return res.status(200).json({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    } catch (err) {
      console.error('Error retrieving file:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    try {
      // Authenticate user
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get query parameters
      const parentId = req.query.parentId || '0';
      const page = parseInt(req.query.page, 10) || 0;
      const pageSize = 20;

      const filesCollection = dbClient.db.collection('files');

      // Build aggregation pipeline
      const pipeline = [
        {
          $match: {
            userId: new ObjectId(userId),
            parentId: parentId === '0' ? '0' : new ObjectId(parentId),
          },
        },
        {
          $skip: page * pageSize,
        },
        {
          $limit: pageSize,
        },
      ];

      // Execute aggregation
      const files = await filesCollection.aggregate(pipeline).toArray();

      // Format response
      const formattedFiles = files.map((file) => ({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      }));

      return res.status(200).json(formattedFiles);
    } catch (err) {
      console.error('Error retrieving files:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(req, res) {
    try {
      // Authenticate user
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get file by ID
      const fileId = req.params.id;
      const filesCollection = dbClient.db.collection('files');
      const file = await filesCollection.findOne({
        _id: new ObjectId(fileId),
        userId: new ObjectId(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Update isPublic to true
      await filesCollection.updateOne(
        { _id: new ObjectId(fileId) },
        { $set: { isPublic: true } }
      );

      // Fetch updated file
      const updatedFile = await filesCollection.findOne({ _id: new ObjectId(fileId) });

      // Return updated file document
      return res.status(200).json({
        id: updatedFile._id,
        userId: updatedFile.userId,
        name: updatedFile.name,
        type: updatedFile.type,
        isPublic: updatedFile.isPublic,
        parentId: updatedFile.parentId,
      });
    } catch (err) {
      console.error('Error publishing file:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(req, res) {
    try {
      // Authenticate user
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get file by ID
      const fileId = req.params.id;
      const filesCollection = dbClient.db.collection('files');
      const file = await filesCollection.findOne({
        _id: new ObjectId(fileId),
        userId: new ObjectId(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Update isPublic to false
      await filesCollection.updateOne(
        { _id: new ObjectId(fileId) },
        { $set: { isPublic: false } }
      );

      // Fetch updated file
      const updatedFile = await filesCollection.findOne({ _id: new ObjectId(fileId) });

      // Return updated file document
      return res.status(200).json({
        id: updatedFile._id,
        userId: updatedFile.userId,
        name: updatedFile.name,
        type: updatedFile.type,
        isPublic: updatedFile.isPublic,
        parentId: updatedFile.parentId,
      });
    } catch (err) {
      console.error('Error unpublishing file:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getFile(req, res) {
    try {
      const fileId = req.params.id;
      const filesCollection = dbClient.db.collection('files');

      // Find file by ID
      const file = await filesCollection.findOne({ _id: new ObjectId(fileId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if file is public or user is authenticated and owns the file
      const token = req.header('X-Token');
      let userId = null;
      if (token) {
        userId = await redisClient.get(`auth_${token}`);
      }
      if (!file.isPublic && (!userId || userId !== file.userId.toString())) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if file is a folder
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      // Check if file exists locally
      if (!file.localPath || !fs.existsSync(file.localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Get MIME-type
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';

      // Read and return file content
      const fileContent = await fs.promises.readFile(file.localPath);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(fileContent);
    } catch (err) {
      console.error('Error retrieving file content:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
