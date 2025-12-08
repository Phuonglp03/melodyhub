module.exports = {
  // Exclude Vitest test files - these are run separately with Vitest
  testPathIgnorePatterns: [
    '/node_modules/',
    // Exclude all Vitest test files
    'LickCommunityPage.test.js',
    'ProjectListPage.test.js',
    'UserFeed.test.js',
    'projectHelpers.test.js',
    'timelineHelpers.test.js',
    // Exclude test setup file for Vitest
    'src/test/setup.js'
  ],
  // Only match Jest test files (not Vitest ones)
  testMatch: [
    '**/__tests__/**/*.js?(x)',
    '**/?(*.)(spec|test).js?(x)'
  ],
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(vitest|@vitest)/)'
  ],
  // Custom test environment
  testEnvironment: 'jsdom',
  // Setup files (only if exists)
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'].filter(Boolean),
  // Module name mapper for CSS and other assets
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
  }
};

