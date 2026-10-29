import express from 'express'

export function createApp() {
  const app = express()
  const books = []
  let nextBookId = 1

  app.use(express.json({ strict: false }))

  app.post('/api/books', (req, res) => {
    const { title, author } = req.body ?? {}

    if (typeof title !== 'string' || !title.trim() || typeof author !== 'string' || !author.trim()) {
      return res.status(400).json({ error: 'Title and author must be non-empty strings' })
    }

    const book = {
      id: nextBookId,
      title: title.trim(),
      author: author.trim(),
      status: 'unread',
    }
    nextBookId += 1
    books.push(book)

    return res.status(201).json(book)
  })

  app.use((error, _req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON' })
    }
    return next(error)
  })

  return app
}
