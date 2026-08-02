import Database from "../../core/config/db.js";
import logger from "../../core/logger/logger.js";
import eventBus from "../../core/events/eventBus.js";
import { EventTypes } from "../../core/events/eventTypes.js";

class RewardService {
  /**
   * Calculate and grant Cyber-Cores for solo problem solving
   */
  static async grantProblemRewards(userId, problemId) {
    try {
      // 1. Check if already rewarded to prevent double-claiming
      const existingSubmission = await Database.client.submission.findFirst({
        where: { userId, problemId, status: "PASSED" },
        orderBy: { createdAt: "asc" }
      });

      // If this isn't the FIRST time they passed this problem, don't grant rewards again
      const passCount = await Database.client.submission.count({
        where: { userId, problemId, status: "PASSED" }
      });
      if (passCount > 1) return;

      const problem = await Database.client.problem.findUnique({
        where: { id: problemId },
        select: { difficulty: true }
      });

      const difficultyMultipliers = {
        EASY: 30,
        MEDIUM: 60,
        HARD: 120
      };

      let reward = difficultyMultipliers[problem.difficulty] || 30;
      const initialReward = reward;

      // 2. Check for hints usage
      const hintsUsed = await Database.client.userHint.count({
        where: { userId, problemId }
      });

      // Deduction: 5 cores per hint (total cost of hint was 5)
      // This effectively makes hints "refundable" if you solve it? 
      // No, let's make it a penalty. 
      const hintPenalty = hintsUsed * 8; // Penalty is more than the cost to encourage no-hint solves

      reward = Math.max(5, reward - hintPenalty);

      // 3. Update user
      await Database.client.user.update({
        where: { id: userId },
        data: { cyberCores: { increment: reward } }
      });

      // 4. Notify via event (Phase 2: Event-driven)
      eventBus.emitEvent(EventTypes.REWARD_GRANTED, {
        userId,
        rewardType: 'PROBLEM',
        amount: reward,
        reason: 'Problem solved',
        metadata: { problemId, hintsUsed, perfect: hintsUsed === 0 }
      });

      logger.info(`Solo rewards granted for user ${userId} on problem ${problemId}`);
    } catch (error) {
      logger.error("Error granting problem rewards:", error);
    }
  }

  /**
   * Process daily login rewards and streaks
   */
  static async processDailyLogin(userId) {
    try {
      const user = await Database.client.user.findUnique({ where: { id: userId } });
      if (!user) return;

      const now = new Date();
      const lastLogin = new Date(user.lastLogin);

      // Check if it's a new day (UTC)
      const isSameDay = now.getUTCFullYear() === lastLogin.getUTCFullYear() &&
        now.getUTCMonth() === lastLogin.getUTCMonth() &&
        now.getUTCDate() === lastLogin.getUTCDate();

      if (isSameDay) return;

      // Check if streak is broken (more than 24h since last login window)
      const diffTime = Math.abs(now - lastLogin);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let newStreak = 1;
      if (diffDays === 1) {
        newStreak = user.dailyLoginStreak + 1;
      }

      const reward = 10 * newStreak; // 10, 20, 30...

      await Database.client.user.update({
        where: { id: userId },
        data: {
          dailyLoginStreak: newStreak,
          lastLogin: now,
          cyberCores: { increment: reward }
        }
      });

      // Notify via event (Phase 2: Event-driven)
      eventBus.emitEvent(EventTypes.REWARD_GRANTED, {
        userId,
        rewardType: 'DAILY',
        amount: reward,
        reason: 'Daily login',
        metadata: { streak: newStreak }
      });

      await this.checkAchievements(userId, "LOGIN_STREAK", newStreak);

    } catch (error) {
      logger.error("Error processing daily login:", error);
    }
  }

  /**
   * Universal achievement checker
   */
  static async checkAchievements(userId, type, currentVal) {
    try {
      // Find eligible achievements the user hasn't unlocked yet
      const achievements = await Database.client.achievement.findMany({
        where: {
          users: { none: { userId } }
        }
      });

      for (const ach of achievements) {
        const criteria = ach.criteria;
        if (criteria.type === type && currentVal >= criteria.threshold) {
          // Unlock!
          await Database.client.userAchievement.create({
            data: {
              userId,
              achievementId: ach.id
            }
          });

          // Grant reward
          if (ach.rewardType === "CORES") {
            await Database.client.user.update({
              where: { id: userId },
              data: { cyberCores: { increment: parseInt(ach.rewardValue) } }
            });
          } else if (ach.rewardType === "BADGE") {
            await Database.client.userBadge.create({
              data: {
                userId,
                badgeId: ach.rewardValue
              }
            });
          }

          // Emit achievement unlocked event (Phase 2: Event-driven)
          eventBus.emitEvent(EventTypes.ACHIEVEMENT_UNLOCKED, {
            userId,
            achievementId: ach.id,
            achievementName: ach.name,
            rewardType: ach.rewardType,
            rewardValue: ach.rewardValue
          });
        }
      }
    } catch (error) {
      logger.error("Error checking achievements:", error);
    }
  }
}

export default RewardService;
