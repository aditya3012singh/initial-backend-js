import structuredLogger from "../logger/structuredLogger.js";
import { recordDbQuery, recordDbTransaction, recordDbError } from "../metrics/index.js";

/**
 * DBWrapper
 * Centralized DB transaction and query executor.
 * Decoupled to support both PostgreSQL (Prisma) and MongoDB (Mongoose).
 */
class DBWrapper {
    /**
     * Executes a single database query with performance logging, Prometheus telemetry, and error mapping.
     */
    static async execute(queryName, queryFn) {
        const start = Date.now();
        try {
            const result = await queryFn();
            const duration = Date.now() - start;
            recordDbQuery("generic", "success", duration);
            return result;
        } catch (err) {
            const duration = Date.now() - start;
            recordDbQuery("generic", "error", duration);
            recordDbError(queryName, err.code || err.name || "unknown");
            throw this.mapError(err);
        }
    }

    /**
     * Runs a transaction block with automatic retry logic for transient write conflicts.
     */
    static async transaction(txName, txFn, maxRetries = 3) {
        let attempt = 0;
        while (attempt < maxRetries) {
            attempt++;
            const start = Date.now();
            try {
                const result = await txFn();
                const duration = Date.now() - start;
                recordDbTransaction(txName, "success", duration);
                return result;
            } catch (err) {
                const duration = Date.now() - start;
                const isRetryable = err.code === "P2034" ||
                                    err.code === 11000 ||
                                    err.name === "WriteConflict" ||
                                    (err.message && err.message.toLowerCase().includes("deadlock")) ||
                                    (err.message && err.message.toLowerCase().includes("conflict"));

                if (isRetryable && attempt < maxRetries) {
                    const backoff = attempt * 150;
                    structuredLogger.warn(`🔄 [DB Conflict] ${txName} failed (Attempt ${attempt}/${maxRetries}). Retrying in ${backoff}ms...`, {
                        txName,
                        attempt,
                        backoffMs: backoff,
                        errorCode: err.code
                    });
                    await new Promise(res => setTimeout(res, backoff));
                    continue;
                }
                
                recordDbTransaction(txName, "error", duration);
                recordDbError(txName, err.code || "unknown");
                throw this.mapError(err);
            }
        }
    }

    /**
     * Maps database engine errors (Prisma & Mongoose) to standard clean application exceptions
     */
    static mapError(err) {
        if (!err) return err;

        // 1. Unique constraint violation (Prisma P2002 / Mongo 11000)
        if (err.code === "P2002" || err.code === 11000) {
            const fields = err.meta?.target || (err.keyPattern ? Object.keys(err.keyPattern) : "unknown fields");
            const customErr = new Error(`Conflict: Unique constraint failed on fields (${fields})`);
            customErr.statusCode = 409;
            customErr.code = "UNIQUE_CONSTRAINT_VIOLATION";
            customErr.meta = err.meta;
            customErr.originalCode = err.code;
            return customErr;
        }

        // 2. Record / Document not found (Prisma P2025 / Mongo DocumentNotFoundError)
        if (err.code === "P2025" || err.name === "DocumentNotFoundError") {
            const customErr = new Error(`Not Found: Database record does not exist.`);
            customErr.statusCode = 404;
            customErr.code = "RECORD_NOT_FOUND";
            customErr.meta = err.meta;
            customErr.originalCode = err.code;
            return customErr;
        }

        // 3. Bad request / Foreign key / Validation (Prisma P2003 / Mongo ValidationError / CastError)
        if (err.code === "P2003" || err.name === "ValidationError" || err.name === "CastError") {
            const customErr = new Error(`Bad Request: Database validation or constraint violation.`);
            customErr.statusCode = 400;
            customErr.code = "CONSTRAINT_VIOLATION";
            customErr.meta = err.meta;
            customErr.originalCode = err.code;
            return customErr;
        }

        return err;
    }
}

export default DBWrapper;
