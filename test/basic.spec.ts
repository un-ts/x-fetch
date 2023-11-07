import { type ApiInterceptor, fetchApi, interceptors } from 'fetch-api'

test('it should just work', async () => {
  expect(
    await fetchApi<{
      id: number
      userId: number
    }>('https://jsonplaceholder.typicode.com/todos/1'),
  ).toMatchInlineSnapshot(`
    {
      "completed": false,
      "id": 1,
      "title": "delectus aut autem",
      "userId": 1,
    }
  `)
})

test('interceptors should just work', async () => {
  const interceptor: ApiInterceptor = (req, next) => {
    if (!/^https?:\/\//.test(req.url)) {
      req.url =
        'https://jsonplaceholder.typicode.com' +
        (req.url.startsWith('/') ? '' : '/') +
        req.url
    }
    return next(req)
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  expect(() => fetchApi('/todos/1')).rejects.toMatchInlineSnapshot(
    '[TypeError: Failed to parse URL from /todos/1]',
  )

  interceptors.use(interceptor)

  expect(
    await fetchApi<{
      id: number
      userId: number
    }>('todos/1'),
  ).toMatchInlineSnapshot(`
    {
      "completed": false,
      "id": 1,
      "title": "delectus aut autem",
      "userId": 1,
    }
  `)

  expect(interceptors.eject(interceptor)).toBe(true)
  expect(interceptors.eject(interceptor)).toBe(false)

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  expect(() => fetchApi('/todos/1')).rejects.toMatchInlineSnapshot(
    '[TypeError: Failed to parse URL from /todos/1]',
  )
})
