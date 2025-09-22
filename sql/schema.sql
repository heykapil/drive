CREATE TABLE files (
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
CREATE TABLE folder_buckets (
	folder_id integer NOT NULL,
	bucket_id integer NOT NULL,
	PRIMARY KEY (folder_id,bucket_id)
);
CREATE TABLE folders (
	id serial NOT NULL,
	"name" text NOT NULL,
	parent_id integer,
	created_at timestamptz DEFAULT now(),
	PRIMARY KEY (id)
);
CREATE TABLE s3_buckets (
	id serial NOT NULL,
	"name" varchar(255) NOT NULL,
	PRIMARY KEY (id)
);
CREATE TABLE shared (
	"token" text NOT NULL,
	id integer NOT NULL,
	filename text NOT NULL,
	"size" bigint NOT NULL,
	"type" text NOT NULL,
	bucket varchar(50) NOT NULL,
	expires timestamptz,
	created_at timestamp DEFAULT now(),
	PRIMARY KEY ("token")
);
