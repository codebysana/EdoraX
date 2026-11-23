-- Migration: add_app_settings
-- Creates a generic key-value store for platform-wide settings editable by admins.
-- The first use-case is the refund policy (key = 'refund_policy', value = JSON).

CREATE TABLE "app_settings" (
    "key"       VARCHAR(80)  NOT NULL,
    "value"     TEXT         NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
