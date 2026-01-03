CREATE TABLE drive.public.files (
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
	tb_bucket_id integer,
	share_id text,
	thumbnail text,
	duration integer,
	PRIMARY KEY (id)
);

CREATE TABLE drive.public.folder_buckets (
	folder_id integer NOT NULL,
	bucket_id integer,
	tb_bucket_id integer
);

CREATE TABLE drive.public.folders (
	id serial NOT NULL,
	"name" text NOT NULL,
	parent_id integer,
	created_at timestamptz DEFAULT now(),
	PRIMARY KEY (id)
);

CREATE TABLE drive.public.s3_buckets (
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

CREATE TABLE drive.public.shared (
	"token" text NOT NULL,
	id integer NOT NULL,
	filename text NOT NULL,
	"size" bigint NOT NULL,
	"type" text NOT NULL,
	bucket_id integer NOT NULL,
	expires timestamptz,
	created_at timestamp DEFAULT now(),
	tb_bucket_id integer,
	PRIMARY KEY ("token")
);

CREATE TABLE drive.public.tb_account_info (
	id integer NOT NULL,
	account_id text,
	account_name text,
	"name" varchar(50),
	is_vip bool DEFAULT false,
	vip_type integer DEFAULT 0,
	space_used_bytes bigint,
	space_total_bytes bigint,
	space_available_gb numeric(10,2),
	created_at timestamp DEFAULT now(),
	updated_at timestamp DEFAULT now(),
	PRIMARY KEY (id)
);

CREATE TABLE drive.public.tb_auth_sessions (
	id serial NOT NULL,
	email text NOT NULL,
	email_encrypted text NOT NULL,
	password_encrypted text NOT NULL,
	cookie_encrypted text NOT NULL,
	whost text NOT NULL,
	cookie_expires_at timestamp NOT NULL,
	created_at timestamp DEFAULT now(),
	updated_at timestamp DEFAULT now(),
	user_agent_encrypted text,
	PRIMARY KEY (id)
);

create sequence tb_buckets_id_seq;
CREATE TABLE drive.public.tb_buckets_backup (
	id integer DEFAULT nextval('tb_buckets_id_seq'::regclass) NOT NULL,
	email_encrypted text NOT NULL,
	password_encrypted text NOT NULL,
	cookie_encrypted text NOT NULL,
	whost text NOT NULL,
	account_id text,
	account_name text,
	is_vip bool DEFAULT false,
	vip_type integer DEFAULT 0,
	space_used_bytes bigint,
	space_total_bytes bigint,
	space_available_gb numeric(10,2),
	created_at timestamp DEFAULT now(),
	updated_at timestamp DEFAULT now(),
	cookie_expires_at timestamp NOT NULL,
	email text,
	"name" varchar(50),
	PRIMARY KEY (id)
);

CREATE TABLE drive.public.upload_jobs (
	id text NOT NULL,
	status text DEFAULT 'pending'::text NOT NULL,
	total_urls integer DEFAULT 0 NOT NULL,
	completed integer DEFAULT 0 NOT NULL,
	failed integer DEFAULT 0 NOT NULL,
	bucket_id integer,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	tb_bucket_id integer,
	PRIMARY KEY (id)
);

ALTER TABLE drive.public.files
	ADD FOREIGN KEY (bucket_id) 
	REFERENCES s3_buckets (id);

ALTER TABLE drive.public.files
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);

ALTER TABLE drive.public.files
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);

ALTER TABLE drive.public.files
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);



ALTER TABLE drive.public.folder_buckets
	ADD FOREIGN KEY (bucket_id) 
	REFERENCES s3_buckets (id);

ALTER TABLE drive.public.folder_buckets
	ADD FOREIGN KEY (folder_id) 
	REFERENCES folders (id);

ALTER TABLE drive.public.folder_buckets
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);

ALTER TABLE drive.public.folder_buckets
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);



ALTER TABLE drive.public.folders
	ADD FOREIGN KEY (parent_id) 
	REFERENCES folders (id);



ALTER TABLE drive.public.shared
	ADD FOREIGN KEY (bucket_id) 
	REFERENCES s3_buckets (id);

ALTER TABLE drive.public.shared
	ADD FOREIGN KEY (id) 
	REFERENCES files (id);

ALTER TABLE drive.public.shared
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);

ALTER TABLE drive.public.shared
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);



ALTER TABLE drive.public.tb_account_info
	ADD FOREIGN KEY (id) 
	REFERENCES tb_auth_sessions (id);



ALTER TABLE drive.public.upload_jobs
	ADD FOREIGN KEY (bucket_id) 
	REFERENCES s3_buckets (id);

ALTER TABLE drive.public.upload_jobs
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);

ALTER TABLE drive.public.upload_jobs
	ADD FOREIGN KEY (tb_bucket_id) 
	REFERENCES tb_buckets_backup (id);



