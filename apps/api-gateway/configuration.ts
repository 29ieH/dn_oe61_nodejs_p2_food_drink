export default () => ({
  app: {
    baseUrl: process.env.APP_BASE_URL,
    port: process.env.PORT || 3000,
  },
  cookie: {
    accessTokenTTL: process.env.COOKIE_ACCESSTOKEN_TTL,
    httpOnly: process.env.COOKIE_HTTPONLY,
    secure: process.env.COOKIE_SECURE,
    sameSite: process.env.COOKIE_SAMESITE,
  },
  facebook: {
    appID: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
  },
  google: {
    appID: process.env.GOOGLE_CLIENT_ID,
    appSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  twitter: {
    appID: process.env.TWITTER_CLIENT_ID,
    appSecret: process.env.TWITTER_CLIENT_SECRET,
    callbackUrl: process.env.TWITTER_CALLBACK_URL,
  },
  session: {
    secret: process.env.SESSION_SECRET,
  },
  uploadImage: {
    maxSizeMB: process.env.UPLOAD_IMAGE_MAX_SIZE_MB,
  },
});
