const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('node:crypto');

function createObjectStorage(config) {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  const keyFor = (tenantId, originalName) => `${tenantId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${String(originalName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  return {
    async upload({ tenantId, fileName, body, contentType }) {
      const objectKey = keyFor(tenantId, fileName);
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: objectKey, Body: body, ContentType: contentType }));
      return { objectKey };
    },
    readUrl(objectKey, expiresIn = 300) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }), { expiresIn });
    },
    remove(objectKey) { return client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey })); }
  };
}

module.exports = { createObjectStorage };
