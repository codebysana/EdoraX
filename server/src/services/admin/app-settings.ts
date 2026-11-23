// Admin service: platform overview, feature flags and gateway configurations.

import { env, polarPaymentsConfigured, rateLimitsEnabled } from "../../config/env.js";
import { getRefundPolicyAdmin, type RefundPolicyView } from "./refund-policy.js";
import { getPlatformCertificateSettings } from "./certificate-settings.js";
import type { PlatformCertificateSettings } from "../../shared/lib/certificates.js";

export type FeatureFlagInfo = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "gamification" | "infra";
};

export type AppSettingsView = {
  refundPolicy: RefundPolicyView;
  certificateSettings: PlatformCertificateSettings;
  featureFlags: FeatureFlagInfo[];
  polar: {
    configured: boolean;
    environment: string;
  };
};

/** Gathers platform settings, policy, and active feature flags for the Admin App Settings Console. */
export async function getAppSettingsAdmin(): Promise<AppSettingsView> {
  const [refundPolicy, certificateSettings] = await Promise.all([getRefundPolicyAdmin(), getPlatformCertificateSettings()]);

  const featureFlags: FeatureFlagInfo[] = [
    {
      key: "GAMIFICATION_XP",
      name: "XP Ledger & Progression",
      description: "Experience points awarded for quizzes and lessons",
      enabled: env.GAMIFICATION_XP !== false,
      category: "gamification",
    },
    {
      key: "GAMIFICATION_LEADERBOARDS",
      name: "Weekly League Leaderboards",
      description: "Weekly competitive league resets and tier promotions",
      enabled: env.GAMIFICATION_LEADERBOARDS !== false,
      category: "gamification",
    },
    {
      key: "GAMIFICATION_STREAK_FREEZES",
      name: "Daily Streak Freezes",
      description: "Learners hold up to 2 streak freezes to maintain daily momentum",
      enabled: env.GAMIFICATION_STREAK_FREEZES !== false,
      category: "gamification",
    },
    {
      key: "GAMIFICATION_CAREER_LEVELS",
      name: "Career Mastery Tiers",
      description: "Verified mastery milestones that permanently promote career rank",
      enabled: env.GAMIFICATION_CAREER_LEVELS !== false,
      category: "gamification",
    },
    {
      key: "GAMIFICATION_CREDITS",
      name: "Build Credits",
      description: "Redeemable build credits ledger for project builds and lab runs",
      enabled: env.GAMIFICATION_CREDITS !== false,
      category: "gamification",
    },
    {
      key: "BACKGROUND_JOBS",
      name: "Cron Scheduled Workers",
      description: "Daily midnight resets, streak checks, and retention cleanups",
      enabled: env.JOBS_ENABLED !== false,
      category: "infra",
    },
    {
      key: "RATE_LIMITS",
      name: "API Rate Limiting",
      description: "Per-user and per-IP endpoint request throttling",
      enabled: Boolean(rateLimitsEnabled),
      category: "infra",
    },
  ];

  return {
    refundPolicy,
    certificateSettings,
    featureFlags,
    polar: {
      configured: Boolean(polarPaymentsConfigured),
      environment: env.POLAR_ENVIRONMENT,
    },
  };
}
