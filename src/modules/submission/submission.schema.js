import { z } from "zod";

export const submitAnswerSchema = z.object({
  body: z.object({
    problemId: z.string().uuid("Invalid problemId format"),
    userAnswer: z.string().min(1, "Answer cannot be empty")
  })
});
