import { createApp } from './app.js'

const port = Number(process.env.PORT || 3001)

createApp().listen(port, 'localhost', (error) => {
  if (error) {
    console.error('Failed to start API server', error)
    process.exitCode = 1
    return
  }

  console.log(`Book API listening at http://localhost:${port}`)
})
