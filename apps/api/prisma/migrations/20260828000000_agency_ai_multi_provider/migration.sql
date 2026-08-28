DROP INDEX "agency_ai_settings_agency_id_key";

CREATE UNIQUE INDEX "agency_ai_settings_agency_id_provider_key" ON "agency_ai_settings"("agency_id", "provider");

ALTER TABLE "agencies" ADD COLUMN "ai_text_provider" TEXT;
ALTER TABLE "agencies" ADD COLUMN "ai_image_provider" TEXT;
