// @vitest-environment node
import { once } from 'node:events'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { createApp } from './app.js'

let server
let baseUrl

beforeEach(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})

async function postBook(body) {
  return fetch(`${baseUrl}/api/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function patchBook(id, body) {
  return fetch(`${baseUrl}/api/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function deleteBook(id) {
  return fetch(`${baseUrl}/api/books/${id}`, { method: 'DELETE' })
}

test('DELETE removes only the requested book and returns no content', async () => {
  await postBook({ title: 'First', author: 'Author A' })
  await postBook({ title: 'Second', author: 'Author B' })
  await postBook({ title: 'Third', author: 'Author C' })

  const response = await deleteBook(2)

  expect(response.status).toBe(204)
  expect(await response.text()).toBe('')
  expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([
    { id: 1, title: 'First', author: 'Author A', coverUrl: null, status: 'unread' },
    { id: 3, title: 'Third', author: 'Author C', coverUrl: null, status: 'unread' },
  ])

  const newBook = await postBook({ title: 'Fourth', author: 'Author D' })
  expect((await newBook.json()).id).toBe(4)
})

test('DELETE returns 404 when the book does not exist or was already removed', async () => {
  await postBook({ title: 'First', author: 'Author A' })
  expect((await deleteBook(1)).status).toBe(204)

  for (const id of [1, 99]) {
    const response = await deleteBook(id)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Book not found' })
  }
  expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([])
})

test.each(['abc', '0', '-1', '1.0', '9007199254740992'])(
  'DELETE rejects invalid book ID %s without changing the list', async (id) => {
    const book = await (await postBook({ title: 'First', author: 'Author A' })).json()

    const response = await deleteBook(id)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Book ID must be a positive integer' })
    expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([book])
  },
)

test('本を登録すると201と積読の記録を返す', async () => {
  const response = await postBook({ title: ' 雪国 ', author: ' 川端康成 ' })

  expect(response.status).toBe(201)
  expect(response.headers.get('content-type')).toContain('application/json')
  expect(await response.json()).toEqual({
    id: 1,
    title: '雪国',
    author: '川端康成',
    coverUrl: null,
    status: 'unread',
  })

  const secondResponse = await postBook({ title: 'こころ', author: '夏目漱石' })
  expect((await secondResponse.json()).id).toBe(2)
})

test('本が未登録ならGETで空の一覧を返す', async () => {
  const response = await fetch(`${baseUrl}/api/books`)

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('application/json')
  expect(await response.json()).toEqual([])
})

test('POSTで登録した本をGETで登録順に取得できる', async () => {
  await postBook({ title: '雪国', author: '川端康成' })
  await postBook({ title: 'こころ', author: '夏目漱石' })

  const response = await fetch(`${baseUrl}/api/books`)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([
    { id: 1, title: '雪国', author: '川端康成', coverUrl: null, status: 'unread' },
    { id: 2, title: 'こころ', author: '夏目漱石', coverUrl: null, status: 'unread' },
  ])
})

test('書影URLつきの積読を登録できる', async () => {
  const coverUrl = 'https://covers.openlibrary.org/b/isbn/9784101001012-S.jpg?default=false'
  const response = await postBook({ title: '雪国', author: '川端康成', coverUrl })

  expect(response.status).toBe(201)
  expect(await response.json()).toEqual({
    id: 1, title: '雪国', author: '川端康成', coverUrl, status: 'unread',
  })
})

test('積読のタイトル・著者・書影だけを更新できる', async () => {
  await postBook({ title: ' 雪国 ', author: '川端康成' })
  const coverUrl = 'https://covers.openlibrary.org/b/isbn/9784101001012-S.jpg?default=false'

  const response = await patchBook(1, { title: ' 雪国 新版 ', author: ' 川端 康成 ', coverUrl })

  expect(response.status).toBe(200)
  const updated = {
    id: 1, title: '雪国 新版', author: '川端 康成', coverUrl, status: 'unread',
  }
  expect(await response.json()).toEqual(updated)
  expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([updated])
})

test('積読を評価・読了年・メモつきで読了にできる', async () => {
  const coverUrl = 'https://covers.openlibrary.org/b/isbn/9784101001012-S.jpg?default=false'
  await postBook({ title: '雪国', author: '川端康成', coverUrl })
  const readDate = { precision: 'year', value: '2020' }

  const response = await patchBook(1, {
    status: 'read', rating: 5, readDate, memo: ' また読みたい ',
  })

  expect(response.status).toBe(200)
  const updated = {
    id: 1, title: '雪国', author: '川端康成', coverUrl,
    rating: 5, readDate, memo: 'また読みたい', status: 'read',
  }
  expect(await response.json()).toEqual(updated)
  expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([updated])
})

test('読了にすると初期評価3を付け、後から読了記録だけ編集できる', async () => {
  await postBook({ title: 'こころ', author: '夏目漱石' })

  const completed = await patchBook(1, { status: 'read' })
  expect(await completed.json()).toEqual({
    id: 1, title: 'こころ', author: '夏目漱石', coverUrl: null,
    rating: 3, readDate: null, memo: '', status: 'read',
  })

  const readDate = { precision: 'day', value: '2024-02-29' }
  const edited = await patchBook(1, { rating: 4, readDate, memo: ' 再読したい ' })
  expect(edited.status).toBe(200)
  expect(await edited.json()).toEqual({
    id: 1, title: 'こころ', author: '夏目漱石', coverUrl: null,
    rating: 4, readDate, memo: '再読したい', status: 'read',
  })
})

test('更新対象のIDが不正または存在しない場合はエラーを返す', async () => {
  await postBook({ title: '雪国', author: '川端康成' })

  const invalidId = await patchBook('abc', { title: '変更後' })
  expect(invalidId.status).toBe(400)
  expect(await invalidId.json()).toEqual({ error: 'Book ID must be a positive integer' })

  const missingBook = await patchBook(999, { title: '変更後' })
  expect(missingBook.status).toBe(404)
  expect(await missingBook.json()).toEqual({ error: 'Book not found' })
})

test.each([
  [{}, 'Update must contain supported fields'],
  [null, 'Update must contain supported fields'],
  [[], 'Update must contain supported fields'],
  [{ unknown: true }, 'Update must contain supported fields'],
  [{ id: 2 }, 'Update must contain supported fields'],
  [{ title: '   ' }, 'Title and author must be non-empty strings'],
  [{ author: 3 }, 'Title and author must be non-empty strings'],
  [{ status: 'reading' }, 'Status must be unread or read'],
  [{ coverUrl: 'javascript:alert(1)' }, 'Cover URL must be an HTTP(S) URL or null'],
  [{ rating: 3 }, 'Unread books cannot have read details'],
])('積読への不正なPATCHは元の本を変えない: %j', async (body, error) => {
  const original = await (await postBook({ title: '雪国', author: '川端康成' })).json()

  const response = await patchBook(1, body)

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error })
  expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([original])
})

