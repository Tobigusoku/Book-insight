import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import App from './App'

describe('App', () => {
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

  test('本のタイトルと感想を追加して入力欄を空にする', () => {
    render(<App />)

    const titleInput = screen.getByRole('textbox', { name: '本のタイトル' })
    const memoInput = screen.getByRole('textbox', { name: '感想・メモ' })
    fireEvent.change(titleInput, { target: { value: '銀河鉄道の夜' } })
    fireEvent.change(memoInput, { target: { value: '想像力を刺激される物語だった' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const bookItem = screen.getByRole('listitem')
    expect(bookItem).toHaveTextContent('銀河鉄道の夜')
    expect(bookItem).toHaveTextContent('想像力を刺激される物語だった')
    expect(titleInput).toHaveValue('')
    expect(memoInput).toHaveValue('')
  })
})
