-- Add is_encrypted flag to files table
ALTER TABLE drive.public.files 
ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Create keys table for storing encryption metadata
CREATE TABLE IF NOT EXISTS drive.public.keys (
    id serial NOT NULL,
    file_id integer NOT NULL,
    algorithm text DEFAULT 'aes-256-ctr',
    key_hex text NOT NULL,
    iv_hex text NOT NULL,
    created_at timestamp DEFAULT now(),
    PRIMARY KEY (id)
);

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'keys_file_id_fkey') THEN
        ALTER TABLE drive.public.keys
        ADD CONSTRAINT keys_file_id_fkey
        FOREIGN KEY (file_id) 
        REFERENCES drive.public.files (id);
    END IF;
END $$;

-- Create unique index on file_id to ensure one key per file
CREATE UNIQUE INDEX IF NOT EXISTS keys_file_id_key ON drive.public.keys USING btree (file_id);
