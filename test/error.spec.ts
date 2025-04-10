/* eslint-disable @typescript-eslint/no-magic-numbers, @typescript-eslint/require-await */

import { createXFetch, ResponseError } from 'x-fetch'

function assertResponseError<T>(err: unknown): asserts err is ResponseError<T> {
  if (!(err instanceof ResponseError)) {
    throw new TypeError('Expected ResponseError')
  }
}

test('throws ResponseError for 404 response', async () => {
  // Create a mock fetch function that returns a 404 response
  const mockFetch = async () =>
    new Response('Not Found', { status: 404, statusText: 'Not Found' })

  // Create a custom xfetch using our mock fetch
  const { xfetch } = createXFetch(mockFetch)

  // Test that it throws a ResponseError with the correct message
  await expect(
    xfetch('https://example.com/not-found'),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Not Found]`)

  // Test with try/catch to inspect error properties
  try {
    await xfetch('https://example.com/not-found')
  } catch (error) {
    expect(error).toBeInstanceOf(ResponseError)
    assertResponseError<string>(error)
    expect(error.response.status).toBe(404)
    expect(error.message).toBe('Not Found')
    expect(error.request.url).toBe('https://example.com/not-found')
    expect(error.data).toBe('Not Found')
  }
})

test('throws ResponseError with JSON data for 500 response', async () => {
  // Create a JSON error body
  const errorBody = JSON.stringify({ error: 'Server Error', code: 500 })

  // Create a mock fetch function that returns a 500 response
  const mockFetch = async () =>
    new Response(errorBody, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'application/json' },
    })

  // Create a custom xfetch using our mock fetch
  const { xfetch } = createXFetch(mockFetch)

  // Test that it throws a ResponseError with the correct message
  await expect(
    xfetch('https://example.com/api'),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Internal Server Error]`)

  // Test with try/catch to inspect error properties
  try {
    await xfetch('https://example.com/api')
  } catch (error) {
    assertResponseError<{ error: string; code: number }>(error)
    expect(error).toBeInstanceOf(ResponseError)
    expect(error.response.status).toBe(500)
    expect(error.message).toBe('Internal Server Error')
    expect(error.data).toEqual({ error: 'Server Error', code: 500 })
  }
})

test('handles invalid JSON in error response', async () => {
  // Create an invalid JSON body
  const invalidJson = '{ "invalid": json }'

  // Create a mock fetch function that returns a 400 response with invalid JSON
  const mockFetch = async () =>
    new Response(invalidJson, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/json' },
    })

  // Create a custom xfetch using our mock fetch
  const { xfetch } = createXFetch(mockFetch)

  // Test with try/catch to inspect error properties
  try {
    await xfetch('https://example.com/api')
  } catch (error) {
    assertResponseError<string>(error)
    expect(error).toBeInstanceOf(ResponseError)
    expect(error.response.status).toBe(400)
    expect(error.message).toBe('Bad Request')
    // Should fallback to the raw text when JSON parsing fails
    expect(typeof error.data).toBe('string')
    expect(error.data).toBe(invalidJson)
  }
})
