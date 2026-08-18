import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import App from './App'

describe('App', () => {
  test('Book Insightという見出しを表示する', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Book Insight' })).toBeInTheDocument()
  })
})
