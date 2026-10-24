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

function App() {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
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

  const addBook = () => {
    const bookTitle = title.trim()
    const bookAuthor = author.trim()

    if (!bookTitle || !bookAuthor) return

    nextBookId.current += 1
    const newBook = {
      id: nextBookId.current,
      title: bookTitle,
      author: bookAuthor,
    }

    setBooks([...books, newBook])
    setTitle('')
    setAuthor('')
    latestSearch.current += 1
    setSearchResults([])
    setSearchStatus('idle')
  }

  const deleteBook = (id) => {
    setBooks(books.filter((book) => book.id !== id))
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
        <div className="book-form-actions">
          <button type="button" onClick={searchBooks} disabled={!title.trim() || searchStatus === 'loading'}>
            検索
          </button>
          <button type="button" onClick={addBook} disabled={!title.trim() || !author.trim()}>
            追加
          </button>
        </div>
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
              <h3>{book.author ? `${book.title} / ${book.author}` : book.title}</h3>
              {book.memo && <p>{book.memo}</p>}
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
