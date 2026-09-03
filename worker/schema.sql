CREATE TABLE IF NOT EXISTS audio_downloads (
    filename TEXT PRIMARY KEY,
    downloads INTEGER NOT NULL DEFAULT 0
);
