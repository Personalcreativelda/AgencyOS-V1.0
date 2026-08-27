CREATE TABLE "agency_social_settings" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "meta_app_id" TEXT,
    "meta_app_secret_encrypted" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_social_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_social_settings_agency_id_key" ON "agency_social_settings"("agency_id");

ALTER TABLE "agency_social_settings" ADD CONSTRAINT "agency_social_settings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
