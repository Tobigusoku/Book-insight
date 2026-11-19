import express from 'express'
import { createBookRepository } from './bookRepository.js'

function isValidCoverUrl(value) {
  if (value === null) return true
  if (typeof value !== 'string') return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isValidReadDate(value) {
  if (value === null) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value.precision === 'year') {
    return typeof value.value === 'string' && /^\d{4}$/.test(value.value) && Number(value.value) > 0
  }
  if (value.precision !== 'day' || typeof value.value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.value)) {
    return false
  }
  if (value.value.startsWith('0000-')) return false

  // Date normalizes impossible days, so compare the parsed value with the original.
  const date = new Date(`${value.value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value.value
}

export function createApp(pool) {
  const app = express()
  const books = createBookRepository(pool)

  app.use(express.json({ strict: false }))

  app.get('/api/books', async (_req, res) => {
    return res.json(await books.list())
  })

  app.post('/api/books', async (req, res) => {
    const input = req.body ?? {}
    const { title, author, status = 'unread', coverUrl = null, memo = '' } = input

    if (typeof title !== 'string' || !title.trim() || typeof author !== 'string' || !author.trim()) {
      return res.status(400).json({ error: 'Title and author must be non-empty strings' })
    }
    if (status !== 'unread' && status !== 'read') {
      return res.status(400).json({ error: 'Status must be unread or read' })
    }
    if (!isValidCoverUrl(coverUrl)) {
      return res.status(400).json({ error: 'Cover URL must be an HTTP(S) URL or null' })
    }
    if (typeof memo !== 'string') {
      return res.status(400).json({ error: 'Memo must be a string' })
    }

    let readDetails = {}
    if (status === 'unread') {
      if (['rating', 'readDate'].some((field) => Object.hasOwn(input, field))) {
        return res.status(400).json({ error: 'Unread books cannot have read details' })
      }
    } else {
      const { rating = 3, readDate = null } = input
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' })
      }
      if (!isValidReadDate(readDate)) {
        return res.status(400).json({ error: 'Read date must be a valid day, year, or null' })
      }
      readDetails = {
        rating,
        readDate: readDate === null ? null : { precision: readDate.precision, value: readDate.value },
      }
    }

    const inputBook = {
      title: title.trim(),
      author: author.trim(),
      coverUrl: coverUrl === null ? null : coverUrl.trim(),
      memo: memo.trim(),
      ...readDetails,
      status,
    }
    return res.status(201).json(await books.create(inputBook))
  })

  app.patch('/api/books/:id', async (req, res) => {
    const idText = req.params.id
    const id = Number(idText)
    if (!/^[1-9]\d*$/.test(idText) || !Number.isSafeInteger(id) || id > 2147483647) {
      return res.status(400).json({ error: 'Book ID must be a positive integer' })
    }
    const current = await books.findById(id)
    if (!current) {
      return res.status(404).json({ error: 'Book not found' })
    }

    const input = req.body
    const allowedFields = ['title', 'author', 'coverUrl', 'status', 'rating', 'readDate', 'memo']
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length === 0
      || Object.keys(input).some((field) => !allowedFields.includes(field))) {
      return res.status(400).json({ error: 'Update must contain supported fields' })
    }

    const status = Object.hasOwn(input, 'status') ? input.status : current.status
    if (status !== 'unread' && status !== 'read') {
      return res.status(400).json({ error: 'Status must be unread or read' })
    }
    if (current.status === 'read' && status === 'unread') {
      return res.status(400).json({ error: 'Read books cannot return to unread' })
    }
    if (status === 'unread' && ['rating', 'readDate'].some((field) => Object.hasOwn(input, field))) {
      return res.status(400).json({ error: 'Unread books cannot have read details' })
    }

    const candidate = { ...current, ...input }
    if (current.status === 'unread' && status === 'read') {
      candidate.rating = Object.hasOwn(input, 'rating') ? input.rating : 3
      candidate.readDate = Object.hasOwn(input, 'readDate') ? input.readDate : null
    }
    if (typeof candidate.title !== 'string' || !candidate.title.trim()
      || typeof candidate.author !== 'string' || !candidate.author.trim()) {
      return res.status(400).json({ error: 'Title and author must be non-empty strings' })
    }
    if (!isValidCoverUrl(candidate.coverUrl)) {
      return res.status(400).json({ error: 'Cover URL must be an HTTP(S) URL or null' })
    }
    if (typeof candidate.memo !== 'string') {
      return res.status(400).json({ error: 'Memo must be a string' })
    }
    if (status === 'read') {
      if (!Number.isInteger(candidate.rating) || candidate.rating < 1 || candidate.rating > 5) {
        return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' })
      }
      if (!isValidReadDate(candidate.readDate)) {
        return res.status(400).json({ error: 'Read date must be a valid day, year, or null' })
      }
    }

    const updatedBook = {
      id,
      title: candidate.title.trim(),
      author: candidate.author.trim(),
      coverUrl: candidate.coverUrl === null ? null : candidate.coverUrl.trim(),
      memo: candidate.memo.trim(),
      ...(status === 'read' ? {
        rating: candidate.rating,
        readDate: candidate.readDate === null ? null : {
          precision: candidate.readDate.precision,
          value: candidate.readDate.value,
        },
      } : {}),
      status,
    }
    const savedBook = await books.update(id, updatedBook)
    if (!savedBook) {
      return res.status(404).json({ error: 'Book not found' })
    }
    return res.json(savedBook)
  })

  app.delete('/api/books/:id', async (req, res) => {
    const idText = req.params.id
    const id = Number(idText)
    if (!/^[1-9]\d*$/.test(idText) || !Number.isSafeInteger(id) || id > 2147483647) {
      return res.status(400).json({ error: 'Book ID must be a positive integer' })
    }

    if (!await books.remove(id)) {
      return res.status(404).json({ error: 'Book not found' })
    }

    return res.status(204).send()
  })

  app.use((error, _req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON' })
    }
    if (res.headersSent) return next(error)
    console.error('Book API request failed', error)
    return res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
