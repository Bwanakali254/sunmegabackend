/**
 * REDIS CLIENT CONFIGURATION
 * 
 * Optional Redis connection for caching and coordination.
 * If REDIS_URL is not set, Redis operations will gracefully fail.
 */

const logger = require('../utils/logger')

let redisClient = null

/**
 * Initialize Redis client (optional)
 * @returns {Promise<RedisClient|null>}
 */
async function connectRedis() {
  if (!process.env.REDIS_URL) {
    logger.warn('⚠️  Redis not configured (REDIS_URL not set). Caching disabled.')
    return null
  }
  
  try {
    // Lazy load redis client (only if REDIS_URL is set)
    const { createClient } = require('redis')
    
    redisClient = createClient({
      url: process.env.REDIS_URL
    })
    
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err)
    })
    
    redisClient.on('connect', () => {
      logger.info('✅ Redis Client Connected')
    })
    
    await redisClient.connect()
    
    return redisClient
  } catch (error) {
    logger.error('❌ Redis connection failed:', error.message)
    logger.warn('⚠️  Continuing without Redis. Caching disabled.')
    return null
  }
}

/**
 * Get Redis client (returns null if not connected)
 * @returns {RedisClient|null}
 */
function getRedisClient() {
  return redisClient
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit()
      logger.info('Redis connection closed')
    } catch (error) {
      logger.error('Error closing Redis connection:', error)
    }
    redisClient = null
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis
}
