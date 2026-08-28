CREATE TABLE "ad_insights_daily" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaign_external_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "cpc" DOUBLE PRECISION NOT NULL,
    "results" INTEGER,
    "cost_per_result" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_insights_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_insights_daily_connection_id_campaign_external_id_date_key" ON "ad_insights_daily"("connection_id", "campaign_external_id", "date");

CREATE TABLE "ad_recommendations" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "campaign_external_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_params" TEXT,
    "reasoning" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "applied_at" TIMESTAMP(3),
    "applied_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_recommendations_pkey" PRIMARY KEY ("id")
);
