-- Run after schema.sql against a disposable database. ROLLBACK leaves no test books.
BEGIN;

DO $$
DECLARE
  unread_id INTEGER;
  read_id INTEGER;
  violated_constraint TEXT;
BEGIN
  INSERT INTO books (title, author)
  VALUES ('Unread example', 'Author')
  RETURNING id INTO unread_id;

  IF NOT EXISTS (
    SELECT 1 FROM books
    WHERE id = unread_id AND status = 'unread' AND memo = ''
      AND rating IS NULL AND read_year IS NULL AND read_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Unread defaults are incorrect';
  END IF;

  INSERT INTO books (title, author, status, rating, read_year, memo)
  VALUES ('Year example', 'Author', 'read', 3, 2020, 'A note')
  RETURNING id INTO read_id;

  IF NOT EXISTS (
    SELECT 1 FROM books
    WHERE id = read_id AND read_year = 2020 AND read_date IS NULL AND memo = 'A note'
  ) THEN
    RAISE EXCEPTION 'Year-only read date was not stored';
  END IF;

  INSERT INTO books (title, author, status, rating, read_date)
  VALUES ('Day example', 'Author', 'read', 5, DATE '2020-06-15');

  INSERT INTO books (title, author, status, rating)
  VALUES ('Unknown date example', 'Author', 'read', 3);

  BEGIN
    INSERT INTO books (title, author) VALUES ('　 ', 'Author');
    RAISE EXCEPTION 'Blank title was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO books (title, author) VALUES ('Title', ' ');
    RAISE EXCEPTION 'Blank author was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO books (title, author, status, rating)
    VALUES ('Unread with rating', 'Author', 'unread', 3);
    RAISE EXCEPTION 'Unread rating was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'books_unread_no_read_details' THEN
      RAISE EXCEPTION 'Unexpected constraint: %', violated_constraint;
    END IF;
  END;

  BEGIN
    INSERT INTO books (title, author, status) VALUES ('Read without rating', 'Author', 'read');
    RAISE EXCEPTION 'Missing read rating was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'books_read_rating_valid' THEN
      RAISE EXCEPTION 'Unexpected constraint: %', violated_constraint;
    END IF;
  END;

  BEGIN
    INSERT INTO books (title, author, status, rating)
    VALUES ('Invalid rating', 'Author', 'read', 6);
    RAISE EXCEPTION 'Out-of-range rating was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'books_read_rating_valid' THEN
      RAISE EXCEPTION 'Unexpected constraint: %', violated_constraint;
    END IF;
  END;

  BEGIN
    INSERT INTO books (title, author, status, rating, read_year, read_date)
    VALUES ('Two dates', 'Author', 'read', 3, 2020, DATE '2020-06-15');
    RAISE EXCEPTION 'Two read date formats were accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint <> 'books_one_read_date' THEN
      RAISE EXCEPTION 'Unexpected constraint: %', violated_constraint;
    END IF;
  END;
END
$$;

ROLLBACK;
