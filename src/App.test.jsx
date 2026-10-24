import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.removeItem('book-insight-books')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).toMatchObject({
      title: '銀河鉄道の夜',
      author: '宮沢賢治',
    })
    expect(JSON.parse(localStorage.getItem('book-insight-books'))[0]).not.toHaveProperty('memo')
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
    expect(bookItem).toHaveTextContent('読後の感想')
    expect(bookItem).not.toHaveTextContent('undefined')
  })

  test('本を検索して候補のタイトルを選べる', async () => {
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
