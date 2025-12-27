-- Migration: Add Table Partitioning to Files Table
-- This migration converts the files table to use LIST partitioning based on bucket type

-- IMPORTANT: This is a complex migration that requires careful execution
-- It's recommended to test this on a staging environment first

-- ============================================
-- APPROACH: Partition by Bucket Type (S3 vs TB)
-- ============================================
-- Instead of partitioning by individual bucket_id (which would require
-- creating a partition for each bucket), we partition by bucket TYPE.
-- This gives us only 2 partitions and maintains good performance.

-- Step 1: Create the new partitioned table structure
CREATE TABLE IF NOT EXISTS public.files_partitioned (
    id SERIAL,
    filename TEXT NOT NULL,
    key TEXT NOT NULL,
    size BIGINT NOT NULL,
    type TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    is_public BOOLEAN DEFAULT false,
    bucket VARCHAR(50) DEFAULT 'cdn.kapil.app'::CHARACTER VARYING,
    liked BOOLEAN DEFAULT false NOT NULL,
    bucket_id INTEGER,
    tb_bucket_id INTEGER,
    share_id TEXT,
    bucket_type TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN bucket_id IS NOT NULL THEN 'S3'
            WHEN tb_bucket_id IS NOT NULL THEN 'TB'
            ELSE NULL
        END
    ) STORED,
    PRIMARY KEY (id, bucket_type)
) PARTITION BY LIST (bucket_type);

-- Step 2: Create partitions for each bucket type
CREATE TABLE IF NOT EXISTS public.files_s3 PARTITION OF public.files_partitioned
    FOR VALUES IN ('S3');

CREATE TABLE IF NOT EXISTS public.files_tb PARTITION OF public.files_partitioned
    FOR VALUES IN ('TB');

-- Step 3: Create a default partition for any edge cases
CREATE TABLE IF NOT EXISTS public.files_default PARTITION OF public.files_partitioned
    DEFAULT;

-- Step 4: Migrate existing data from old table to partitioned table
-- IMPORTANT: This assumes your current table is named 'files'
-- You may want to do this in batches for large tables

-- First, add the bucket_type to the old table temporarily
ALTER TABLE public.files 
    ADD COLUMN IF NOT EXISTS bucket_type TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN bucket_id IS NOT NULL THEN 'S3'
            WHEN tb_bucket_id IS NOT NULL THEN 'TB'
            ELSE NULL
        END
    ) STORED;

-- Insert data into partitioned table
-- For small to medium datasets:
INSERT INTO public.files_partitioned (
    id, filename, key, size, type, uploaded_at, is_public, 
    bucket, liked, bucket_id, tb_bucket_id, share_id
)
SELECT 
    id, filename, key, size, type, uploaded_at, is_public,
    bucket, liked, bucket_id, tb_bucket_id, share_id
FROM public.files
ON CONFLICT DO NOTHING;

-- For large datasets (millions of rows), use this batch approach instead:
-- DO $$
-- DECLARE
--     batch_size INT := 10000;
--     max_id INT;
--     current_id INT := 0;
-- BEGIN
--     SELECT MAX(id) INTO max_id FROM public.files;
--     
--     WHILE current_id < max_id LOOP
--         INSERT INTO public.files_partitioned (
--             id, filename, key, size, type, uploaded_at, is_public, 
--             bucket, liked, bucket_id, tb_bucket_id, share_id
--         )
--         SELECT 
--             id, filename, key, size, type, uploaded_at, is_public,
--             bucket, liked, bucket_id, tb_bucket_id, share_id
--         FROM public.files
--         WHERE id > current_id AND id <= current_id + batch_size
--         ON CONFLICT DO NOTHING;
--         
--         current_id := current_id + batch_size;
--         RAISE NOTICE 'Migrated up to ID: %', current_id;
--     END LOOP;
-- END $$;

-- Step 5: Recreate indexes on partitioned table
CREATE UNIQUE INDEX IF NOT EXISTS files_partitioned_key_key 
    ON public.files_partitioned (key);