test.each([
  [{ status: 'unread' }, 'Read books cannot return to unread'],
  [{ rating: 0 }, 'Rating must be an integer from 1 to 5'],
  [{ readDate: { precision: 'day', value: '2024-02-30' } }, 'Read date must be a valid day, year, or null'],
  [{ memo: 3 }, 'Memo must be a string'],
])('読了記録への不正なPATCHは元の本を変えない: %j', async (body, error) => {
  const original = await (await postBook({
    title: '雪国', author: '川端康成', status: 'read', rating: 5,
  })).json()

  const response = await patchBook(1, body)

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error })
  expect(await (await fetch(`${baseUrl}/api/books`)).json()).toEqual([original])
})

test('読了を詳細なしで登録すると評価3・時期不明・空のメモになる', async () => {
  const response = await postBook({ title: 'こころ', author: '夏目漱石', status: 'read' })

  expect(response.status).toBe(201)
  expect(await response.json()).toEqual({
    id: 1, title: 'こころ', author: '夏目漱石', coverUrl: null,
    rating: 3, readDate: null, memo: '', status: 'read',
  })
})

test.each([
  { precision: 'year', value: '2019' },
  { precision: 'day', value: '2024-02-29' },
])('読了時期 %j と評価・メモ・書影を登録できる', async (readDate) => {
  const coverUrl = 'https://covers.openlibrary.org/b/isbn/9784101001012-S.jpg?default=false'
  const response = await postBook({
    title: '雪国', author: '川端康成', coverUrl, status: 'read',
    rating: 5, readDate, memo: ' また読みたい ',
  })

  expect(response.status).toBe(201)
  expect(await response.json()).toEqual({
    id: 1, title: '雪国', author: '川端康成', coverUrl,
    rating: 5, readDate, memo: 'また読みたい', status: 'read',
  })
  const list = await fetch(`${baseUrl}/api/books`)
  expect(await list.json()).toHaveLength(1)
})

test.each([
  [{ status: 'reading' }, 'Status must be unread or read'],
  [{ coverUrl: 'javascript:alert(1)' }, 'Cover URL must be an HTTP(S) URL or null'],
  [{ coverUrl: 123 }, 'Cover URL must be an HTTP(S) URL or null'],
  [{ status: 'unread', rating: 3 }, 'Unread books cannot have read details'],
  [{ status: 'read', rating: 0 }, 'Rating must be an integer from 1 to 5'],
  [{ status: 'read', rating: 2.5 }, 'Rating must be an integer from 1 to 5'],
  [{ status: 'read', readDate: { precision: 'year', value: '20' } }, 'Read date must be a valid day, year, or null'],
  [{ status: 'read', readDate: { precision: 'day', value: '2024-02-30' } }, 'Read date must be a valid day, year, or null'],
  [{ status: 'read', memo: 123 }, 'Memo must be a string'],
])('登録内容が不正なら保存しない: %j', async (details, error) => {
  const response = await postBook({ title: '雪国', author: '川端康成', ...details })

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error })
  const list = await fetch(`${baseUrl}/api/books`)
  expect(await list.json()).toEqual([])
  const validResponse = await postBook({ title: 'こころ', author: '夏目漱石' })
  expect((await validResponse.json()).id).toBe(1)
})

test.each([
  { title: '', author: '川端康成' },
  { title: '雪国', author: '   ' },
  { title: 123, author: '川端康成' },
  { title: '雪国' },
  null,
])('タイトル・著者が不正なら400を返す: %j', async (body) => {
  const response = await postBook(body)

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'Title and author must be non-empty strings' })

  const validResponse = await postBook({ title: '雪国', author: '川端康成' })
  expect((await validResponse.json()).id).toBe(1)
})

test('壊れたJSONなら400とJSONのエラーを返す', async () => {
  const response = await fetch(`${baseUrl}/api/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  })

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'Malformed JSON' })
})
