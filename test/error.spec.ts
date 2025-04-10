/* eslint-disable @typescript-eslint/no-magic-numbers, @typescript-eslint/require-await */

import { createFetchApi, ResponseError } from 'x-fetch'

const assertResponseError = <T>(err: unknown): ResponseError<T> => {
  if (!(err instanceof ResponseError)) {
    throw new TypeError('Expected ResponseError')
  }
  return err as ResponseError<T>
}

test('throws ResponseError for 404 response', async () => {
  // Create a mock fetch function that returns a 404 response
  const mockFetch = async () =>
    new Response('Not Found', { status: 404, statusText: 'Not Found' })

  // Create a custom fetchApi using our mock fetch
  const { fetchApi } = createFetchApi(mockFetch)

  // Test that it throws a ResponseError with the correct message
  await expect(
    fetchApi('https://example.com/not-found'),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Not Found]`)

  // Test with try/catch to inspect error properties
  try {
    await fetchApi('https://example.com/not-found')
  } catch (err) {
    expect(err).toBeInstanceOf(ResponseError)
    const error = assertResponseError<string>(err)
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

  // Create a custom fetchApi using our mock fetch
  const { fetchApi } = createFetchApi(mockFetch)

  // Test that it throws a ResponseError with the correct message
  await expect(
    fetchApi('https://example.com/api'),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Internal Server Error]`)

  // Test with try/catch to inspect error properties
  try {
    await fetchApi('https://example.com/api')
  } catch (err) {
    const error = assertResponseError<{ error: string; code: number }>(err)
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

  // Create a custom fetchApi using our mock fetch
  const { fetchApi } = createFetchApi(mockFetch)

  // Test with try/catch to inspect error properties
  try {
    await fetchApi('https://example.com/api')
  } catch (err) {
    const error = assertResponseError<string>(err)
    expect(error).toBeInstanceOf(ResponseError)
    expect(error.response.status).toBe(400)
    expect(error.message).toBe('Bad Request')
    // Should fallback to the raw text when JSON parsing fails
    expect(typeof error.data).toBe('string')
    expect(error.data).toBe(invalidJson)
  }
})
