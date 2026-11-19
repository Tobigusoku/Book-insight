import pg from 'pg'
import { createApp } from './app.js'

const { Pool } = pg
const port = Number(process.env.PORT || 3001)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
pool.on('error', (error) => {
  console.error('PostgreSQL idle connection error', error)
})

try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  await pool.query('SELECT 1 FROM books LIMIT 0')

  const server = createApp(pool).listen(port, 'localhost', () => {
    console.log(`Book API listening at http://localhost:${port}`)
  })
  server.on('error', (error) => {
    console.error('Failed to start API server', error)
    pool.end().catch(console.error)
    process.exitCode = 1
  })
} catch (error) {
  console.error('Failed to start API server', error)
  await pool.end()
  process.exitCode = 1
}
