import healthCheckService from './healthCheck.js';

/**
 * Get health status of the application
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export const getHealth = async (req, res, next) => {
  try {
    const health = await healthCheckService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed health status with service checks
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export const getDetailedHealth = async (req, res, next) => {
  try {
    const health = await healthCheckService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
};
