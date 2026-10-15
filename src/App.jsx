import { useState } from 'react'
import './App.css'

function App() {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [books, setBooks] = useState([])

  const addBook = () => {
    const bookTitle = title.trim()
    const bookMemo = memo.trim()

    if (!bookTitle) return

    const newBook = {
      id: Date.now(),
      title: bookTitle,
      memo: bookMemo,
    }

    setBooks([...books, newBook])
    setTitle('')
    setMemo('')
  }

  return (
    <main className="app">
      <h1>Book Insight</h1>

      <div className="book-form">
        <label htmlFor="book-title">本のタイトル</label>
        <input
          id="book-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="book-memo">感想・メモ</label>
        <textarea
          id="book-memo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
        <button type="button" onClick={addBook} disabled={!title.trim()}>
          追加
        </button>
      </div>

      <section className="book-list">
        <h2>登録した本</h2>
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              <h3>{book.title}</h3>
              {book.memo && <p>{book.memo}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
