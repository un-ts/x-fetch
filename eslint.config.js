import base from '@1stg/eslint-config'

export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@eslint-react/jsx-uses-react': 'off',
      'sonarjs/no-redundant-optional': 'off',
    },
  },
]
