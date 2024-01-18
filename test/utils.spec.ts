/* eslint-disable unicorn/no-await-expression-member */

import {
  cleanNilValues,
  extractDataFromResponse,
  isPlainObject,
  normalizeUrl,
} from 'x-fetch'

test('isPlainObject', () => {
  expect(isPlainObject({})).toBe(true)
  expect(isPlainObject([])).toBe(false)
  expect(isPlainObject(0)).toBe(false)
  expect(isPlainObject(true)).toBe(false)
})

test('cleanNilValues', () => {
  expect(cleanNilValues('')).toBe('')
  expect(cleanNilValues(true)).toBe(true)
  expect(cleanNilValues({ foo: 'bar' })).toEqual({ foo: 'bar' })
  expect(cleanNilValues({ foo: 'bar', test: null })).toEqual({ foo: 'bar' })
  expect(cleanNilValues({ foo: 'bar', test: '' })).toEqual({
    foo: 'bar',
    test: '',
  })
  expect(cleanNilValues({ foo: 'bar', test: '' }, true)).toEqual({ foo: 'bar' })
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
})

test('extractDataFromResponse', async () => {
  expect(await extractDataFromResponse(new Response(''), null)).toBe(undefined)
  expect(await extractDataFromResponse(new Response(), null)).toBe(undefined)
  expect(await extractDataFromResponse(new Response(), 'text')).toBe('')
  expect(await extractDataFromResponse(new Response(null), 'text')).toBe('')
  expect(await extractDataFromResponse(new Response('foo'), 'text')).toBe('foo')
  expect(await extractDataFromResponse(new Response('foo'), 'json')).toBe('foo')
  expect(
    await extractDataFromResponse(new Response('{"foo":"bar"}'), 'json'),
  ).toEqual({ foo: 'bar' })
  expect(
    (await extractDataFromResponse(new Response('foo'), 'arrayBuffer'))
      .byteLength,
  ).toBe(3)
})
