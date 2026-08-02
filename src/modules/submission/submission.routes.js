import express from "express";
import SubmissionController from "./submission.controller.js";
import AuthMiddleware from "./auth.middleware.js";
import asyncWrapper from "../../api/middleware/asyncWrapper.middleware.js";
import validateRequest from "../../api/middleware/validateRequest.middleware.js";
import { submitAnswerSchema } from "./submission.schema.js";

class SubmissionRoutes {
	static createRouter() {
		const router = express.Router();

		router.post("/submit", AuthMiddleware.handle, validateRequest(submitAnswerSchema), asyncWrapper(SubmissionController.submitCode));
		router.get("/:id", AuthMiddleware.handle, asyncWrapper(SubmissionController.getSubmissionStatus));

		return router;
	}
}

export default SubmissionRoutes;
