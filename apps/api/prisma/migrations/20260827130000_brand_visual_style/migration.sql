ALTER TABLE "brand_profiles" ADD COLUMN "visual_style_description" TEXT;

CREATE TABLE "brand_reference_images" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_reference_images_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "brand_reference_images" ADD CONSTRAINT "brand_reference_images_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
