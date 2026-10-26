import { useEffect, useRef, useState } from 'react'
import './App.css'

const storageKey = 'book-insight-books'
const dcNamespace = 'http://purl.org/dc/elements/1.1/'
const xsiNamespace = 'http://www.w3.org/2001/XMLSchema-instance'

function BookCover({ book }) {
  const [failed, setFailed] = useState(false)

  if (!book.coverUrl || failed) {
    return <div className="cover-placeholder" aria-hidden="true" />
  }

  return (
    <img
      src={book.coverUrl}
      alt={`${book.title}の書影`}
      onError={() => setFailed(true)}
    />
  )
}

function BookInfoForm({ book, onSave, onCancel }) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author || '')

  const saveBookInfo = (event) => {
    event.preventDefault()
    const bookTitle = title.trim()
    const bookAuthor = author.trim()
    if (!bookTitle || !bookAuthor) return

    onSave(book.id, { title: bookTitle, author: bookAuthor })
  }

  return (
    <form className="book-edit-form" aria-label={`${book.title}のタイトルと著者を編集`} onSubmit={saveBookInfo}>
      <label>
        本のタイトル
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>
      <label>
        著者
        <input type="text" value={author} onChange={(event) => setAuthor(event.target.value)} required />
      </label>
      <div className="book-edit-actions">
        <button type="submit" disabled={!title.trim() || !author.trim()}>保存</button>
        <button type="button" onClick={onCancel}>キャンセル</button>
      </div>
    </form>
  )
}

function ReadBookForm({ book, onSave, onCancel, isNew = false, canSave = true }) {
  const today = new Date()
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [rating, setRating] = useState(String(book.rating || 3))
  const [datePrecision, setDatePrecision] = useState(
    book.status === 'read' ? book.readDate?.precision || 'unknown' : 'day',
  )
  const [readDay, setReadDay] = useState(
    book.readDate?.precision === 'day' ? book.readDate.value : localToday,
  )
  const [readYear, setReadYear] = useState(
    book.readDate?.precision === 'year' ? book.readDate.value : String(today.getFullYear()),
  )
  const [memo, setMemo] = useState(book.memo || '')

  const saveReadBook = (event) => {
    event.preventDefault()
    if (datePrecision === 'day' && !readDay) return
    if (datePrecision === 'year' && !/^\d{4}$/.test(readYear)) return

    const readDate = datePrecision === 'day'
      ? { precision: 'day', value: readDay }
      : datePrecision === 'year'
        ? { precision: 'year', value: readYear }
        : null

    onSave(book.id, { rating: Number(rating), readDate, memo: memo.trim() })
  }

  return (
    <form className="book-edit-form" aria-label={isNew ? '新しい本の読了記録' : `${book.title}の読了記録${book.status === 'read' ? 'を編集' : ''}`} onSubmit={saveReadBook}>
      <label>
        評価
        <select value={rating} onChange={(event) => setRating(event.target.value)}>
          {[1, 2, 3, 4, 5].map((score) => (
            <option key={score} value={score}>{score}</option>
          ))}
        </select>
      </label>
      <label>
        読了時期
        <select value={datePrecision} onChange={(event) => setDatePrecision(event.target.value)}>
          <option value="day">年月日</option>
          <option value="year">年のみ</option>
          <option value="unknown">不明</option>
        </select>
      </label>
      {datePrecision === 'day' && (
        <label>
          読了日
          <input type="date" value={readDay} onChange={(event) => setReadDay(event.target.value)} required />
        </label>
      )}
      {datePrecision === 'year' && (
        <label>
          読了年
          <input type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={readYear} onChange={(event) => setReadYear(event.target.value)} required />
        </label>
      )}
      <label>
        感想・メモ（任意）
        <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
      </label>
      <div className="book-edit-actions">
        <button type="submit" disabled={!canSave}>{isNew ? '追加' : '保存'}</button>
        <button type="button" onClick={onCancel}>キャンセル</button>
      </div>
    </form>
  )
}

