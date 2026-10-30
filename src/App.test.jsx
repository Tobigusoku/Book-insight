import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.removeItem('book-insight-books')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('Book Insightという見出しを表示する', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Book Insight' })).toBeInTheDocument()
  })

  test('入力した本のタイトルを保持する', () => {
    render(<App />)

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })

    expect(titleInput).toHaveValue('銀河鉄道の夜')
  })

  test('タイトルと著者を登録し、入力欄を空にする', () => {
    render(<App />)

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    fireEvent.change(titleInput, { target: { value: ' 銀河鉄道の夜 ' } })
    fireEvent.change(authorInput, { target: { value: ' 宮沢賢治 ' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const bookItem = screen.getByRole('listitem')
    expect(bookItem).toHaveTextContent('銀河鉄道の夜 / 宮沢賢治')
    expect(within(bookItem).getByText('積読')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      title: '銀河鉄道の夜',
      author: '宮沢賢治',
      status: 'unread',
    })
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).not.toHaveProperty('memo')
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].coverUrl).toBeNull()
    expect(within(bookItem).getByText('書影なし')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '感想・メモ' })).not.toBeInTheDocument()
    expect(titleInput).toHaveValue('')
    expect(authorInput).toHaveValue('')
  })

  test('タイトルと著者の両方がないと追加できない', () => {
    render(<App />)

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

  test('新規登録で読了を選ぶと評価3と今日の日付で保存する', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 1, 12))
    const { unmount } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '読了' }))
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

    const bookItem = screen.getByRole('listitem')
    expect(within(bookItem).getByText('読了 · 3/5')).toBeInTheDocument()
    expect(within(bookItem).getByText('2024-06-01')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      title: '銀河鉄道の夜',
      author: '宮沢賢治',
      status: 'read',
      rating: 3,
      readDate: { precision: 'day', value: '2024-06-01' },
      memo: '',
    })
    expect(screen.getByRole('button', { name: '積読' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('form', { name: '新しい本の読了記録' })).not.toBeInTheDocument()

    unmount()
    render(<App />)
    expect(screen.getByText('読了 · 3/5')).toBeInTheDocument()
  })

  test('読了として新規登録するとき年のみ・評価・メモを選べる', () => {
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: 'こころ' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '夏目漱石' },
    })
    fireEvent.click(screen.getByRole('button', { name: '読了' }))

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

    expect(screen.getByText('読了 · 5/5')).toBeInTheDocument()
    expect(screen.getByText('2019年')).toBeInTheDocument()
    expect(screen.getByText('また読みたい')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      status: 'read',
      rating: 5,
      readDate: { precision: 'year', value: '2019' },
      memo: 'また読みたい',
    })
  })

  test('読了登録をキャンセルすると積読として追加できる', () => {
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '雪国' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '川端康成' },
    })
    fireEvent.click(screen.getByRole('button', { name: '読了' }))
    const form = screen.getByRole('form', { name: '新しい本の読了記録' })
    fireEvent.change(within(form).getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: '保存しないメモ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const book = JSON.parse(localStorage.getItem('book-insight-books'))[0]
    expect(book.status).toBe('unread')
    expect(book).not.toHaveProperty('memo')
    expect(within(screen.getByRole('listitem')).getByText('積読')).toBeInTheDocument()
  })

  test('選んだ本だけを削除する', () => {
    render(<App />)

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    const addButton = screen.getByRole('button', { name: '追加' })

    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })
    fireEvent.change(authorInput, { target: { value: '宮沢賢治' } })
    fireEvent.click(addButton)
    fireEvent.change(titleInput, { target: { value: 'こころ' } })
    fireEvent.change(authorInput, { target: { value: '夏目漱石' } })
    fireEvent.click(addButton)

    const firstBook = screen.getAllByRole('listitem')[0]
    fireEvent.click(within(firstBook).getByRole('button', { name: '削除' }))

    expect(screen.queryByText('銀河鉄道の夜 / 宮沢賢治')).not.toBeInTheDocument()
    expect(screen.getByText('こころ / 夏目漱石')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  test('追加と削除した本を保存し、再表示後も復元する', () => {
    const { unmount } = render(<App />)
    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const authorInput = screen.getByRole('textbox', { name: '著者' })
    const addButton = screen.getByRole('button', { name: '追加' })

    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })
    fireEvent.change(authorInput, { target: { value: '宮沢賢治' } })
    fireEvent.click(addButton)
    fireEvent.change(titleInput, { target: { value: 'こころ' } })
    fireEvent.change(authorInput, { target: { value: '夏目漱石' } })
    fireEvent.click(addButton)

    expect(JSON.parse(localStorage.getItem('book-insight-books'))).toHaveLength(2)

    unmount()
    render(<App />)
    expect(screen.getByText('銀河鉄道の夜 / 宮沢賢治')).toBeInTheDocument()
    expect(screen.getByText('こころ / 夏目漱石')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((item) => within(item).queryByText('積読'))).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem('book-insight-books')).map((book) => book.status))
      .toEqual(['unread', 'unread'])

    const restoredTitleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const restoredAuthorInput = screen.getByRole('textbox', { name: '著者' })
    fireEvent.change(restoredTitleInput, { target: { value: '人間失格' } })
    fireEvent.change(restoredAuthorInput, { target: { value: '太宰治' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const books = JSON.parse(localStorage.getItem('book-insight-books'))
    expect(books).toHaveLength(3)
    expect(books.map((book) => book.author)).toEqual(['宮沢賢治', '夏目漱石', '太宰治'])
    expect(new Set(books.map((book) => book.id)).size).toBe(3)

    const bookToDelete = screen.getAllByRole('listitem')[1]
    fireEvent.click(within(bookToDelete).getByRole('button', { name: '削除' }))

    expect(JSON.parse(localStorage.getItem('book-insight-books')).map((book) => book.title))
      .toEqual(['銀河鉄道の夜', '人間失格'])
  })

  test('以前保存した著者なしの本とメモも表示する', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: '銀河鉄道の夜', memo: '読後の感想' },
    ]))

    render(<App />)

    const bookItem = screen.getByRole('listitem')
    expect(bookItem).toHaveTextContent('銀河鉄道の夜')
    expect(within(bookItem).getByText('積読')).toBeInTheDocument()
    expect(bookItem).toHaveTextContent('読後の感想')
    expect(bookItem).not.toHaveTextContent('undefined')
  })

  test('積読を読了にすると初期評価3と今日の日付を保存し、再表示後も残る', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 1, 12))
    const { unmount } = render(<App />)

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '銀河鉄道の夜' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '著者' }), {
      target: { value: '宮沢賢治' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const bookItem = screen.getByRole('listitem')
    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const form = within(bookItem).getByRole('form', { name: '銀河鉄道の夜の読了記録' })
    expect(within(form).getByRole('combobox', { name: '評価' })).toHaveValue('3')
    expect(within(form).getByLabelText('読了日')).toHaveValue('2024-06-01')
    fireEvent.click(within(form).getByRole('button', { name: '保存' }))

    expect(within(bookItem).getByText('読了 · 3/5')).toBeInTheDocument()
    expect(within(bookItem).getByText('2024-06-01')).toBeInTheDocument()
    expect(within(bookItem).queryByRole('button', { name: '読了にする' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      status: 'read',
      rating: 3,
      readDate: { precision: 'day', value: '2024-06-01' },
      memo: '',
    })

    unmount()
    render(<App />)
    expect(screen.getByText('読了 · 3/5')).toBeInTheDocument()
    expect(screen.getByText('2024-06-01')).toBeInTheDocument()
  })

  test('読了時期を年のみで記録し、評価と感想も保存できる', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'unread' },
    ]))
    render(<App />)

    const bookItem = screen.getByRole('listitem')
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

    expect(within(bookItem).getByText('読了 · 5/5')).toBeInTheDocument()
    expect(within(bookItem).getByText('2020年')).toBeInTheDocument()
    expect(within(bookItem).getByText('また読みたい')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      status: 'read',
      rating: 5,
      readDate: { precision: 'year', value: '2020' },
      memo: 'また読みたい',
    })
  })

  test('読了時期を不明にでき、キャンセル時は積読のままにする', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: '雪国', author: '川端康成', status: 'unread' },
    ]))
    render(<App />)

    const bookItem = screen.getByRole('listitem')
    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const form = within(bookItem).getByRole('form', { name: '雪国の読了記録' })
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))
    expect(within(bookItem).getByText('積読')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].status).toBe('unread')

    fireEvent.click(within(bookItem).getByRole('button', { name: '読了にする' }))
    const reopenedForm = within(bookItem).getByRole('form', { name: '雪国の読了記録' })
    fireEvent.change(within(reopenedForm).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'unknown' },
    })
    expect(within(reopenedForm).queryByLabelText('読了日')).not.toBeInTheDocument()
    fireEvent.click(within(reopenedForm).getByRole('button', { name: '保存' }))

    expect(within(bookItem).getByText('読了時期不明')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].readDate).toBeNull()
  })

  test('読了年が空なら保存しない', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: '雪国', author: '川端康成', status: 'unread' },
    ]))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '読了にする' }))
    const form = screen.getByRole('form', { name: '雪国の読了記録' })
    fireEvent.change(within(form).getByRole('combobox', { name: '読了時期' }), {
      target: { value: 'year' },
    })
    fireEvent.change(within(form).getByLabelText('読了年'), { target: { value: '' } })
    fireEvent.submit(form)

    expect(within(screen.getByRole('listitem')).getByText('積読')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].status).toBe('unread')
  })

  test('選んだ本だけを読了にする', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'unread' },
      { id: 2, title: '雪国', author: '川端康成', status: 'unread' },
    ]))
    render(<App />)

    const [firstBook, secondBook] = screen.getAllByRole('listitem')
    fireEvent.click(within(firstBook).getByRole('button', { name: '読了にする' }))
    fireEvent.click(within(firstBook).getByRole('button', { name: '保存' }))

    expect(within(firstBook).getByText('読了 · 3/5')).toBeInTheDocument()
    expect(within(secondBook).getByText('積読')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books')).map((book) => book.status))
      .toEqual(['read', 'unread'])
  })

  test('読了済みの評価・読了時期・メモを編集して保存できる', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
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
    ]))
    const { unmount } = render(<App />)

    const [firstBook, secondBook] = screen.getAllByRole('listitem')
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

    expect(within(firstBook).getByText('読了 · 2/5')).toBeInTheDocument()
    expect(within(firstBook).getByText('2023-04-05')).toBeInTheDocument()
    expect(within(firstBook).getByText('新しい感想')).toBeInTheDocument()
    expect(within(secondBook).getByText('積読')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      title: 'こころ',
      author: '夏目漱石',
      status: 'read',
      rating: 2,
      readDate: { precision: 'day', value: '2023-04-05' },
      memo: '新しい感想',
    })

    unmount()
    render(<App />)
    expect(screen.getByText('読了 · 2/5')).toBeInTheDocument()
    expect(screen.getByText('新しい感想')).toBeInTheDocument()
  })

  test('読了済みの編集をキャンセルすると保存済みの値を保つ', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      {
        id: 1,
        title: '雪国',
        author: '川端康成',
        status: 'read',
        rating: 3,
        readDate: null,
        memo: '元の感想',
      },
    ]))
    render(<App />)

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
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].rating).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: '読了記録を編集' }))
    expect(screen.getByRole('combobox', { name: '評価' })).toHaveValue('3')
    expect(screen.getByRole('textbox', { name: '感想・メモ（任意）' })).toHaveValue('元の感想')
  })

  test('タイトルと著者を編集し、読了記録を保ったまま保存できる', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
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
    ]))
    const { unmount } = render(<App />)

    const [firstBook, secondBook] = screen.getAllByRole('listitem')
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

    expect(within(firstBook).getByText('こころ 改訂版 / 夏目 漱石')).toBeInTheDocument()
    expect(within(firstBook).getByText('読了 · 5/5')).toBeInTheDocument()
    expect(within(firstBook).getByText('印象に残った')).toBeInTheDocument()
    expect(within(secondBook).getByText('雪国 / 川端康成')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      title: 'こころ 改訂版',
      author: '夏目 漱石',
      status: 'read',
      rating: 5,
      readDate: { precision: 'year', value: '2020' },
      memo: '印象に残った',
    })

    unmount()
    render(<App />)
    expect(screen.getByText('こころ 改訂版 / 夏目 漱石')).toBeInTheDocument()
  })

  test('空白だけのタイトル・著者は保存できず、キャンセルすると元に戻る', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: '雪国', author: '川端康成', status: 'unread' },
    ]))
    render(<App />)

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
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].title).toBe('雪国')
    fireEvent.click(within(form).getByRole('button', { name: 'キャンセル' }))

    expect(screen.getByText('雪国 / 川端康成')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'タイトル・著者を編集' }))
    const reopenedForm = screen.getByRole('form', { name: '雪国のタイトルと著者を編集' })
    expect(within(reopenedForm).getByRole('textbox', { name: '本のタイトル' })).toHaveValue('雪国')
    expect(within(reopenedForm).getByRole('textbox', { name: '著者' })).toHaveValue('川端康成')
  })

  test('タイトル編集を開くと未保存の読了フォームは閉じる', () => {
    localStorage.setItem('book-insight-books', JSON.stringify([
      { id: 1, title: 'こころ', author: '夏目漱石', status: 'read', rating: 3, readDate: null, memo: '元のメモ' },
    ]))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '読了記録を編集' }))
    fireEvent.change(screen.getByRole('textbox', { name: '感想・メモ（任意）' }), {
      target: { value: '未保存のメモ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'タイトル・著者を編集' }))

    expect(screen.queryByRole('form', { name: 'こころの読了記録を編集' })).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'こころのタイトルと著者を編集' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].memo).toBe('元のメモ')
  })

  test('本を検索して候補から読了として登録できる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

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

    fireEvent.click(screen.getByRole('button', { name: '読了' }))
    fireEvent.click(within(screen.getByRole('form', { name: '新しい本の読了記録' })).getByRole('button', { name: '追加' }))
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      title: '成瀬は天下を取りにいく',
      author: '宮島未奈',
      coverUrl: 'https://covers.openlibrary.org/b/isbn/9784103549512-S.jpg?default=false',
      status: 'read',
      rating: 3,
    })
    expect(within(screen.getByRole('listitem')).getByRole('img', { name: '成瀬は天下を取りにいくの書影' }))
      .toHaveAttribute('src', 'https://covers.openlibrary.org/b/isbn/9784103549512-S.jpg?default=false')
  })

  test('積読に登録した書影は再表示後も残り、画像取得に失敗したら代替表示にする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
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
    }))
    const { unmount } = render(<App />)

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), { target: { value: '雪国' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))
    fireEvent.click(await screen.findByRole('button', { name: '雪国を選択' }))
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const coverUrl = 'https://covers.openlibrary.org/b/isbn/9784101001012-S.jpg?default=false'
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].coverUrl).toBe(coverUrl)
    const bookItem = screen.getByRole('listitem')
    expect(within(bookItem).getByRole('img', { name: '雪国の書影' })).toHaveAttribute('src', coverUrl)

    unmount()
    render(<App />)
    const restoredImage = within(screen.getByRole('listitem')).getByRole('img', { name: '雪国の書影' })
    expect(restoredImage).toHaveAttribute('src', coverUrl)
    fireEvent.error(restoredImage)
    expect(within(screen.getByRole('listitem')).getByText('書影なし')).toBeInTheDocument()
  })

  test('候補を選んだ後にタイトルを手入力で変えると元の書影を保存しない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
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
    }))
    render(<App />)

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    fireEvent.change(titleInput, { target: { value: '雪国' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))
    fireEvent.click(await screen.findByRole('button', { name: '雪国を選択' }))
    fireEvent.change(titleInput, { target: { value: '別の本' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0].coverUrl).toBeNull()
    expect(within(screen.getByRole('listitem')).getByText('書影なし')).toBeInTheDocument()
  })

  test('雪国を検索したら無関係な題名を除き、完全一致を先に表示する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel>
          <item><title>哀愁のムードサックス歌謡ベスト</title><guid>cd</guid></item>
          <item><title>雪国の文学</title><guid>related</guid></item>
          <item><title>雪国</title><guid>exact</guid></item>
        </channel></rss>`,
    }))
    render(<App />)

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '雪国' },
    })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    const results = await screen.findAllByRole('button', { name: /を選択$/ })
    expect(results.map((button) => button.getAttribute('aria-label')))
      .toEqual(['雪国を選択', '雪国の文学を選択'])
  })

  test('何者を検索したら先頭一致を途中一致より優先する', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel>
          <item><title>彼は何者だったのか</title><guid>middle-1</guid></item>
          <item><title>あなたは何者か</title><guid>middle-2</guid></item>
          <item><title>何者になる</title><guid>prefix</guid></item>
          <item><title>何者</title><guid>exact</guid></item>
        </channel></rss>`,
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

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
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<App />)

    fireEvent.change(screen.getByRole('textbox', { name: '本のタイトル' }), {
      target: { value: '銀河鉄道' },
    })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('検索できませんでした')
  })
})
