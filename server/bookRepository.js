// Keep DATE as calendar text instead of converting it to a timezone-dependent JavaScript Date.
const bookColumns = 'id, title, author, cover_url, memo, status, rating, read_year, read_date::text AS read_day'

function toBook(row) {
  const book = {
    id: row.id,
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url,
    memo: row.memo,
    status: row.status,
  }

  if (row.status === 'read') {
    book.rating = row.rating
    if (row.read_year !== null) {
      book.readDate = { precision: 'year', value: String(row.read_year).padStart(4, '0') }
    } else if (row.read_day !== null) {
      book.readDate = { precision: 'day', value: row.read_day }
    } else {
      book.readDate = null
    }
  }

  return book
}

function readDateColumns(book) {
  return [
    book.readDate?.precision === 'year' ? Number(book.readDate.value) : null,
    book.readDate?.precision === 'day' ? book.readDate.value : null,
  ]
}

export function createBookRepository(pool) {
  return {
    async list() {
      const result = await pool.query(`SELECT ${bookColumns} FROM books ORDER BY id`)
      return result.rows.map(toBook)
    },

    async findById(id) {
      const result = await pool.query(`SELECT ${bookColumns} FROM books WHERE id = $1`, [id])
      return result.rows[0] ? toBook(result.rows[0]) : null
    },

    async create(book) {
      const result = await pool.query(
        `INSERT INTO books (title, author, cover_url, memo, status, rating, read_year, read_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${bookColumns}`,
        [book.title, book.author, book.coverUrl, book.memo, book.status, book.rating ?? null, ...readDateColumns(book)],
      )
      return toBook(result.rows[0])
    },

    async update(id, book) {
      const result = await pool.query(
        `UPDATE books
         SET title = $2, author = $3, cover_url = $4, memo = $5, status = $6,
             rating = $7, read_year = $8, read_date = $9
         WHERE id = $1
         RETURNING ${bookColumns}`,
        [id, book.title, book.author, book.coverUrl, book.memo, book.status, book.rating ?? null, ...readDateColumns(book)],
      )
      return result.rows[0] ? toBook(result.rows[0]) : null
    },

    async remove(id) {
      const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING id', [id])
      return result.rowCount > 0
    },
  }
}
