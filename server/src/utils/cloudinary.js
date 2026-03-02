const cloudinary = require('cloudinary').v2;

const configured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

const initCloudinary = () => {
  if (!configured()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
};

const uploadBuffer = (buffer, options = {}) => {
  if (!initCloudinary()) {
    const err = new Error('Cloudinary not configured');
    err.code = 'CLOUDINARY_NOT_CONFIGURED';
    throw err;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || 'cyber',
        resource_type: options.resource_type || 'auto',
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

module.exports = { uploadBuffer, initCloudinary, configured };

