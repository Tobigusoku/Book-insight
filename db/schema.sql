CREATE TABLE books (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  memo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unread',
  rating SMALLINT,
  read_year INTEGER,
  read_date DATE,

  CONSTRAINT books_title_not_blank CHECK (btrim(title, E' \t\n\r' || chr(12288)) <> ''),
  CONSTRAINT books_author_not_blank CHECK (btrim(author, E' \t\n\r' || chr(12288)) <> ''),
  CONSTRAINT books_status_valid CHECK (status IN ('unread', 'read')),
  CONSTRAINT books_read_year_valid CHECK (read_year BETWEEN 1 AND 9999),
  CONSTRAINT books_read_date_valid CHECK (read_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  CONSTRAINT books_unread_no_read_details CHECK (
    status <> 'unread' OR (rating IS NULL AND read_year IS NULL AND read_date IS NULL)
  ),
  CONSTRAINT books_read_rating_valid CHECK (
    status <> 'read' OR (rating IS NOT NULL AND rating BETWEEN 1 AND 5)
  ),
  CONSTRAINT books_one_read_date CHECK (read_year IS NULL OR read_date IS NULL)
);
