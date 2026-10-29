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

test('本を登録すると201と積読の記録を返す', async () => {
  const response = await postBook({ title: ' 雪国 ', author: ' 川端康成 ' })

  expect(response.status).toBe(201)
  expect(response.headers.get('content-type')).toContain('application/json')
  expect(await response.json()).toEqual({
    id: 1,
    title: '雪国',
    author: '川端康成',
    status: 'unread',
  })

  const secondResponse = await postBook({ title: 'こころ', author: '夏目漱石' })
  expect((await secondResponse.json()).id).toBe(2)
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
