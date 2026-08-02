import Database from "../../core/config/db.js";

/**
 * SubmissionRepository - Data Access Layer
 * Contains only Prisma queries and transaction helpers
 * No business logic, event publishing, or queue operations
 */
class SubmissionRepository {
  /**
   * Create a new submission record
   */
  static async createSubmission(data, tx = null) {
    const client = tx || Database.client;
    return await client.submission.create({
      data
    });
  }

  /**
   * Find submission by ID
   */
  static async findSubmissionById(submissionId, tx = null) {
    const client = tx || Database.client;
    return await client.submission.findUnique({
      where: { id: submissionId }
    });
  }

  /**
   * Find submission by ID with problem details
   */
  static async findSubmissionByIdWithProblem(submissionId, tx = null) {
    const client = tx || Database.client;
    return await client.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: {
          select: { id: true }
        }
      }
    });
  }

  /**
   * Find submission with problem, testcases, and user (used by worker)
   */
  static async findSubmissionWithProblemAndUser(submissionId, tx = null) {
    const client = tx || Database.client;
    return await client.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: { include: { testcases: true } },
        user: { select: { id: true } },
        squidGame: { select: { id: true } },
        contest: { select: { id: true } }
      }
    });
  }

  /**
   * Update submission status and related fields
   */
  static async updateSubmissionStatus(submissionId, data, tx = null) {
    const client = tx || Database.client;
    return await client.submission.update({
      where: { id: submissionId },
      data
    });
  }

  /**
   * Find all successful submissions for percentile calculation
   */
  static async findSuccessfulSubmissionsForProblem(problemId, language, tx = null) {
    const client = tx || Database.client;
    return await client.submission.findMany({
      where: {
        problemId,
        language,
        status: "PASSED"
      },
      select: { executionTimeMs: true }
    });
  }

  /**
   * Execute within a transaction
   */
  static async executeInTransaction(callback) {
    return await Database.client.$transaction(callback);
  }
}

export default SubmissionRepository;