function App() {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [registrationStatus, setRegistrationStatus] = useState('unread')
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
  const [readingBookId, setReadingBookId] = useState(null)
  const [editingInfoBookId, setEditingInfoBookId] = useState(null)
  const [books, setBooks] = useState(() => {
    try {
      const savedBooks = localStorage.getItem(storageKey)
      const parsedBooks = savedBooks ? JSON.parse(savedBooks) : []
      return Array.isArray(parsedBooks) ? parsedBooks : []
    } catch {
      return []
    }
  })
  const nextBookId = useRef(books.length === 0 ? 0 : books[books.length - 1].id)
  const latestSearch = useRef(0)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(books))
  }, [books])

  const updateTitle = (event) => {
    setTitle(event.target.value)
    latestSearch.current += 1
    setSearchResults([])
    setSearchStatus('idle')
  }

  const searchBooks = async () => {
    const query = title.trim()
    if (!query) return

    const searchId = ++latestSearch.current
    const url = new URL('https://ndlsearch.ndl.go.jp/api/opensearch')
    url.searchParams.set('title', query)
    url.searchParams.set('cnt', '200')
    url.searchParams.set('dpid', 'iss-ndl-opac')
    url.searchParams.set('mediatype', 'books')

    setSearchResults([])
    setSearchStatus('loading')

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Book search failed')

      const xml = new DOMParser().parseFromString(await response.text(), 'application/xml')
      if (xml.querySelector('parsererror, error')) throw new Error('Invalid search response')
      if (searchId !== latestSearch.current) return

      const titleMatchRank = (book) => {
        if (book.title === query) return 0
        if (book.title.startsWith(query)) return 1
        return 2
      }

      const results = Array.from(xml.getElementsByTagName('item'), (item) => {
        const isbnElement = Array.from(item.getElementsByTagNameNS(dcNamespace, 'identifier'))
          .find((element) => element.getAttributeNS(xsiNamespace, 'type') === 'dcndl:ISBN')
        const isbn = isbnElement?.textContent.trim().replaceAll('-', '')

        return {
          key: item.getElementsByTagName('guid')[0]?.textContent.trim(),
          title: item.getElementsByTagName('title')[0]?.textContent.trim(),
          author: item.getElementsByTagNameNS(dcNamespace, 'creator')[0]?.textContent.trim(),
          coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-S.jpg?default=false` : null,
        }
      })
        .filter((book) => book.key && book.title?.includes(query))
        .sort((a, b) => titleMatchRank(a) - titleMatchRank(b))
        .slice(0, 5)
      setSearchResults(results)
      setSearchStatus(results.length > 0 ? 'success' : 'empty')
    } catch {
      if (searchId === latestSearch.current) setSearchStatus('error')
    }
  }

  const selectBook = (book) => {
    setTitle(book.title)
    setAuthor(book.author || '')
    setSearchResults([])
    setSearchStatus('idle')
  }

  const addBook = (readDetails) => {
    const bookTitle = title.trim()
    const bookAuthor = author.trim()

    if (!bookTitle || !bookAuthor) return

    nextBookId.current += 1
    const newBook = {
      id: nextBookId.current,
      title: bookTitle,
      author: bookAuthor,
      ...(readDetails || {}),
      status: readDetails ? 'read' : 'unread',
    }

    setBooks([...books, newBook])
    setTitle('')
    setAuthor('')
    setRegistrationStatus('unread')
    latestSearch.current += 1
    setSearchResults([])
    setSearchStatus('idle')
  }

  const deleteBook = (id) => {
    setBooks(books.filter((book) => book.id !== id))
  }

  const completeBook = (id, details) => {
    setBooks(books.map((book) => book.id === id
      ? { ...book, ...details, status: 'read' }
      : book))
    setReadingBookId(null)
  }

  const updateBookInfo = (id, info) => {
    setBooks(books.map((book) => book.id === id ? { ...book, ...info } : book))
    setEditingInfoBookId(null)
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
          onChange={updateTitle}
        />
        <label htmlFor="book-author">著者</label>
        <input
          id="book-author"
          type="text"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <span>登録時の状態</span>
        <div className="registration-status" role="group" aria-label="登録時の状態">
          <button type="button" aria-pressed={registrationStatus === 'unread'} onClick={() => setRegistrationStatus('unread')}>
            積読
          </button>
          <button type="button" aria-pressed={registrationStatus === 'read'} onClick={() => setRegistrationStatus('read')}>
            読了
          </button>
        </div>
        <div className="book-form-actions">
          <button type="button" onClick={searchBooks} disabled={!title.trim() || searchStatus === 'loading'}>
            検索
          </button>
          {registrationStatus === 'unread' && (
            <button type="button" onClick={() => addBook()} disabled={!title.trim() || !author.trim()}>
              追加
            </button>
          )}
        </div>
        {registrationStatus === 'read' && (
          <ReadBookForm
            book={{ title, status: 'unread' }}
            onSave={(_id, details) => addBook(details)}
            onCancel={() => setRegistrationStatus('unread')}
            isNew
            canSave={Boolean(title.trim() && author.trim())}
          />
        )}
      </div>

      {searchStatus !== 'idle' && (
        <section className="search-results" aria-label="検索結果">
          <h2>検索結果</h2>
          {searchStatus === 'loading' && <p role="status">検索中...</p>}
          {searchStatus === 'empty' && <p role="status">候補が見つかりませんでした</p>}
          {searchStatus === 'error' && <p role="alert">検索できませんでした。もう一度お試しください</p>}
          {searchStatus === 'success' && (
            <ul>
              {searchResults.map((book) => (
                <li key={book.key}>
                  <BookCover book={book} />
                  <div>
                    <h3>{book.title}</h3>
                    {book.author && <p>{book.author}</p>}
                  </div>
                  <button type="button" onClick={() => selectBook(book)} aria-label={`${book.title}を選択`}>
                    選択
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="book-list">
        <h2>登録した本</h2>
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              {editingInfoBookId === book.id ? (
                <BookInfoForm book={book} onSave={updateBookInfo} onCancel={() => setEditingInfoBookId(null)} />
              ) : (
                <>
                  <h3>{book.author ? `${book.title} / ${book.author}` : book.title}</h3>
                  <button type="button" onClick={() => {
                    setReadingBookId(null)
                    setEditingInfoBookId(book.id)
                  }}>
                    タイトル・著者を編集
                  </button>
                </>
              )}
              {book.status === 'read' ? (
                <>
                  <p>読了 · {book.rating}/5</p>
                  <p>{book.readDate ? (book.readDate.precision === 'year' ? `${book.readDate.value}年` : book.readDate.value) : '読了時期不明'}</p>
                </>
              ) : (
                <p>積読</p>
              )}
              {book.memo && readingBookId !== book.id && <p>{book.memo}</p>}
              {readingBookId === book.id ? (
                <ReadBookForm book={book} onSave={completeBook} onCancel={() => setReadingBookId(null)} />
              ) : (
                <button type="button" onClick={() => {
                  setEditingInfoBookId(null)
                  setReadingBookId(book.id)
                }}>
                  {book.status === 'read' ? '読了記録を編集' : '読了にする'}
                </button>
              )}
              <button type="button" onClick={() => deleteBook(book.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
