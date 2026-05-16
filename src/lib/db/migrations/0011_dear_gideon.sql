CREATE TABLE "rate_limit_buckets" (
	"key_hash" varchar(64) NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_buckets_key_hash_window_start_pk" PRIMARY KEY("key_hash","window_start")
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets" USING btree ("window_start");