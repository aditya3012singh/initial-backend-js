import Database from "../../core/config/db.js";
import ProblemService from "../problem/problem.service.js";
import structuredLogger from "../../core/logger/structuredLogger.js";
import { recordSubmission } from "../../core/metrics/index.js";
import SubmissionRepository from "./submission.repository.js";

/**
 * SubmissionService - Domain Logic Layer
 * Manages the synchronous validation of log-troubleshooting and configuration incidents.
 */
class SubmissionService {

  /**
   * Submit and synchronously check answer
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.problemId
   * @param {string} params.userAnswer
   */
  static async submitAnswer({ userId, problemId, userAnswer }) {
    // 1. Fetch correct answer from cache/database
    const correctAnswer = await ProblemService.getProblemAnswer(problemId);
    
    if (correctAnswer === null) {
      const err = new Error("Incident problem not found or has no answer defined.");
      err.statusCode = 404;
      throw err;
    }

    // 2. Check correctness (normalize whitespace and case for resiliency)
    const isCorrect = (userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase());
    const status = isCorrect ? "PASSED" : "FAILED";

    // 3. Persist submission record
    const submission = await Database.client.submission.create({
      data: {
        userId,
        problemId,
        code: userAnswer,
        status
      }
    });

    // 4. Record Prometheus telemetry
    recordSubmission({
      type: "SUBMIT",
      language: "text",
      resultStatus: status
    });

    // 5. If correct, award XP points and increment stats
    if (isCorrect) {
      await Database.client.user.update({
        where: { id: userId },
        data: {
          rankPoints: { increment: 100 },
          wins: { increment: 1 }
        }
      }).catch(err => {
        structuredLogger.error("Failed to update user score points", {
          userId,
          error: err.message
        });
      });
    }

    return {
      submissionId: submission.id,
      status,
      isCorrect,
      points: isCorrect ? 100 : 0
    };
  }

  /**
   * Fetch submission by ID with details
   */
  static async getSubmissionById(submissionId) {
    const submission = await SubmissionRepository.findSubmissionByIdWithProblem(submissionId);
    if (!submission) return null;
    return submission;
  }
}

export default SubmissionService;
