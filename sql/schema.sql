CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    size BIGINT NOT NULL,
    type TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    bucket VARCHAR(50) DEFAULT 'cdn.kapil.app'
);

CREATE TABLE shared (
    token TEXT PRIMARY KEY,
    id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    size BIGINT NOT NULL,
    type TEXT NOT NULL,
    bucket VARCHAR(50) NOT NULL,
    expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
