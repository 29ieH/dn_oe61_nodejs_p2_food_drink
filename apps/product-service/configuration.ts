export default () => ({
  app: {
    port: process.env.PORT || 3003,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  cache: {
    appPrefix: process.env.CACHE_APP_PREFIX,
    ttl: process.env.CACHE_TTL_DEFAULT,
  },
});