CREATE VIEW drive.public.tb_buckets (id,email,email_encrypted,password_encrypted,cookie_encrypted,whost,cookie_expires_at,account_id,account_name,"name",is_vip,vip_type,space_used_bytes,space_total_bytes,space_available_gb,created_at,updated_at) AS  SELECT tb_buckets_view.id,
    tb_buckets_view.email,
    tb_buckets_view.email_encrypted,
    tb_buckets_view.password_encrypted,
    tb_buckets_view.cookie_encrypted,
    tb_buckets_view.whost,
    tb_buckets_view.cookie_expires_at,
    tb_buckets_view.account_id,
    tb_buckets_view.account_name,
    tb_buckets_view.name,
    tb_buckets_view.is_vip,
    tb_buckets_view.vip_type,
    tb_buckets_view.space_used_bytes,
    tb_buckets_view.space_total_bytes,
    tb_buckets_view.space_available_gb,
    tb_buckets_view.created_at,
    tb_buckets_view.updated_at
   FROM tb_buckets_view;

CREATE VIEW drive.public.tb_buckets_view (id,email,email_encrypted,password_encrypted,cookie_encrypted,whost,cookie_expires_at,account_id,account_name,"name",is_vip,vip_type,space_used_bytes,space_total_bytes,space_available_gb,created_at,updated_at) AS  SELECT s.id,
    s.email,
    s.email_encrypted,
    s.password_encrypted,
    s.cookie_encrypted,
    s.whost,
    s.cookie_expires_at,
    a.account_id,
    a.account_name,
    a.name,
    a.is_vip,
    a.vip_type,
    a.space_used_bytes,
    a.space_total_bytes,
    a.space_available_gb,
    s.created_at,
    GREATEST(s.updated_at, a.updated_at) AS updated_at
   FROM (tb_auth_sessions s
     LEFT JOIN tb_account_info a ON ((s.id = a.id)));

CREATE UNIQUE INDEX files_key_key ON public.files USING btree (key);

CREATE UNIQUE INDEX files_pkey ON public.files USING btree (id);

CREATE UNIQUE INDEX folder_buckets_s3_unique ON public.folder_buckets USING btree (folder_id, bucket_id) WHERE (bucket_id IS NOT NULL);

CREATE UNIQUE INDEX folder_buckets_tb_unique ON public.folder_buckets USING btree (folder_id, tb_bucket_id) WHERE (tb_bucket_id IS NOT NULL);

CREATE UNIQUE INDEX folders_parent_id_name_key ON public.folders USING btree (parent_id, name);

CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id);

CREATE INDEX idx_account_space ON public.tb_account_info USING btree (space_available_gb);

CREATE INDEX idx_auth_email ON public.tb_auth_sessions USING btree (email);

CREATE INDEX idx_auth_expires ON public.tb_auth_sessions USING btree (cookie_expires_at);

CREATE INDEX idx_files_fav ON public.files USING btree (liked) WHERE (liked = true);

CREATE INDEX idx_files_share_id ON public.files USING btree (share_id) WHERE (share_id IS NOT NULL);

CREATE INDEX idx_files_tb_bucket ON public.files USING btree (tb_bucket_id) WHERE (tb_bucket_id IS NOT NULL);

CREATE INDEX idx_files_tb_bucket_id ON public.files USING btree (tb_bucket_id);

CREATE INDEX idx_folder_buckets_tb_bucket_id ON public.folder_buckets USING btree (tb_bucket_id);

CREATE INDEX idx_tb_buckets_account_id ON public.tb_buckets_backup USING btree (account_id);

CREATE INDEX idx_tb_buckets_cookie_expires ON public.tb_buckets_backup USING btree (cookie_expires_at);

CREATE UNIQUE INDEX idx_tb_buckets_email ON public.tb_buckets_backup USING btree (email);

CREATE INDEX idx_upload_jobs_created_at ON public.upload_jobs USING btree (created_at DESC);

CREATE UNIQUE INDEX s3_buckets_name_key ON public.s3_buckets USING btree (name);

CREATE UNIQUE INDEX s3_buckets_pkey ON public.s3_buckets USING btree (id);

CREATE UNIQUE INDEX shared_pkey ON public.shared USING btree (token);

CREATE UNIQUE INDEX tb_account_info_pkey ON public.tb_account_info USING btree (id);

CREATE UNIQUE INDEX tb_auth_sessions_email_key ON public.tb_auth_sessions USING btree (email);

CREATE UNIQUE INDEX tb_auth_sessions_pkey ON public.tb_auth_sessions USING btree (id);

CREATE UNIQUE INDEX tb_buckets_pkey ON public.tb_buckets_backup USING btree (id);

CREATE UNIQUE INDEX upload_jobs_pkey ON public.upload_jobs USING btree (id);

