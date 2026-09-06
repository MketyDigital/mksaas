/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src/'],
  testMatch: ['**/*.(test|spec).ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx'],
  coverageDirectory: '<rootDir>/coverage/',
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}', '!**/__mocks__/**', '!**/node_modules/**', '!**/*.d.ts'],
  coverageThreshold: {
    global: {
      branches: 6,
      functions: 7,
      lines: 12,
      statements: 12,
    },
  },
  moduleNameMapper: {
    '^.+\\.module\\.(css|sass|scss|less)$': 'identity-obj-proxy',
    '^.+\\.(css|sass|scss|less)$': '<rootDir>/__mocks__/styleMock.js',
    '^.+\\.(jpg|jpeg|png|gif|webp|avif|svg|ttf|woff|woff2)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(next-intl|use-intl|next-themes|@heroicons|lucide-react|drizzle-orm)/)',
  ],
  verbose: true,
  testTimeout: 30000,
};
