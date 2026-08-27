CREATE TABLE "agency_whatsapp_settings" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "instance_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "connected_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_whatsapp_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_whatsapp_settings_agency_id_key" ON "agency_whatsapp_settings"("agency_id");

ALTER TABLE "agency_whatsapp_settings" ADD CONSTRAINT "agency_whatsapp_settings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
