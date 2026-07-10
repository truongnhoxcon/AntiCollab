const s3Service = require('../services/s3.service');

/**
 * Controller to handle S3 presigned URL generation.
 * Route: POST /api/files/presign
 * Body: 
 *   For upload: { "action": "upload", "channelId": "...", "filename": "...", "contentType": "..." }
 *   For download: { "action": "download", "key": "server-{serverId}/channels/{channelId}/..." }
 */
async function generatePresignedUrl(req, res) {
  try {
    const { action } = req.body;

    if (!action || !['upload', 'download'].includes(action)) {
      return res.status(400).json({ error: 'Valid action ("upload" or "download") is required' });
    }

    if (action === 'upload') {
      const { channelId, filename, contentType } = req.body;
      const serverId = req.serverId; // Populated by tenant middleware

      if (!channelId || !filename || !contentType) {
        return res.status(400).json({ error: 'channelId, filename, and contentType are required for upload' });
      }

      const { uploadUrl, key } = await s3Service.getUploadPresignedUrl(
        serverId,
        channelId,
        filename,
        contentType
      );

      return res.status(200).json({
        action: 'upload',
        uploadUrl,
        key,
      });
    }

    if (action === 'download') {
      const { key } = req.body;

      if (!key) {
        return res.status(400).json({ error: 'S3 key is required for download' });
      }

      const downloadUrl = await s3Service.getDownloadPresignedUrl(key);

      return res.status(200).json({
        action: 'download',
        downloadUrl,
      });
    }
  } catch (error) {
    console.error('Error in file controller:', error);
    return res.status(500).json({ error: 'Failed to generate presigned S3 URL' });
  }
}

module.exports = {
  generatePresignedUrl,
};
