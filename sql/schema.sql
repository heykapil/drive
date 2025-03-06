CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    size BIGINT NOT NULL,
    type TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE
);