CREATE INDEX IF NOT EXISTS files_partitioned_bucket_id_idx 
    ON public.files_partitioned (bucket_id) 
    WHERE bucket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS files_partitioned_tb_bucket_id_idx 
    ON public.files_partitioned (tb_bucket_id) 
    WHERE tb_bucket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS files_partitioned_uploaded_at_idx 
    ON public.files_partitioned (uploaded_at);

CREATE INDEX IF NOT EXISTS files_partitioned_liked_idx 
    ON public.files_partitioned (liked) 
    WHERE liked = true;

-- Step 6: Recreate foreign key constraints
ALTER TABLE public.files_partitioned
    ADD CONSTRAINT files_partitioned_bucket_id_fkey
    FOREIGN KEY (bucket_id) REFERENCES s3_buckets(id);

ALTER TABLE public.files_partitioned
    ADD CONSTRAINT files_partitioned_tb_bucket_id_fkey
    FOREIGN KEY (tb_bucket_id) REFERENCES tb_buckets(id);

-- Step 7: Update sequence to continue from current max ID
SELECT setval(
    pg_get_serial_sequence('files_partitioned', 'id'),
    (SELECT MAX(id) FROM public.files_partitioned)
);

-- ============================================
-- CUTOVER STEPS (Execute these carefully!)
-- ============================================

-- Step 8: Rename tables to swap old and new
-- IMPORTANT: This will cause brief downtime. Execute during maintenance window.

-- Step 8a: Rename old table as backup
-- ALTER TABLE public.files RENAME TO files_old_backup;

-- Step 8b: Rename partitioned table to primary name
-- ALTER TABLE public.files_partitioned RENAME TO files;

-- Step 8c: Update the shared table foreign key
-- ALTER TABLE public.shared DROP CONSTRAINT IF EXISTS shared_id_fkey;
-- ALTER TABLE public.shared 
--     ADD CONSTRAINT shared_id_fkey 
--     FOREIGN KEY (id) REFERENCES files(id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify partition counts
-- SELECT 
--     schemaname,
--     tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE tablename LIKE 'files%'
-- ORDER BY tablename;

-- Verify data distribution
-- SELECT 
--     'files_s3' as partition,
--     COUNT(*) as row_count
-- FROM public.files_s3
-- UNION ALL
-- SELECT 
--     'files_tb' as partition,
--     COUNT(*) as row_count
-- FROM public.files_tb
-- UNION ALL
-- SELECT 
--     'files_default' as partition,
--     COUNT(*) as row_count  
-- FROM public.files_default;

-- ============================================
-- ROLLBACK PLAN (if needed)
-- ============================================

-- If something goes wrong, rollback with:
-- DROP TABLE IF EXISTS public.files CASCADE;
-- ALTER TABLE public.files_old_backup RENAME TO files;
-- -- Then recreate the shared table foreign key


-- ============================================
-- ALTERNATIVE: Partition by Individual Bucket
-- ============================================
-- If you need to partition by actual bucket_id for extreme scale,
-- you would need dynamic partition management. Here's a template:

-- CREATE OR REPLACE FUNCTION create_partition_for_bucket()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     partition_name TEXT;
--     bucket_val TEXT;
-- BEGIN
--     IF NEW.bucket_id IS NOT NULL THEN
--         partition_name := 'files_s3_bucket_' || NEW.bucket_id;
--         bucket_val := 'S3_' || NEW.bucket_id;
--     ELSIF NEW.tb_bucket_id IS NOT NULL THEN
--         partition_name := 'files_tb_bucket_' || NEW.tb_bucket_id;
--         bucket_val := 'TB_' || NEW.tb_bucket_id;
--     ELSE
--         RETURN NEW;
--     END IF;
--     
--     -- Check if partition exists, create if not
--     IF NOT EXISTS (
--         SELECT 1 FROM pg_class WHERE relname = partition_name
--     ) THEN
--         EXECUTE format(
--             'CREATE TABLE IF NOT EXISTS %I PARTITION OF files_partitioned FOR VALUES IN (%L)',
--             partition_name, bucket_val
--         );
--     END IF;
--     
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Note: The above approach creates complexity and is only recommended
-- for systems with millions of files and hundreds of buckets.
