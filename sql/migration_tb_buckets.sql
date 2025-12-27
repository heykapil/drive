-- Migration: Add Terabox Bucket Support
-- This migration creates the tb_buckets table and updates folder_buckets to support dual bucket types

-- Step 1: Create tb_buckets table
CREATE TABLE IF NOT EXISTS public.tb_buckets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email_encrypted TEXT,
    password_encrypted TEXT,
    cookie_encrypted TEXT,
    whost TEXT,
    account_id TEXT,
    account_name TEXT,
    is_vip BOOLEAN DEFAULT false,
    vip_type INTEGER,
    space_total_bytes BIGINT,
    space_used_bytes BIGINT DEFAULT 0,
    space_available_gb NUMERIC(10, 2),
    cookie_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Fix folder_buckets to support both S3 and Terabox buckets
-- Since bucket_id is part of the PRIMARY KEY, we need to drop it first

-- Step 2a: Drop the existing primary key constraint
ALTER TABLE public.folder_buckets 
    DROP CONSTRAINT IF EXISTS folder_buckets_pkey;

-- Step 2b: Now make bucket_id nullable
ALTER TABLE public.folder_buckets 
    ALTER COLUMN bucket_id DROP NOT NULL;

-- Step 2c: Add unique constraints to ensure data integrity
-- For S3 buckets: folder_id + bucket_id must be unique
CREATE UNIQUE INDEX IF NOT EXISTS folder_buckets_s3_unique 
    ON public.folder_buckets (folder_id, bucket_id) 
    WHERE bucket_id IS NOT NULL;

-- For Terabox buckets: folder_id + tb_bucket_id must be unique  
CREATE UNIQUE INDEX IF NOT EXISTS folder_buckets_tb_unique 
    ON public.folder_buckets (folder_id, tb_bucket_id) 
    WHERE tb_bucket_id IS NOT NULL;

-- Step 3: Add CHECK constraint to ensure at least one bucket type is present
ALTER TABLE public.folder_buckets
    ADD CONSTRAINT folder_buckets_require_one_bucket 
    CHECK (bucket_id IS NOT NULL OR tb_bucket_id IS NOT NULL);

-- Step 4: Update foreign key for tb_bucket_id in folder_buckets (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'folder_buckets_tb_bucket_id_fkey'
    ) THEN
        ALTER TABLE public.folder_buckets
            ADD CONSTRAINT folder_buckets_tb_bucket_id_fkey
            FOREIGN KEY (tb_bucket_id) REFERENCES tb_buckets(id);
    END IF;
END $$;

-- Step 5: Update foreign keys for files table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'files_tb_bucket_id_fkey'
    ) THEN
        ALTER TABLE public.files
            ADD CONSTRAINT files_tb_bucket_id_fkey
            FOREIGN KEY (tb_bucket_id) REFERENCES tb_buckets(id);
    END IF;
END $$;

-- Step 6: Add CHECK constraint to files table (one bucket type per file)
ALTER TABLE public.files
    ADD CONSTRAINT files_one_bucket_type 
    CHECK (
        (bucket_id IS NOT NULL AND tb_bucket_id IS NULL) OR 
        (bucket_id IS NULL AND tb_bucket_id IS NOT NULL)
    );

-- Step 6b: Add share_id column for Terabox files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'share_id'
    ) THEN
        ALTER TABLE public.files ADD COLUMN share_id TEXT;
        COMMENT ON COLUMN public.files.share_id IS 'Terabox share_id for file operations (TB buckets only)';
    END IF;
END $$;

-- Step 7: Update foreign keys for shared table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'shared_tb_bucket_id_fkey'
    ) THEN
        ALTER TABLE public.shared
            ADD CONSTRAINT shared_tb_bucket_id_fkey
            FOREIGN KEY (tb_bucket_id) REFERENCES tb_buckets(id);
    END IF;
END $$;

-- Step 8: Update foreign keys for upload_jobs table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_jobs') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'upload_jobs_tb_bucket_id_fkey'
        ) THEN
            ALTER TABLE public.upload_jobs
                ADD CONSTRAINT upload_jobs_tb_bucket_id_fkey
                FOREIGN KEY (tb_bucket_id) REFERENCES tb_buckets(id);
        END IF;
    END IF;
END $$;

-- Step 9: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tb_buckets_account_id ON public.tb_buckets(account_id);
CREATE INDEX IF NOT EXISTS idx_folder_buckets_tb_bucket_id ON public.folder_buckets(tb_bucket_id);
CREATE INDEX IF NOT EXISTS idx_files_tb_bucket_id ON public.files(tb_bucket_id);

-- Step 10: Add comment for documentation
COMMENT ON TABLE public.tb_buckets IS 'Terabox bucket storage configuration with encrypted credentials';
COMMENT ON CONSTRAINT folder_buckets_require_one_bucket ON public.folder_buckets IS 'Ensures each folder has at least one bucket (S3 or Terabox)';
COMMENT ON CONSTRAINT files_one_bucket_type ON public.files IS 'Ensures each file exists in exactly one bucket type';
