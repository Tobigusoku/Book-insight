import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

describe('App', () => {
  let apiBooks
  let nextId
  let searchFetch
  let failingMethod

  const seedBooks = (books) => {
    apiBooks = structuredClone(books)
    nextId = Math.max(0, ...books.map((book) => book.id)) + 1
  }

  const apiResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => structuredClone(data),
  })

  const renderApp = async () => {
    const view = render(<App />)
    await waitFor(() => expect(screen.queryByText('記録を読み込み中...')).not.toBeInTheDocument())
    return view
  }

  const openBook = (title) => {
    fireEvent.click(screen.getByRole('button', { name: `${title}の詳細を開く` }))
  }

  const getBookItem = (title) => screen.getByRole('button', { name: `${title}の詳細を開く` }).closest('li')

  const showBooks = (status) => {
    fireEvent.click(within(screen.getByRole('group', { name: '本の表示' })).getByRole('button', { name: status }))
  }

  beforeEach(() => {
    localStorage.removeItem('book-insight-books')
    apiBooks = []
    nextId = 1
    failingMethod = null
    searchFetch = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
      if (!String(input).startsWith('/api/books')) return searchFetch(input, options)
      const method = options.method || 'GET'
      if (failingMethod === method) {
        failingMethod = null
        return apiResponse({ error: 'Temporary failure' }, 503)
      }
      if (method === 'GET') return apiResponse(apiBooks)
      if (method === 'POST') {
        const inputBook = JSON.parse(options.body)
        const book = { id: nextId++, coverUrl: null, memo: '', ...inputBook }
        apiBooks.push(book)
        return apiResponse(book, 201)
      }
      const id = Number(String(input).split('/').at(-1))
      const index = apiBooks.findIndex((book) => book.id === id)
      if (index === -1) return apiResponse({ error: 'Book not found' }, 404)
      if (method === 'PATCH') {
        apiBooks[index] = { ...apiBooks[index], ...JSON.parse(options.body) }
        return apiResponse(apiBooks[index])
      }
      if (method === 'DELETE') {
        apiBooks.splice(index, 1)
        return { ok: true, status: 204 }
      }
      throw new Error(`Unexpected method: ${method}`)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('Book Insightという見出しを表示する', async () => {
    await renderApp()

    expect(screen.getByRole('heading', { name: 'Book Insight' })).toBeInTheDocument()
  })

  test('一覧は読了を初期表示し、積読との間で切り替える', async () => {
    seedBooks([
      { id: 1, title: '積読の本', author: '著者A', status: 'unread' },
      { id: 2, title: '読了の本', author: '著者B', status: 'read', rating: 4, readDate: null },
    ])
    await renderApp()

    const filters = within(screen.getByRole('group', { name: '本の表示' }))
    expect(filters.getAllByRole('button').map((button) => button.textContent)).toEqual(['読了', '積読'])
    expect(filters.queryByRole('button', { name: 'すべて' })).not.toBeInTheDocument()
    expect(filters.getByRole('button', { name: '読了' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('読了の本 / 著者B')).toBeInTheDocument()
    expect(screen.queryByText('積読の本 / 著者A')).not.toBeInTheDocument()

    fireEvent.click(filters.getByRole('button', { name: '積読' }))
    expect(filters.getByRole('button', { name: '積読' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('積読の本 / 著者A')).toBeInTheDocument()
    expect(screen.queryByText('読了の本 / 著者B')).not.toBeInTheDocument()

    fireEvent.click(filters.getByRole('button', { name: '読了' }))
    expect(screen.getByText('読了の本 / 著者B')).toBeInTheDocument()
    expect(screen.queryByText('積読の本 / 著者A')).not.toBeInTheDocument()

    expect(apiBooks).toHaveLength(2)
  })

  test('選択した表示に本がない場合は空表示にする', async () => {
    seedBooks([{ id: 1, title: '積読の本', author: '著者A', status: 'unread' }])
    await renderApp()

    expect(screen.getByText('表示する本がありません')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    showBooks('積読')
    expect(screen.getByText('積読の本 / 著者A')).toBeInTheDocument()
  })

  test('積読は新しく登録した本から表示する', async () => {
    seedBooks([
      { id: 1, title: '古い積読', author: '著者A', status: 'unread' },
      { id: 2, title: '読了の本', author: '著者B', status: 'read', rating: 3, readDate: null },
      { id: 3, title: '新しい積読', author: '著者C', status: 'unread' },
    ])
    await renderApp()

    showBooks('積読')
    expect(screen.getAllByRole('listitem').map((item) => within(item).getByRole('button').getAttribute('aria-label')))
      .toEqual(['新しい積読の詳細を開く', '古い積読の詳細を開く'])
    expect(apiBooks.map((book) => book.id)).toEqual([1, 2, 3])
  })

  test('読了は読了時期の新しい順に表示し、不明は最後にする', async () => {
    seedBooks([
      { id: 1, title: '時期不明', author: '著者A', status: 'read', rating: 3, readDate: null },
      { id: 2, title: '2023年', author: '著者B', status: 'read', rating: 3, readDate: { precision: 'year', value: '2023' } },
      { id: 3, title: '2024年のみ', author: '著者C', status: 'read', rating: 3, readDate: { precision: 'year', value: '2024' } },
      { id: 4, title: '2024年5月', author: '著者D', status: 'read', rating: 3, readDate: { precision: 'day', value: '2024-05-01' } },
      { id: 5, title: '2024年8月', author: '著者E', status: 'read', rating: 3, readDate: { precision: 'day', value: '2024-08-01' } },
    ])
    await renderApp()

    expect(screen.getAllByRole('listitem').map((item) => within(item).getByRole('button').getAttribute('aria-label')))
      .toEqual([
        '2024年8月の詳細を開く',
        '2024年5月の詳細を開く',
        '2024年のみの詳細を開く',
        '2023年の詳細を開く',
        '時期不明の詳細を開く',
      ])
  })

  test('入力した本のタイトルを保持する', async () => {
    await renderApp()

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })

    expect(titleInput).toHaveValue('銀河鉄道の夜')
  })

  test('タイトルと著者を登録し、入力欄を空にする', async () => {
    await renderApp()

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    fireEvent.change(titleInput, { target: { value: ' 銀河鉄道の夜 ' } })
    fireEvent.change(authorInput, { target: { value: ' 宮沢賢治 ' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const bookItem = await screen.findByRole('listitem')
    expect(within(screen.getByRole('group', { name: '本の表示' })).getByRole('button', { name: '積読' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(bookItem).toHaveTextContent('銀河鉄道の夜 / 宮沢賢治')
    expect(within(bookItem).getByText('積読')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      title: '銀河鉄道の夜',
      author: '宮沢賢治',
      status: 'unread',
    })
    expect(apiBooks[0].memo).toBe('')
    expect(apiBooks[0].coverUrl).toBeNull()
    expect(within(bookItem).getByText('書影なし')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '感想・メモ' })).not.toBeInTheDocument()
    expect(titleInput).toHaveValue('')
    expect(authorInput).toHaveValue('')
  })

  test('APIサーバー再起動後の追加で古い本とIDが重なっても一覧を同期する', async () => {
    seedBooks([{ id: 1, title: '古い本', author: '著者A', status: 'unread', memo: '' }])
    const { unmount } = await renderApp()
    showBooks('積読')
    openBook('古い本')

    seedBooks([])
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '新しい本' } })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), { target: { value: '著者B' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await screen.findByText('新しい本 / 著者B')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('古い本 / 著者A')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新しい本の詳細を閉じる' })).toHaveAttribute('aria-expanded', 'true')

    unmount()
    await renderApp()
    showBooks('積読')
    expect(screen.getByText('新しい本 / 著者B')).toBeInTheDocument()
  })

  test('登録後の一覧再取得が失敗しても二重登録せず再読み込みできる', async () => {
    await renderApp()
    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    fireEvent.change(titleInput, { target: { value: '雪国' } })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), { target: { value: '川端康成' } })
    failingMethod = 'GET'
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('登録は完了しましたが一覧を読み込めませんでした')
    expect(apiBooks).toHaveLength(1)
    expect(titleInput).toHaveValue('')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }))
    expect(await screen.findByText('雪国 / 川端康成')).toBeInTheDocument()
    expect(apiBooks).toHaveLength(1)
  })

  test('積読として登録するときメモも保存できる', async () => {
    await renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), { target: { value: '川端康成' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'メモ（任意）' }), { target: { value: ' 途中のメモ ' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    expect(await screen.findByText('途中のメモ')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({ status: 'unread', memo: '途中のメモ' })
    expect(screen.getByRole('textbox', { name: 'メモ（任意）' })).toHaveValue('')
  })

  test('積読のメモを編集し、読了にした後も引き継ぐ', async () => {
    seedBooks([{ id: 1, title: '雪国', author: '川端康成', status: 'unread', memo: '最初のメモ' }])
    await renderApp()
    showBooks('積読')
    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: 'メモを編集' }))
    const memoForm = screen.getByRole('form', { name: '雪国のメモを編集' })
    fireEvent.change(within(memoForm).getByRole('textbox', { name: 'メモ（任意）' }), {
      target: { value: ' 読んでいる途中の感想 ' },
    })
    fireEvent.click(within(memoForm).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.queryByRole('form', { name: '雪国のメモを編集' })).not.toBeInTheDocument())
    expect(screen.getByText('読んでいる途中の感想')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({ status: 'unread', memo: '読んでいる途中の感想' })

    fireEvent.click(screen.getByRole('button', { name: '読了にする' }))
    const readForm = screen.getByRole('form', { name: '雪国の読了記録' })
    expect(within(readForm).getByRole('textbox', { name: '感想・メモ（任意）' })).toHaveValue('読んでいる途中の感想')
    fireEvent.click(within(readForm).getByRole('button', { name: '保存' }))

    expect(await screen.findByText('読了 · 3/5')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({ status: 'read', memo: '読んでいる途中の感想' })
  })

  test('積読のメモ編集をキャンセルしても保存済みのメモは変わらない', async () => {
    seedBooks([{ id: 1, title: '雪国', author: '川端康成', status: 'unread', memo: '元のメモ' }])
    await renderApp()
    showBooks('積読')
    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: 'メモを編集' }))
    const form = screen.getByRole('form', { name: '雪国のメモを編集' })
    fireEvent.change(within(form).getByRole('textbox', { name: 'メモ（任意）' }), { target: { value: '変更後' } })
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))

    expect(screen.getByText('元のメモ')).toBeInTheDocument()
    expect(apiBooks[0].memo).toBe('元のメモ')
  })

  test('積読のメモ保存に失敗したら編集内容を残して再試行できる', async () => {
    seedBooks([{ id: 1, title: '雪国', author: '川端康成', status: 'unread', memo: '元のメモ' }])
    await renderApp()
    showBooks('積読')
    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: 'メモを編集' }))
    const form = screen.getByRole('form', { name: '雪国のメモを編集' })
    fireEvent.change(within(form).getByRole('textbox', { name: 'メモ（任意）' }), { target: { value: '新しいメモ' } })
    failingMethod = 'PATCH'
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('メモを保存できませんでした')
    expect(within(form).getByRole('textbox', { name: 'メモ（任意）' })).toHaveValue('新しいメモ')
    expect(apiBooks[0].memo).toBe('元のメモ')

    fireEvent.click(within(form).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: '雪国のメモを編集' })).not.toBeInTheDocument())
    expect(screen.getByText('新しいメモ')).toBeInTheDocument()
  })

  test('タイトルと著者の両方がないと追加できない', async () => {
    await renderApp()

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    const addButton = screen.getByRole('button', { name: '追加' })

    expect(addButton).toBeDisabled()
    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })
    expect(addButton).toBeDisabled()
    fireEvent.change(authorInput, { target: { value: '   ' } })
    expect(addButton).toBeDisabled()
    fireEvent.change(authorInput, { target: { value: '宮沢賢治' } })
    expect(addButton).toBeEnabled()
    fireEvent.change(titleInput, { target: { value: '   ' } })
    expect(addButton).toBeDisabled()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  test('新規登録で読了を選ぶと評価3と今日の日付で保存する', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2024, 5, 1, 12))
    const { unmount } = await renderApp()

    fireEvent.click(within(screen.getByRole('group', { name: '登録時の状態' })).getByRole('button', { name: '読了' }))
    const form = screen.getByRole('form', { name: '新しい本の読了記録' })
    const addButton = within(form).getByRole('button', { name: '追加' })
    expect(addButton).toBeDisabled()
    expect(within(form).getByRole('combobox', { name: '評価' })).toHaveValue('3')
    expect(within(form).getByLabelText('読了日')).toHaveValue('2024-06-01')

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '銀河鉄道の夜' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '宮沢賢治' },
    })
    expect(addButton).toBeEnabled()
    fireEvent.click(addButton)

    const bookItem = await screen.findByRole('listitem')
    expect(within(bookItem).getByText('読了 · 3/5')).toBeInTheDocument()
    expect(within(bookItem).getByText('2024-06-01')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      title: '銀河鉄道の夜',
      author: '宮沢賢治',
      status: 'read',
      rating: 3,
      readDate: { precision: 'day', value: '2024-06-01' },
      memo: '',
    })
    expect(within(screen.getByRole('group', { name: '登録時の状態' })).getByRole('button', { name: '積読' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('form', { name: '新しい本の読了記録' })).not.toBeInTheDocument()

    unmount()
    await renderApp()
    openBook('銀河鉄道の夜')
    expect(screen.getByText('読了 · 3/5')).toBeInTheDocument()
  })

  test('読了として新規登録するとき年のみ・評価・メモを選べる', async () => {
    await renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: 'こころ' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '夏目漱石' },
    })
    fireEvent.click(within(screen.getByRole('group', { name: '登録時の状態' })).getByRole('button', { name: '読了' }))

    const form = screen.getByRole('form', { name: '新しい本の読了記録' })
    fireEvent.change(within(form).getByRole('combobox', { name: '評価' }), {
      target: { value: '5' },
    })
    fireEvent.change(within(form).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'year' },
    })
    fireEvent.change(within(form).getByLabelText('読了年'), {
      target: { value: '2019' },
    })
    fireEvent.change(within(form).getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: ' また読みたい ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: '追加' }))

    expect(await screen.findByText('読了 · 5/5')).toBeInTheDocument()
    expect(screen.getByText('2019年')).toBeInTheDocument()
    expect(screen.getByText('また読みたい')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      status: 'read',
      rating: 5,
      readDate: { precision: 'year', value: '2019' },
      memo: 'また読みたい',
    })
  })

  test('読了登録をキャンセルすると積読として追加できる', async () => {
    await renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '雪国' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '川端康成' },
    })
    fireEvent.click(within(screen.getByRole('group', { name: '登録時の状態' })).getByRole('button', { name: '読了' }))
    const form = screen.getByRole('form', { name: '新しい本の読了記録' })
    fireEvent.change(within(form).getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: '保存しないメモ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await screen.findByRole('listitem')
    const book = apiBooks[0]
    expect(book.status).toBe('unread')
    expect(book.memo).toBe('')
    expect(within(screen.getByRole('listitem')).getByText('積読')).toBeInTheDocument()
  })

  test('選んだ本だけを削除する', async () => {
    await renderApp()

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    const addButton = screen.getByRole('button', { name: '追加' })

    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })
    fireEvent.change(authorInput, { target: { value: '宮沢賢治' } })
    fireEvent.click(addButton)
    await screen.findByText('銀河鉄道の夜 / 宮沢賢治')
    fireEvent.change(titleInput, { target: { value: 'こころ' } })
    fireEvent.change(authorInput, { target: { value: '夏目漱石' } })
    fireEvent.click(addButton)
    await screen.findByText('こころ / 夏目漱石')

    const firstBook = getBookItem('銀河鉄道の夜')
    openBook('銀河鉄道の夜')
    fireEvent.click(within(firstBook).getByRole('button', { name: '削除' }))

    await waitFor(() => expect(screen.queryByText('銀河鉄道の夜 / 宮沢賢治')).not.toBeInTheDocument())
    expect(screen.getByText('こころ / 夏目漱石')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  test('追加と削除した本をAPIに保存し、再表示後も復元する', async () => {
    const { unmount } = await renderApp()
    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    const addButton = screen.getByRole('button', { name: '追加' })

    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })
    fireEvent.change(authorInput, { target: { value: '宮沢賢治' } })
    fireEvent.click(addButton)
    await screen.findByText('銀河鉄道の夜 / 宮沢賢治')
    fireEvent.change(titleInput, { target: { value: 'こころ' } })
    fireEvent.change(authorInput, { target: { value: '夏目漱石' } })
    fireEvent.click(addButton)
    await screen.findByText('こころ / 夏目漱石')

    expect(apiBooks).toHaveLength(2)

    unmount()
    await renderApp()
    showBooks('積読')
    expect(screen.getByText('銀河鉄道の夜 / 宮沢賢治')).toBeInTheDocument()
    expect(screen.getByText('こころ / 夏目漱石')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
    expect(apiBooks.map((book) => book.status))
      .toEqual(['unread', 'unread'])

    const restoredTitleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const restoredAuthorInput = screen.getByRole('textbox', { name: '著者' })
    fireEvent.change(restoredTitleInput, { target: { value: '人間失格' } })
    fireEvent.change(restoredAuthorInput, { target: { value: '太宰治' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await screen.findByText('人間失格 / 太宰治')

    const books = apiBooks
    expect(books).toHaveLength(3)
    expect(books.map((book) => book.author)).toEqual(['宮沢賢治', '夏目漱石', '太宰治'])
    expect(new Set(books.map((book) => book.id)).size).toBe(3)

    const bookToDelete = getBookItem('こころ')
    openBook('こころ')
    fireEvent.click(within(bookToDelete).getByRole('button', { name: '削除' }))

    await waitFor(() => expect(apiBooks.map((book) => book.title))
      .toEqual(['銀河鉄道の夜', '人間失格']))
  })

  test('以前のlocalStorageの記録は読み込まない', async () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: '銀河鉄道の夜', memo: '読後の感想' },
    ]))

    await renderApp()

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(localStorage.getItem('book-insight-books')).toContain('銀河鉄道の夜')
  })

  test('本を開くまで状態とメモを隠し、別の本を開くと前の本を閉じる', async () => {
    seedBooks([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'read', rating: 5, readDate: null, memo: '読後の感想' },
      { id: 2, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    await renderApp()
    const firstBook = getBookItem('こころ')

    expect(within(firstBook).getByRole('button', { name: 'こころの詳細を開く' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(firstBook).queryByText('読了 · 5/5')).not.toBeInTheDocument()
    expect(within(firstBook).queryByText('読後の感想')).not.toBeInTheDocument()

    openBook('こころ')
    expect(within(firstBook).getByRole('button', { name: 'こころの詳細を閉じる' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(firstBook).getByText('読了 · 5/5')).toBeInTheDocument()
    expect(within(firstBook).getByText('読後の感想')).toBeInTheDocument()

    showBooks('積読')
    const secondBook = getBookItem('雪国')
    expect(within(secondBook).queryByText('積読')).not.toBeInTheDocument()
    openBook('雪国')
    expect(within(secondBook).getByText('積読')).toBeInTheDocument()
    fireEvent.click(within(secondBook).getByRole('button', { name: '雪国の詳細を閉じる' }))
    expect(within(secondBook).queryByText('積読')).not.toBeInTheDocument()
    showBooks('読了')
    expect(screen.getByRole('button', { name: 'こころの詳細を開く' })).toHaveAttribute('aria-expanded', 'false')
  })

  test('詳細を閉じると未保存の編集フォームは破棄される', async () => {
    seedBooks([{ id: 1, title: '雪国', author: '川端康成', status: 'unread' }])
    await renderApp()
    showBooks('積読')

    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: '読了にする' }))
    fireEvent.change(screen.getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: '保存しないメモ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '雪国の詳細を閉じる' }))
    expect(screen.queryByRole('form', { name: '雪国の読了記録' })).not.toBeInTheDocument()

    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: '読了にする' }))
    expect(screen.getByRole('textbox', { name: '感想・メモ（任意）' })).toHaveValue('')
    expect(apiBooks[0].status).toBe('unread')
  })

  test('積読を読了にすると初期評価3と今日の日付を保存し、再表示後も残る', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2024, 5, 1, 12))
    const { unmount } = await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '銀河鉄道の夜' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '宮沢賢治' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const bookItem = await screen.findByRole('listitem')
    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const form = within(bookItem).getByRole('form', { name: '銀河鉄道の夜の読了記録' })
    expect(within(form).getByRole('combobox', { name: '評価' })).toHaveValue('3')
    expect(within(form).getByLabelText('読了日')).toHaveValue('2024-06-01')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))

    expect(await within(bookItem).findByText('読了 · 3/5')).toBeInTheDocument()
    expect(within(bookItem).getByText('2024-06-01')).toBeInTheDocument()
    expect(within(bookItem).queryByRole('button', { name: '読了にする' })).not.toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      status: 'read',
      rating: 3,
      readDate: { precision: 'day', value: '2024-06-01' },
      memo: '',
    })

    unmount()
    await renderApp()
    openBook('銀河鉄道の夜')
    expect(screen.getByText('読了 · 3/5')).toBeInTheDocument()
    expect(screen.getByText('2024-06-01')).toBeInTheDocument()
  })

  test('読了時期を年のみで記録し、評価と感想も保存できる', async () => {
    seedBooks([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'unread' },
    ])
    await renderApp()
    showBooks('積読')

    const bookItem = screen.getByRole('listitem')
    openBook('こころ')
    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const form = within(bookItem).getByRole('form', { name: 'こころの読了記録' })
    fireEvent.change(within(form).getByRole('combobox', { name: '評価' }), {
      target: { value: '5' },
    })
    fireEvent.change(within(form).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'year' },
    })
    fireEvent.change(within(form).getByLabelText('読了年'), {
      target: { value: '2020' },
    })
    fireEvent.change(within(form).getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: ' また読みたい ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))

    expect(await within(bookItem).findByText('読了 · 5/5')).toBeInTheDocument()
    expect(within(bookItem).getByText('2020年')).toBeInTheDocument()
    expect(within(bookItem).getByText('また読みたい')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      status: 'read',
      rating: 5,
      readDate: { precision: 'year', value: '2020' },
      memo: 'また読みたい',
    })
  })

  test('読了時期を不明にでき、キャンセル時は積読のままにする', async () => {
    seedBooks([
      { id: 1, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    await renderApp()
    showBooks('積読')

    const bookItem = screen.getByRole('listitem')
    openBook('雪国')
    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const form = within(bookItem).getByRole('form', { name: '雪国の読了記録' })
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))
    expect(within(bookItem).getByText('積読')).toBeInTheDocument()
    expect(apiBooks[0].status).toBe('unread')

    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const reopenedForm = within(bookItem).getByRole('form', { name: '雪国の読了記録' })
    fireEvent.change(within(reopenedForm).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'unknown' },
    })
    expect(within(reopenedForm).queryByLabelText('読了日')).not.toBeInTheDocument()
    fireEvent.click(within(reopenedForm).getByRole('button', { name: '保存' }))

    expect(await within(bookItem).findByText('読了時期不明')).toBeInTheDocument()
    expect(apiBooks[0].readDate).toBeNull()
  })

  test('読了年が空なら保存しない', async () => {
    seedBooks([
      { id: 1, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    await renderApp()
    showBooks('積読')

    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: '読了にする' }))
    const form = screen.getByRole('form', { name: '雪国の読了記録' })
    fireEvent.change(within(form).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'year' },
    })
    fireEvent.change(within(form).getByLabelText('読了年'), { target: { value: '' } })
    fireEvent.submit(form)

    expect(within(screen.getByRole('listitem')).getByText('積読')).toBeInTheDocument()
    expect(apiBooks[0].status).toBe('unread')
  })

  test('選んだ本だけを読了にする', async () => {
    seedBooks([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'unread' },
      { id: 2, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    await renderApp()
    showBooks('積読')

    const firstBook = getBookItem('こころ')
    openBook('こころ')
    fireEvent.click(within(firstBook).getByRole('button', { name: '読了にする' }))
    fireEvent.click(within(firstBook).getByRole('button', { name: '保存' }))

    expect(await within(firstBook).findByText('読了 · 3/5')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: '本の表示' })).getByRole('button', { name: '読了' }))
      .toHaveAttribute('aria-pressed', 'true')
    showBooks('積読')
    const secondBook = getBookItem('雪国')
    openBook('雪国')
    expect(within(secondBook).getByText('積読')).toBeInTheDocument()
    expect(apiBooks.map((book) => book.status))
      .toEqual(['read', 'unread'])
  })

  test('読了済みの評価・読了時期・メモを編集して保存できる', async () => {
    seedBooks([
      {
        id: 1,
        title: 'こころ',
        author: '夏目漱石',
        status: 'read',
        rating: 5,
        readDate: { precision: 'year', value: '2018' },
        memo: '前の感想',
      },
      { id: 2, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    const { unmount } = await renderApp()

    const firstBook = getBookItem('こころ')
    openBook('こころ')
    fireEvent.click(within(firstBook).getByRole('button', { name: '読了記録を編集' }))
    const form = within(firstBook).getByRole('form', { name: 'こころの読了記録を編集' })
    expect(within(form).getByRole('combobox', { name: '評価' })).toHaveValue('5')
    expect(within(form).getByRole('combobox', { name: '読了時期' })).toHaveValue('year')
    expect(within(form).getByLabelText('読了年')).toHaveValue('2018')
    expect(within(form).getByRole('textbox', { name: '感想・メモ（任意）' })).toHaveValue('前の感想')

    fireEvent.change(within(form).getByRole('combobox', { name: '評価' }), {
      target: { value: '2' },
    })
    fireEvent.change(within(form).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'day' },
    })
    fireEvent.change(within(form).getByLabelText('読了日'), {
      target: { value: '2023-04-05' },
    })
    fireEvent.change(within(form).getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: ' 新しい感想 ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))

    expect(await within(firstBook).findByText('読了 · 2/5')).toBeInTheDocument()
    expect(within(firstBook).getByText('2023-04-05')).toBeInTheDocument()
    expect(within(firstBook).getByText('新しい感想')).toBeInTheDocument()
    showBooks('積読')
    const secondBook = getBookItem('雪国')
    openBook('雪国')
    expect(within(secondBook).getByText('積読')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      title: 'こころ',
      author: '夏目漱石',
      status: 'read',
      rating: 2,
      readDate: { precision: 'day', value: '2023-04-05' },
      memo: '新しい感想',
    })

    unmount()
    await renderApp()
    openBook('こころ')
    expect(screen.getByText('読了 · 2/5')).toBeInTheDocument()
    expect(screen.getByText('新しい感想')).toBeInTheDocument()
  })

  test('読了済みの編集をキャンセルすると保存済みの値を保つ', async () => {
    seedBooks([
      {
        id: 1,
        title: '雪国',
        author: '川端康成',
        status: 'read',
        rating: 3,
        readDate: null,
        memo: '元の感想',
      },
    ])
    await renderApp()

    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: '読了記録を編集' }))
    const form = screen.getByRole('form', { name: '雪国の読了記録を編集' })
    expect(within(form).getByRole('combobox', { name: '読了時期' })).toHaveValue('unknown')
    fireEvent.change(within(form).getByRole('combobox', { name: '評価' }), {
      target: { value: '4' },
    })
    fireEvent.change(within(form).getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: '保存しない感想' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))

    expect(screen.getByText('読了 · 3/5')).toBeInTheDocument()
    expect(screen.getByText('元の感想')).toBeInTheDocument()
    expect(apiBooks[0].rating).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: '読了記録を編集' }))
    expect(screen.getByRole('combobox', { name: '評価' })).toHaveValue('3')
    expect(screen.getByRole('textbox', { name: '感想・メモ（任意）' })).toHaveValue('元の感想')
  })

  test('タイトルと著者を編集し、読了記録を保ったまま保存できる', async () => {
    seedBooks([
      {
        id: 1,
        title: 'こころ',
        author: '夏目漱石',
        status: 'read',
        rating: 5,
        readDate: { precision: 'year', value: '2020' },
        memo: '印象に残った',
      },
      { id: 2, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    const { unmount } = await renderApp()

    const firstBook = getBookItem('こころ')
    openBook('こころ')
    fireEvent.click(within(firstBook).getByRole('button', { name: 'タイトル・著者を編集' }))
    const form = within(firstBook).getByRole('form', { name: 'こころのタイトルと著者を編集' })
    expect(within(form).getByRole('textbox', { name: '本のタイトル' })).toHaveValue('こころ')
    expect(within(form).getByRole('textbox', { name: '著者' })).toHaveValue('夏目漱石')
    fireEvent.change(within(form).getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: ' こころ 改訂版 ' },
    })
    fireEvent.change(within(form).getByRole('textbox', { name: '著者' }), {
      target: { value: ' 夏目 漱石 ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))

    expect(await within(firstBook).findByText('こころ 改訂版 / 夏目 漱石')).toBeInTheDocument()
    expect(within(firstBook).getByText('読了 · 5/5')).toBeInTheDocument()
    expect(within(firstBook).getByText('印象に残った')).toBeInTheDocument()
    showBooks('積読')
    const secondBook = getBookItem('雪国')
    expect(within(secondBook).getByText('雪国 / 川端康成')).toBeInTheDocument()
    expect(apiBooks[0]).toMatchObject({
      title: 'こころ 改訂版',
      author: '夏目 漱石',
      status: 'read',
      rating: 5,
      readDate: { precision: 'year', value: '2020' },
      memo: '印象に残った',
    })

    unmount()
    await renderApp()
    expect(await screen.findByText('こころ 改訂版 / 夏目 漱石')).toBeInTheDocument()
  })

  test('空白だけのタイトル・著者は保存できず、キャンセルすると元に戻る', async () => {
    seedBooks([
      { id: 1, title: '雪国', author: '川端康成', status: 'unread' },
    ])
    await renderApp()
    showBooks('積読')

    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: 'タイトル・著者を編集' }))
    const form = screen.getByRole('form', { name: '雪国のタイトルと著者を編集' })
    const titleInput = within(form).getByRole('textbox', { name: '本のタイトル' })
    const authorInput = within(form).getByRole('textbox', { name: '著者' })
    const saveButton = within(form).getByRole('button', { name: '保存' })
    fireEvent.change(titleInput, { target: { value: '   ' } })
    expect(saveButton).toBeDisabled()
    fireEvent.change(titleInput, { target: { value: '雪国 新版' } })
    fireEvent.change(authorInput, { target: { value: '   ' } })
    expect(saveButton).toBeDisabled()
    fireEvent.submit(form)
    expect(apiBooks[0].title).toBe('雪国')
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))

    expect(screen.getByText('雪国 / 川端康成')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'タイトル・著者を編集' }))
    const reopenedForm = screen.getByRole('form', { name: '雪国のタイトルと著者を編集' })
    expect(within(reopenedForm).getByRole('textbox', { name: '本のタイトル' })).toHaveValue('雪国')
    expect(within(reopenedForm).getByRole('textbox', { name: '著者' })).toHaveValue('川端康成')
  })

  test('タイトル編集を開くと未保存の読了フォームは閉じる', async () => {
    seedBooks([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'read', rating: 3, readDate: null, memo: '元のメモ' },
    ])
    await renderApp()

    openBook('こころ')
    fireEvent.click(screen.getByRole('button', { name: '読了記録を編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: '未保存のメモ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'タイトル・著者を編集' }))

    expect(screen.queryByRole('form', { name: 'こころの読了記録を編集' })).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'こころのタイトルと著者を編集' })).toBeInTheDocument()
    expect(apiBooks[0].memo).toBe('元のメモ')
  })

  test('本を検索して候補から読了として登録できる', async () => {
    const fetchMock = searchFetch.mockResolvedValue({
      ok: true,
      text: async () => `
        <rss xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:dcndl="http://ndl.go.jp/dcndl/terms/"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <channel><item>
            <title>成瀬は天下を取りにいく</title>
            <guid>https://ndlsearch.ndl.go.jp/books/123</guid>
            <dc:creator>宮島未奈</dc:creator>
            <dc:identifier xsi:type="dcndl:ISBN">978-4-10-354951-2</dc:identifier>
          </item></channel>
        </rss>`,
    })
    await renderApp()

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    fireEvent.change(titleInput, { target: { value: '成瀬は天下を取りにいく' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    const selectButton = await screen.findByRole('button', { name: '成瀬は天下を取りにいくを選択' })
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('title')).toBe('成瀬は天下を取りにいく')
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('mediatype')).toBe('books')
    expect(screen.getByText('宮島未奈')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://covers.openlibrary.org/b/isbn/9784103549512-S.jpg?default=false')

    fireEvent.click(selectButton)
    expect(titleInput).toHaveValue('成瀬は天下を取りにいく')
    expect(screen.getByRole('textbox', { name: '著者' })).toHaveValue('宮島未奈')
    expect(screen.queryByRole('button', { name: '成瀬は天下を取りにいくを選択' })).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('group', { name: '登録時の状態' })).getByRole('button', { name: '読了' }))
    fireEvent.click(within(screen.getByRole('form', { name: '新しい本の読了記録' })).getByRole('button', { name: '追加' }))
    await screen.findByText('成瀬は天下を取りにいく / 宮島未奈')
    expect(apiBooks[0]).toMatchObject({
      title: '成瀬は天下を取りにいく',
      author: '宮島未奈',
      coverUrl: 'https://covers.openlibrary.org/b/isbn/9784103549512-S.jpg?default=false',
      status: 'read',
      rating: 3,
    })
    expect(within(screen.getByRole('listitem')).getByRole('img', { name: '成瀬は天下を取りにいくの書影' }))
      .toHaveAttribute('src', 'https://covers.openlibrary.org/b/isbn/9784103549512-S.jpg?default=false')
  })

  test.each([
    ['殊能, 将之, 1964-2013', '殊能 将之'],
    ['山田, 太郎, 1950-', '山田 太郎'],
    ['山田, 太郎', '山田 太郎'],
    ['宮島未奈', '宮島未奈'],
    ['編集部, 出版社, 監修', '編集部, 出版社, 監修'],
  ])('NDLの著者表記 %s を検索候補と登録情報で %s にする', async (rawAuthor, expectedAuthor) => {
    searchFetch.mockResolvedValue({
      ok: true,
      text: async () => `
        <rss xmlns:dc="http://purl.org/dc/elements/1.1/">
          <channel><item>
            <title>雪国</title><guid>book-1</guid>
            <dc:creator>${rawAuthor}</dc:creator>
          </item></channel>
        </rss>`,
    })
    await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))
    const selectButton = await screen.findByRole('button', { name: '雪国を選択' })
    expect(screen.getByText(expectedAuthor)).toBeInTheDocument()
    fireEvent.click(selectButton)

    expect(screen.getByRole('textbox', { name: '著者' })).toHaveValue(expectedAuthor)
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await screen.findByRole('listitem')
    expect(apiBooks[0].author).toBe(expectedAuthor)
  })

  test('手入力した著者名はNDL用の整形をしない', async () => {
    await renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), { target: { value: 'Smith, Adam' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await screen.findByRole('listitem')
    expect(apiBooks[0].author).toBe('Smith, Adam')
  })

  test('積読に登録した書影は再表示後も残り、画像取得に失敗したら代替表示にする', async () => {
    searchFetch.mockResolvedValue({
      ok: true,
      text: async () => `
        <rss xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <channel><item>
            <title>雪国</title><guid>book-1</guid>
            <dc:creator>川端康成</dc:creator>
            <dc:identifier xsi:type="dcndl:ISBN">978-4-10-100101-2</dc:identifier>
          </item></channel>
        </rss>`,
    })
    const { unmount } = await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))
    fireEvent.click(await screen.findByRole('button', { name: '雪国を選択' }))
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const coverUrl = 'https://covers.openlibrary.org/b/isbn/9784101001012-S.jpg?default=false'
    const bookItem = await screen.findByRole('listitem')
    expect(apiBooks[0].coverUrl).toBe(coverUrl)
    expect(within(bookItem).getByRole('img', { name: '雪国の書影' })).toHaveAttribute('src', coverUrl)

    unmount()
    await renderApp()
    showBooks('積読')
    const restoredImage = within(screen.getByRole('listitem')).getByRole('img', { name: '雪国の書影' })
    expect(restoredImage).toHaveAttribute('src', coverUrl)
    fireEvent.error(restoredImage)
    expect(within(screen.getByRole('listitem')).getByText('書影なし')).toBeInTheDocument()
  })

  test('候補を選んだ後にタイトルを手入力で変えると元の書影を保存しない', async () => {
    searchFetch.mockResolvedValue({
      ok: true,
      text: async () => `
        <rss xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <channel><item>
            <title>雪国</title><guid>book-1</guid>
            <dc:creator>川端康成</dc:creator>
            <dc:identifier xsi:type="dcndl:ISBN">978-4-10-100101-2</dc:identifier>
          </item></channel>
        </rss>`,
    })
    await renderApp()

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    fireEvent.change(titleInput, { target: { value: '雪国' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))
    fireEvent.click(await screen.findByRole('button', { name: '雪国を選択' }))
    fireEvent.change(titleInput, { target: { value: '別の本' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    await screen.findByRole('listitem')
    expect(apiBooks[0].coverUrl).toBeNull()
    expect(within(screen.getByRole('listitem')).getByText('書影なし')).toBeInTheDocument()
  })

  test('検索中はスピナーと状態を表示し、結果が届いたら消す', async () => {
    let resolveSearch
    searchFetch.mockImplementation(() => new Promise((resolve) => { resolveSearch = resolve }))
    await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    const loading = screen.getByRole('status')
    expect(loading).toHaveTextContent('検索中...')
    expect(loading.querySelector('.search-spinner')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: '検索' })).toBeDisabled()

    resolveSearch({ ok: true, text: async () => '<rss><channel><item><title>雪国</title><guid>book-1</guid></item></channel></rss>' })
    expect(await screen.findByRole('button', { name: '雪国を選択' })).toBeInTheDocument()
    expect(screen.queryByText('検索中...')).not.toBeInTheDocument()
  })

  test('雪国を検索したら無関係な題名を除き、完全一致を先に表示する', async () => {
    searchFetch.mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel>
          <item><title>哀愁のムードサックス歌謡ベスト</title><guid>cd</guid></item>
          <item><title>雪国の文学</title><guid>related</guid></item>
          <item><title>雪国</title><guid>exact</guid></item>
        </channel></rss>`,
    })
    await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '雪国' },
    })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    const results = await screen.findAllByRole('button', { name: /を選択$/ })
    expect(results.map((button) => button.getAttribute('aria-label')))
      .toEqual(['雪国を選択', '雪国の文学を選択'])
  })

  test('何者を検索したら先頭一致を途中一致より優先する', async () => {
    const fetchMock = searchFetch.mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel>
          <item><title>彼は何者だったのか</title><guid>middle-1</guid></item>
          <item><title>あなたは何者か</title><guid>middle-2</guid></item>
          <item><title>何者になる</title><guid>prefix</guid></item>
          <item><title>何者</title><guid>exact</guid></item>
        </channel></rss>`,
    })
    await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '何者' },
    })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    const results = await screen.findAllByRole('button', { name: /を選択$/ })
    expect(results.map((button) => button.getAttribute('aria-label')))
      .toEqual(['何者を選択', '何者になるを選択', '彼は何者だったのかを選択', 'あなたは何者かを選択'])
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('cnt')).toBe('200')
  })

  test('検索に失敗したらエラーを表示する', async () => {
    searchFetch.mockRejectedValue(new Error('Network error'))
    await renderApp()

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '銀河鉄道' },
    })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('検索できませんでした')
  })

  test('一覧取得に失敗したら再試行できる', async () => {
    failingMethod = 'GET'
    await renderApp()

    expect(screen.getByRole('alert')).toHaveTextContent('記録を読み込めませんでした')
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), { target: { value: '川端康成' } })
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '追加' })).toBeEnabled()
  })

  test('登録に失敗したら入力を保ち、再試行でAPIに登録する', async () => {
    await renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), { target: { value: '川端康成' } })
    failingMethod = 'POST'

    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('登録できませんでした')
    expect(screen.getByRole('textbox', { name: '本のタイトル' })).toHaveValue('雪国')
    expect(apiBooks).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(await screen.findByText('雪国 / 川端康成')).toBeInTheDocument()
    expect(apiBooks).toHaveLength(1)
    expect(localStorage.getItem('book-insight-books')).toBeNull()
  })

  test('更新に失敗したら元の本と編集フォームを保つ', async () => {
    seedBooks([{ id: 1, title: '雪国', author: '川端康成', coverUrl: null, status: 'unread' }])
    await renderApp()
    showBooks('積読')
    openBook('雪国')
    fireEvent.click(screen.getByRole('button', { name: '読了にする' }))
    failingMethod = 'PATCH'

    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('読了記録を保存できませんでした')
    expect(screen.getByRole('form', { name: '雪国の読了記録' })).toBeInTheDocument()
    expect(within(screen.getByRole('listitem')).getByText('積読')).toBeInTheDocument()
    expect(apiBooks[0].status).toBe('unread')

    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('読了 · 3/5')).toBeInTheDocument()
  })

  test('削除に失敗したら本を残し、再試行で削除する', async () => {
    seedBooks([{ id: 1, title: '雪国', author: '川端康成', coverUrl: null, status: 'unread' }])
    await renderApp()
    showBooks('積読')
    openBook('雪国')
    failingMethod = 'DELETE'

    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('削除できませんでした')
    expect(screen.getByText('雪国 / 川端康成')).toBeInTheDocument()
    expect(apiBooks).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.queryByText('雪国 / 川端康成')).not.toBeInTheDocument())
    expect(apiBooks).toEqual([])
  })
})
