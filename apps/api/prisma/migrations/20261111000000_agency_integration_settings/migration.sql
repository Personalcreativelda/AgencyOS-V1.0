-- Per-agency WhatsApp (Evolution API) server and TikTok Ads app, configured in the dashboard.
-- IF NOT EXISTS: the API also creates these on first use (deploys don't run migrations).
ALTER TABLE "agency_social_settings"
  ADD COLUMN IF NOT EXISTS "evolution_api_url" TEXT,
  ADD COLUMN IF NOT EXISTS "evolution_api_key_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok_ads_app_id" TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok_ads_app_secret_encrypted" TEXT;
