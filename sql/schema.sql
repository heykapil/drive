CREATE TABLE public.files (
	id serial NOT NULL,
	filename text NOT NULL,
	"key" text NOT NULL,
	"size" bigint NOT NULL,
	"type" text NOT NULL,
	uploaded_at timestamp DEFAULT now(),
	is_public bool DEFAULT false,
	bucket varchar(50) DEFAULT 'cdn.kapil.app'::character varying,
	liked bool DEFAULT false NOT NULL,
	bucket_id integer,
	PRIMARY KEY (id)
);

CREATE TABLE public.folder_buckets (
	folder_id integer NOT NULL,
	bucket_id integer NOT NULL,
	PRIMARY KEY (folder_id,bucket_id)
);

CREATE TABLE public.folders (
	id serial NOT NULL,
	"name" text NOT NULL,
	parent_id integer,
	created_at timestamptz DEFAULT now(),
	PRIMARY KEY (id)
);

CREATE TABLE public.s3_buckets (
	id serial NOT NULL,
	"name" varchar(255) NOT NULL,
	region varchar(255),
	endpoint text,
	is_private bool DEFAULT true,
	provider varchar(100),
	total_capacity_gb integer,
	access_key_encrypted text,
	secret_key_encrypted text,
	updated_at timestamptz DEFAULT now(),
	storage_used_bytes bigint DEFAULT 0,
	PRIMARY KEY (id)
);

CREATE TABLE public.shared (
	"token" text NOT NULL,
	id integer NOT NULL,
	filename text NOT NULL,
	"size" bigint NOT NULL,
	"type" text NOT NULL,
	bucket_id integer NOT NULL,
	expires timestamptz,
	created_at timestamp DEFAULT now(),
	PRIMARY KEY ("token")
);

ALTER TABLE public.files
	ADD FOREIGN KEY (bucket_id)
	REFERENCES s3_buckets (id);


ALTER TABLE public.folder_buckets
	ADD FOREIGN KEY (folder_id)
	REFERENCES folders (id);

ALTER TABLE public.folder_buckets
	ADD FOREIGN KEY (bucket_id)
	REFERENCES s3_buckets (id);

ALTER TABLE public.folders
	ADD FOREIGN KEY (parent_id)
	REFERENCES folders (id);

ALTER TABLE public.shared
	ADD FOREIGN KEY (id)
	REFERENCES files (id);

ALTER TABLE public.shared
	ADD FOREIGN KEY (bucket_id)
	REFERENCES s3_buckets (id);

CREATE UNIQUE INDEX files_key_key ON public.files USING btree (key);

CREATE UNIQUE INDEX files_pkey ON public.files USING btree (id);

CREATE UNIQUE INDEX folder_buckets_pkey ON public.folder_buckets USING btree (folder_id, bucket_id);

CREATE UNIQUE INDEX folders_parent_id_name_key ON public.folders USING btree (parent_id, name);

CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id);

CREATE INDEX idx_files_fav ON public.files USING btree (liked) WHERE (liked = true);

CREATE UNIQUE INDEX s3_buckets_name_key ON public.s3_buckets USING btree (name);

CREATE UNIQUE INDEX s3_buckets_pkey ON public.s3_buckets USING btree (id);

CREATE UNIQUE INDEX shared_pkey ON public.shared USING btree (token);


-- This script corrects the sequence counters for all tables with 'serial' columns.
-- It finds the current maximum 'id' in each table and sets the sequence to that value.
-- This ensures that the next inserted row gets the correct auto-incremented ID.
-- The use of COALESCE handles cases where tables might be empty.

-- Verbose output to show which table is being updated.
-- For the 'files' table
SELECT setval(pg_get_serial_sequence('files', 'id'), COALESCE((SELECT MAX(id) FROM files), 0));

-- For the 'folders' table
SELECT setval(pg_get_serial_sequence('folders', 'id'), COALESCE((SELECT MAX(id) FROM folders), 0));

-- For the 's3_buckets' table
SELECT setval(pg_get_serial_sequence('s3_buckets', 'id'), COALESCE((SELECT MAX(id) FROM s3_buckets), 0));
