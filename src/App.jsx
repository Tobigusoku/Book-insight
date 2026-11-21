import { useEffect, useRef, useState } from 'react'
import { createBook, getBooks, removeBook, updateBook } from './bookApi'
import './App.css'

const dcNamespace = 'http://purl.org/dc/elements/1.1/'
const xsiNamespace = 'http://www.w3.org/2001/XMLSchema-instance'

function formatNdlAuthor(author) {
  if (!author) return ''

  const name = author.replace(/,\s*\d{4}-(?:\d{4})?\s*$/, '').trim()
  const parts = name.split(',').map((part) => part.trim())
  return parts.length === 2 && parts.every(Boolean) ? parts.join(' ') : name
}

function BookCover({ book }) {
  const [failed, setFailed] = useState(false)

  if (!book.coverUrl || failed) {
    return <span className="cover-placeholder">書影なし</span>
  }

  return (
    <img
      src={book.coverUrl}
      alt={`${book.title}の書影`}
      onError={() => setFailed(true)}
    />
  )
}

function BookInfoForm({ book, onSave, onCancel, canSave = true }) {
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
        <button type="submit" disabled={!canSave || !title.trim() || !author.trim()}>保存</button>
        <button type="button" onClick={onCancel} disabled={!canSave}>キャンセル</button>
      </div>
    </form>
  )
}

function MemoForm({ book, onSave, onCancel, canSave = true }) {
  const [memo, setMemo] = useState(book.memo || '')

  const saveMemo = (event) => {
    event.preventDefault()
    onSave(book.id, { memo: memo.trim() })
  }

  return (
    <form className="book-edit-form" aria-label={`${book.title}のメモを編集`} onSubmit={saveMemo}>
      <label>
        メモ（任意）
        <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
      </label>
      <div className="book-edit-actions">
        <button type="submit" disabled={!canSave}>保存</button>
        <button type="button" onClick={onCancel} disabled={!canSave}>キャンセル</button>
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
        <button type="button" onClick={onCancel} disabled={!canSave}>キャンセル</button>
      </div>
    </form>
  )
}

