/** Shape of the app's configuration, read once at boot. */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  database: {
    url: process.env.DATABASE_URL,
    logging: process.env.DATABASE_LOGGING === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  cloudinary: {
    /**
     * The whole credential in one string, as the Cloudinary console hands it
     * out: cloudinary://<key>:<secret>@<cloud_name>. Preferred over the three
     * separate values, which can be copied from two different environments
     * and then fail with nothing but "cloud_name mismatch" to go on.
     */
    url: process.env.CLOUDINARY_URL,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    /** Root folder in the account, so one account can hold several apps. */
    folder: process.env.CLOUDINARY_FOLDER ?? 'rentflow',
  },
});
