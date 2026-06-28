/* eslint-disable unicorn-x/no-await-expression-member, @typescript-eslint/require-await */

import { extractDataFromResponse, isPlainObject, normalizeUrl } from 'x-fetch'

test('isPlainObject', () => {
  expect(isPlainObject({})).toBe(true)
  expect(isPlainObject([])).toBe(false)
  expect(isPlainObject(0)).toBe(false)
  expect(isPlainObject(true)).toBe(false)
})

test('normalizeUrl', () => {
  expect(normalizeUrl('')).toBe('')
  expect(normalizeUrl('', { foo: 'bar' })).toBe('?foo=bar')
  expect(normalizeUrl('', { foo: ['bar', 'baz'] })).toBe('?foo=bar&foo=baz')
  expect(normalizeUrl('test?x=y')).toBe('test?x=y')
  expect(normalizeUrl('test?x=y', { foo: 'bar' })).toBe('test?x=y&foo=bar')
  expect(normalizeUrl('test?x=y', { foo: ['bar', 'baz'] })).toBe(
    'test?x=y&foo=bar&foo=baz',
  )
  expect(normalizeUrl('', { foo: ['bar', null, '', 'baz'] })).toBe(
    '?foo=bar&foo=baz',
  )
  expect(normalizeUrl('', { foo: null, bar: '' })).toBe('')
  expect(normalizeUrl('', 'foo=bar')).toBe('?foo=bar')
  expect(normalizeUrl('', new URLSearchParams('foo=bar'))).toBe('?foo=bar')
})

test('extractDataFromResponse', async () => {
  expect(await extractDataFromResponse(new Response(''), null)).toBe(undefined)
  expect(await extractDataFromResponse(new Response(), null)).toBe(undefined)
  expect(await extractDataFromResponse(new Response(), 'text')).toBe('')
  expect(await extractDataFromResponse(new Response(null), 'text')).toBe('')
  expect(await extractDataFromResponse(new Response('foo'), 'text')).toBe('foo')
  await expect(
    extractDataFromResponse(new Response('foo'), 'json'),
  ).rejects.toThrow(
    /^Unexpected token (('o', "foo" is not valid JSON)|(o in JSON at position 1))$/,
  )
  expect(await extractDataFromResponse(new Response('foo'), 'json', true)).toBe(
    'foo',
  )
  expect(
    await extractDataFromResponse(new Response('{"foo":"bar"}'), 'json'),
  ).toEqual({ foo: 'bar' })
  expect(
    (await extractDataFromResponse(new Response('foo'), 'arrayBuffer'))
      .byteLength,
  ).toBe(3)

  // binary type fallback when type method throws and fallback=true
  const res = new Response('fallback text')
  const clone = res.clone.bind(res)
  res.clone = () => {
    const c = clone()
    Object.defineProperty(c, 'arrayBuffer', {
      value: async () => {
        throw new Error('boom')
      },
    })
    return c
  }
  expect(await extractDataFromResponse(res, 'arrayBuffer', true)).toBe(
    'fallback text',
  )

  // binary type throws without fallback
  const res2 = new Response('x')
  const clone2 = res2.clone.bind(res2)
  res2.clone = () => {
    const c = clone2()
    Object.defineProperty(c, 'arrayBuffer', {
      value: async () => {
        throw new Error('boom')
      },
    })
    return c
  }
  await expect(extractDataFromResponse(res2, 'arrayBuffer')).rejects.toThrow(
    'boom',
  )
})
