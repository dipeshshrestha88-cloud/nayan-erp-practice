const path = require('node:path');

function required(name, value) {
  if (!value) throw new Error(`${name} is required when NODE_ENV=production`);
  return value;
}

function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const config = {
    production,
    port: Number(env.PORT || 3000),
    appOrigin: env.APP_ORIGIN || 'http://localhost:3000',
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL === 'true',
    sessionSecret: env.SESSION_SECRET,
    localDataFile: path.resolve(env.LOCAL_DATA_FILE || path.join(__dirname, '..', 'data', 'nirmaan-db.json')),
    storage: {
      endpoint: env.OBJECT_STORAGE_ENDPOINT,
      region: env.OBJECT_STORAGE_REGION || 'ap-south-1',
      bucket: env.OBJECT_STORAGE_BUCKET,
      accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true'
    }
  };
  if (production) {
    required('DATABASE_URL', config.databaseUrl);
    required('SESSION_SECRET', config.sessionSecret);
    if (config.sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
    if (!/^https:\/\//.test(config.appOrigin)) throw new Error('APP_ORIGIN must use HTTPS in production');
    for (const [name, value] of Object.entries(config.storage)) {
      if (name !== 'forcePathStyle') required(`OBJECT_STORAGE_${name.replace(/[A-Z]/g, m => `_${m}`).toUpperCase()}`, value);
    }
  }
  return Object.freeze(config);
}

module.exports = { readConfig };
