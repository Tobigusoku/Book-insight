async function request(path, options) {
  const response = await fetch(path, options)
  if (!response.ok) throw new Error(`Book API request failed: ${response.status}`)
  if (response.status === 204) return null
  return response.json()
}

export function getBooks() {
  return request('/api/books')
}

export function createBook(book) {
  return request('/api/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  })
}

export function updateBook(id, changes) {
  return request(`/api/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
}

export function removeBook(id) {
  return request(`/api/books/${id}`, { method: 'DELETE' })
}
