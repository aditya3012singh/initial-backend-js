import { register } from './registry.js';

import {
  apiRequestsTotal,
  apiRequestDurationMs,
  apiErrorsTotal
} from './httpMetrics.js';

import {
  cacheHitsTotal,
  cacheMissesTotal,
  cacheHitRatio
} from './redisMetrics.js';

import {
  dbQueriesTotal,
  dbQueryDurationMs,
  dbTransactionsTotal,
  dbTransactionDurationMs,
  dbErrorsTotal
} from './dbMetrics.js';

import {
  submissionsTotal,
  submissionResultsTotal
} from './submissionMetrics.js';

// Export the core Prometheus registry
export { register };

export function getMetricsRegistry() {
  return register;
}

/**
 * Get all metrics as Prometheus format string
 * @returns {Promise<string>}
 */
export async function metricsToPrometheus() {
  return await register.metrics();
}

// Re-export individual metric descriptors
export {
  apiRequestsTotal,
  apiRequestDurationMs,
  apiErrorsTotal,
  cacheHitsTotal,
  cacheMissesTotal,
  cacheHitRatio,
  dbQueriesTotal,
  dbQueryDurationMs,
  dbTransactionsTotal,
  dbTransactionDurationMs,
  dbErrorsTotal,
  submissionsTotal,
  submissionResultsTotal
};

// ============================================================================
// METRIC RECORDING WRAPPER HELPERS
// ============================================================================

/**
 * Record API request
 * @param {object} options
 */
export function recordApiRequest({ method, endpoint, statusCode, duration }) {
  apiRequestsTotal.labels(method, endpoint, statusCode).inc();
  apiRequestDurationMs.labels(method, endpoint, statusCode).observe(duration);
  
  if (statusCode >= 400) {
    apiErrorsTotal.labels(endpoint, statusCode >= 500 ? 'server_error' : 'client_error', statusCode).inc();
  }
}

/**
 * Record cache operation
 * @param {object} options
 */
export function recordCacheOperation({ cacheType, hit, ratio = null }) {
  if (hit) {
    cacheHitsTotal.labels(cacheType).inc();
  } else {
    cacheMissesTotal.labels(cacheType).inc();
  }
  
  if (ratio !== null && ratio >= 0 && ratio <= 100) {
    cacheHitRatio.labels(cacheType).set(ratio);
  }
}

/**
 * Record submission
 * @param {object} options
 */
export function recordSubmission({ type, language, resultStatus }) {
  submissionsTotal.labels(type, language).inc();
  submissionResultsTotal.labels(resultStatus, language).inc();
}

/**
 * Record database query metrics
 * @param {string} queryName
 * @param {string} status - success or error
 * @param {number} duration - duration in ms
 */
export function recordDbQuery(queryName, status, duration) {
  dbQueriesTotal.labels(queryName, status).inc();
  if (duration) {
    dbQueryDurationMs.labels(queryName).observe(duration);
  }
}

/**
 * Record database transaction metrics
 * @param {string} txName
 * @param {string} status - success or error
 * @param {number} duration - duration in ms
 */
export function recordDbTransaction(txName, status, duration) {
  dbTransactionsTotal.labels(txName, status).inc();
  if (duration) {
    dbTransactionDurationMs.labels(txName).observe(duration);
  }
}

/**
 * Record database error metrics
 * @param {string} queryName
 * @param {string} errorCode
 */
export function recordDbError(queryName, errorCode) {
  dbErrorsTotal.labels(queryName, errorCode || 'unknown').inc();
}
