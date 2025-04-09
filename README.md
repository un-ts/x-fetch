# x-fetch

[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/un-ts/x-fetch/ci.yml?branch=main)](https://github.com/un-ts/x-fetch/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov](https://img.shields.io/codecov/c/github/un-ts/x-fetch.svg)](https://codecov.io/gh/un-ts/x-fetch)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fun-ts%2Fx-fetch%2Fmain%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/un-ts/x-fetch)](https://coderabbit.ai)
[![npm](https://img.shields.io/npm/v/x-fetch.svg)](https://www.npmjs.com/package/x-fetch)
[![GitHub Release](https://img.shields.io/github/release/un-ts/x-fetch)](https://github.com/un-ts/x-fetch/releases)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/changesets/changesets)

A simple but elegant `fetch` API wrapper with less than `850B` minified and brotlied, use `fetch` like a charm

## TOC <!-- omit in toc -->

- [Usage](#usage)
  - [Install](#install)
  - [API](#api)
- [Sponsors](#sponsors)
- [Backers](#backers)
- [Changelog](#changelog)
- [License](#license)

## Usage

### Install

```sh
# pnpm
pnpm add x-fetch

# yarn
yarn add x-fetch

# npm
npm i x-fetch
```

### API

```ts
import { ApiMethod, createFetchApi, fetchApi, interceptors } from 'x-fetch'

// plain url, GET method
await fetchApi('url')

// with options, `method`, `body`, `query`, etc.
await fetchApi('url', {
  method: ApiMethod.POST, // or 'POST'
  // plain object or array, or BodyInit
  body: {},
  // URLSearchParametersOptions
  query: {
    key: 'value',
  },
  // json: boolean, // whether auto stringify body to json, default true for plain object or array, otherwise false
  // type: 'arrayBuffer' | 'blob' | 'json' | 'text' | null, `null` means plain `Response`
})

const interceptor: ApiInterceptor = (req, next) => {
  // do something with req
  const res = await next(req)
  // do something with res
  return res
}

// add interceptor
interceptors.use(interceptor)

// remove interceptor
interceptors.eject(interceptor)

// create a new isolated `fetchApi` with its own `interceptors`
const { fetchApi, interceptors } = createFetchApi()
```

[![Sponsors](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

## Sponsors

| 1stG                                                                                                                   | RxTS                                                                                                                   | UnTS                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

## Backers

| 1stG                                                                                                                | RxTS                                                                                                                | UnTS                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stG.me]: https://www.1stG.me
[JounQin]: https://GitHub.com/JounQin
[MIT]: http://opensource.org/licenses/MIT
