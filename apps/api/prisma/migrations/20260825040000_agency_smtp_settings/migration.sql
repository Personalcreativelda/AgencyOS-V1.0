CREATE TABLE "agency_smtp_settings" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "from_name" TEXT,
    "from_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_smtp_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_smtp_settings_agency_id_key" ON "agency_smtp_settings"("agency_id");

ALTER TABLE "agency_smtp_settings" ADD CONSTRAINT "agency_smtp_settings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