function App() {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [selectedCoverUrl, setSelectedCoverUrl] = useState(null)
  const [registrationStatus, setRegistrationStatus] = useState('unread')
  const [unreadMemo, setUnreadMemo] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
  const [expandedBookId, setExpandedBookId] = useState(null)
  const [readingBookId, setReadingBookId] = useState(null)
  const [editingInfoBookId, setEditingInfoBookId] = useState(null)
  const [editingMemoBookId, setEditingMemoBookId] = useState(null)
  const [books, setBooks] = useState([])
  const [bookFilter, setBookFilter] = useState('read')
  const [bookStatus, setBookStatus] = useState('loading')
  const [bookError, setBookError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloadBooks, setReloadBooks] = useState(0)
  const latestSearch = useRef(0)
  const visibleBooks = books
    .filter((book) => book.status === bookFilter)
    .sort((a, b) => {
      if (bookFilter === 'unread') return b.id - a.id
      const aDate = a.readDate?.value ?? ''
      const bDate = b.readDate?.value ?? ''
      if (aDate !== bDate) return aDate < bDate ? 1 : -1
      return b.id - a.id
    })

  useEffect(() => {
    let active = true
    getBooks()
      .then((result) => {
        if (!active) return
        setBooks(result)
        setBookStatus('ready')
      })
      .catch(() => {
        if (active) setBookStatus('error')
      })
    return () => { active = false }
  }, [reloadBooks])

  const updateTitle = (event) => {
    setTitle(event.target.value)
    setSelectedCoverUrl(null)
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
          author: formatNdlAuthor(item.getElementsByTagNameNS(dcNamespace, 'creator')[0]?.textContent.trim()),
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
    setSelectedCoverUrl(book.coverUrl)
    setSearchResults([])
    setSearchStatus('idle')
  }

  const toggleBookDetails = (id) => {
    setExpandedBookId((current) => current === id ? null : id)
    setReadingBookId(null)
    setEditingInfoBookId(null)
    setEditingMemoBookId(null)
  }

  const addBook = async (readDetails) => {
    const bookTitle = title.trim()
    const bookAuthor = author.trim()

    if (!bookTitle || !bookAuthor || saving || bookStatus !== 'ready') return

    const input = {
      title: bookTitle,
      author: bookAuthor,
      coverUrl: selectedCoverUrl,
      ...(readDetails || { memo: unreadMemo.trim() }),
      status: readDetails ? 'read' : 'unread',
    }

    setSaving(true)
    setBookError('')
    try {
      const newBook = await createBook(input)
      setBookFilter(newBook.status)
      setBooks([])
      setBookStatus('loading')
      setExpandedBookId(newBook.id)
      setReadingBookId(null)
      setEditingInfoBookId(null)
      setEditingMemoBookId(null)
      setTitle('')
      setAuthor('')
      setSelectedCoverUrl(null)
      setRegistrationStatus('unread')
      setUnreadMemo('')
      latestSearch.current += 1
      setSearchResults([])
      setSearchStatus('idle')
      try {
        setBooks(await getBooks())
        setBookStatus('ready')
      } catch {
        setBookError('登録は完了しましたが一覧を読み込めませんでした。再読み込みしてください')
        setBookStatus('error')
      }
    } catch {
      setBookError('登録できませんでした。もう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  const deleteBook = async (id) => {
    if (saving || bookStatus !== 'ready') return
    setSaving(true)
    setBookError('')
    try {
      await removeBook(id)
      setBooks((current) => current.filter((book) => book.id !== id))
      setExpandedBookId((current) => current === id ? null : current)
      setReadingBookId((current) => current === id ? null : current)
      setEditingInfoBookId((current) => current === id ? null : current)
      setEditingMemoBookId((current) => current === id ? null : current)
    } catch {
      setBookError('削除できませんでした。もう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  const completeBook = async (id, details) => {
    if (saving || bookStatus !== 'ready') return
    setSaving(true)
    setBookError('')
    try {
      const updated = await updateBook(id, { ...details, status: 'read' })
      setBooks((current) => current.map((book) => book.id === id ? updated : book))
      setBookFilter('read')
      setReadingBookId(null)
    } catch {
      setBookError('読了記録を保存できませんでした。もう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  const updateBookInfo = async (id, info) => {
    if (saving || bookStatus !== 'ready') return
    setSaving(true)
    setBookError('')
    try {
      const updated = await updateBook(id, info)
      setBooks((current) => current.map((book) => book.id === id ? updated : book))
      setEditingInfoBookId(null)
    } catch {
      setBookError('本の情報を保存できませんでした。もう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  const updateBookMemo = async (id, details) => {
    if (saving || bookStatus !== 'ready') return
    setSaving(true)
    setBookError('')
    try {
      const updated = await updateBook(id, details)
      setBooks((current) => current.map((book) => book.id === id ? updated : book))
      setEditingMemoBookId(null)
    } catch {
      setBookError('メモを保存できませんでした。もう一度お試しください')
    } finally {
      setSaving(false)
    }
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
        {registrationStatus === 'unread' && (
          <>
            <label htmlFor="unread-memo">メモ（任意）</label>
            <textarea id="unread-memo" value={unreadMemo} onChange={(event) => setUnreadMemo(event.target.value)} />
          </>
        )}
        <div className="book-form-actions">
          <button type="button" onClick={searchBooks} disabled={!title.trim() || searchStatus === 'loading'}>
            検索
          </button>
          {registrationStatus === 'unread' && (
            <button type="button" onClick={() => addBook()} disabled={!title.trim() || !author.trim() || saving || bookStatus !== 'ready'}>
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
            canSave={Boolean(title.trim() && author.trim() && !saving && bookStatus === 'ready')}
          />
        )}
      </div>

      {searchStatus !== 'idle' && (
        <section className="search-results" aria-label="検索結果">
          <h2>検索結果</h2>
          {searchStatus === 'loading' && (
            <p className="search-loading" role="status">
              <span className="search-spinner" aria-hidden="true" />
              検索中...
            </p>
          )}
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
        <div className="book-list-filters" role="group" aria-label="本の表示">
          <button type="button" aria-pressed={bookFilter === 'read'} onClick={() => setBookFilter('read')}>読了</button>
          <button type="button" aria-pressed={bookFilter === 'unread'} onClick={() => setBookFilter('unread')}>積読</button>
        </div>
        {bookStatus === 'loading' && <p role="status">記録を読み込み中...</p>}
        {bookStatus === 'error' && (
          <div>
            <p role="alert">{bookError || '記録を読み込めませんでした。APIサーバーを確認してください'}</p>
            <button type="button" onClick={() => {
              setBookError('')
              setBookStatus('loading')
              setReloadBooks((count) => count + 1)
            }}>再読み込み</button>
          </div>
        )}
        {bookError && bookStatus !== 'error' && <p role="alert">{bookError}</p>}
        {bookStatus === 'ready' && visibleBooks.length === 0 && <p>表示する本がありません</p>}
        <ul>
          {visibleBooks.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="book-summary"
                aria-expanded={expandedBookId === book.id}
                aria-label={`${book.title}の詳細を${expandedBookId === book.id ? '閉じる' : '開く'}`}
                onClick={() => toggleBookDetails(book.id)}
                disabled={saving}
              >
                <BookCover book={book} />
                <span className="book-summary-title">{book.author ? `${book.title} / ${book.author}` : book.title}</span>
                <span className="book-summary-icon" aria-hidden="true">{expandedBookId === book.id ? '−' : '+'}</span>
              </button>
              {expandedBookId === book.id && (
                <div className="book-details">
                  {book.status === 'read' ? (
                    <>
                      <p>読了 · {book.rating}/5</p>
                      <p>{book.readDate ? (book.readDate.precision === 'year' ? `${book.readDate.value}年` : book.readDate.value) : '読了時期不明'}</p>
                    </>
                  ) : (
                    <p>積読</p>
                  )}
                  {book.memo && readingBookId !== book.id && editingMemoBookId !== book.id && <p className="book-memo">{book.memo}</p>}
                  {editingInfoBookId === book.id && (
                    <BookInfoForm book={book} onSave={updateBookInfo} onCancel={() => setEditingInfoBookId(null)} canSave={!saving} />
                  )}
                  {editingMemoBookId === book.id && (
                    <MemoForm book={book} onSave={updateBookMemo} onCancel={() => setEditingMemoBookId(null)} canSave={!saving} />
                  )}
                  {readingBookId === book.id && (
                    <ReadBookForm book={book} onSave={completeBook} onCancel={() => setReadingBookId(null)} canSave={!saving} />
                  )}
                  <div className="book-detail-actions">
                    {editingInfoBookId !== book.id && (
                      <button type="button" disabled={saving} onClick={() => {
                        setReadingBookId(null)
                        setEditingMemoBookId(null)
                        setEditingInfoBookId(book.id)
                      }}>タイトル・著者を編集</button>
                    )}
                    {readingBookId !== book.id && (
                      <button type="button" disabled={saving} onClick={() => {
                        setEditingInfoBookId(null)
                        setEditingMemoBookId(null)
                        setReadingBookId(book.id)
                      }}>{book.status === 'read' ? '読了記録を編集' : '読了にする'}</button>
                    )}
                    {book.status === 'unread' && editingMemoBookId !== book.id && (
                      <button type="button" disabled={saving} onClick={() => {
                        setEditingInfoBookId(null)
                        setReadingBookId(null)
                        setEditingMemoBookId(book.id)
                      }}>{book.memo ? 'メモを編集' : 'メモを書く'}</button>
                    )}
                    <button type="button" onClick={() => deleteBook(book.id)} disabled={saving}>削除</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
