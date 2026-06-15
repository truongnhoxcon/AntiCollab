const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  // In production, IAM role/Fargate credentials are used. 
  // Locally, environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY can be provided.
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'realtime-collab-files-default';

/**
 * Generate a presigned PUT URL for uploading a file directly to S3.
 * Key format: server-{serverId}/channels/{channelId}/{uuid}-{filename}
 * 
 * @param {string} serverId
 * @param {string} channelId
 * @param {string} filename
 * @param {string} contentType
 * @returns {Promise<{ uploadUrl: string, key: string }>}
 */
async function getUploadPresignedUrl(serverId, channelId, filename, contentType) {
  const fileUuid = crypto.randomUUID();
  // Sanitize filename to avoid folder injection
  const sanitizedFilename = encodeURIComponent(filename.replace(/\s+/g, '_'));
  const key = `server-${serverId}/channels/${channelId}/${fileUuid}-${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  // URL valid for 15 minutes (900 seconds)
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    uploadUrl,
    key,
  };
}

/**
 * Generate a presigned GET URL for downloading/viewing a file from S3.
 * 
 * @param {string} key - The S3 object key
 * @returns {Promise<string>} - Presigned URL
 */
async function getDownloadPresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  // URL valid for 1 hour (3600 seconds)
  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return downloadUrl;
}

module.exports = {
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
};
