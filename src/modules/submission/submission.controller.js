import SubmissionService from "./submission.service.js";

class SubmissionController {
  /**
   * Submit and synchronously check answer for an outage/config puzzle
   */
  static async submitCode(req, res) {
    const { problemId, userAnswer } = req.validated.body;
    const userId = req.user.id;

    const result = await SubmissionService.submitAnswer({
      userId,
      problemId,
      userAnswer
    });

    res.ok(result, result.isCorrect 
      ? "Incident resolved successfully! System is healthy." 
      : "Verification failed. System remains unstable. Please review logs again."
    );
  }

  /**
   * Fetch submission details by ID
   */
  static async getSubmissionStatus(req, res) {
    const { id } = req.params;
    const result = await SubmissionService.getSubmissionById(id);

    if (!result) {
      const err = new Error("Submission record not found.");
      err.statusCode = 404;
      throw err;
    }

    res.ok(result, "Submission details fetched successfully");
  }
}

export default SubmissionController;
