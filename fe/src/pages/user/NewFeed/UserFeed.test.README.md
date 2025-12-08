# UserFeed Unit Tests

This file contains comprehensive unit tests for the 10 most complex functions related to lick and project features in the `UserFeed` component.

## Test Coverage

The test suite covers the following complex functions:

1. **parseSharedLickId** - URL parsing for extracting lick IDs from various URL formats
2. **parseProjectId** - URL parsing for extracting project IDs from various URL formats
3. **extractFirstUrl** - Extracting the first URL from text content
4. **handleCreatePost** - Complex validation logic for post creation with attachments
5. **handleUpdatePost** - Complex validation logic for post updates with attachments
6. **openEditModal** - State initialization logic for edit modal
7. **resolvePreview** - Preview resolution with caching mechanism
8. **fetchActiveLicks** - Data fetching and formatting for active licks
9. **fetchActiveProjects** - Data fetching and formatting for active projects
10. **Complex attachment validation** - Multi-scenario validation for different attachment types

## Setup

### Install Dependencies

```bash
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

### Update package.json

Add the following script to your `package.json`:

```json
{
  "scripts": {
    "test:vitest": "vitest",
    "test:vitest:ui": "vitest --ui",
    "test:vitest:coverage": "vitest --coverage"
  }
}
```

## Running Tests

### Run all tests
```bash
npm run test:vitest
```

### Run tests in watch mode
```bash
npm run test:vitest -- --watch
```

### Run tests with UI
```bash
npm run test:vitest:ui
```

### Run tests with coverage
```bash
npm run test:vitest:coverage
```

### Run a specific test file
```bash
npm run test:vitest UserFeed.test.js
```

## Test Structure

Each test suite is organized by function with multiple test cases covering:

- **Happy paths** - Normal operation scenarios
- **Edge cases** - Boundary conditions and special inputs
- **Error handling** - Invalid inputs and error scenarios
- **Validation logic** - Complex business rule validation
- **State management** - State initialization and updates

## Key Test Scenarios

### URL Parsing Tests
- Absolute URLs (HTTP/HTTPS)
- Relative URLs (with/without leading slash)
- URLs with query parameters
- URLs with hash fragments
- Case-insensitive path segments
- Trailing slashes handling
- Invalid URL handling

### Validation Tests
- Single attachment type validation
- Multiple attachment type conflicts
- Empty content validation
- Text length validation
- Original post state preservation
- Attachment type transitions

### Data Fetching Tests
- Successful data fetching
- Empty response handling
- Error response handling
- Data formatting and normalization
- ID type conversion (string/number)

### Preview Resolution Tests
- Cache hit scenarios
- Cache miss scenarios
- oEmbed fallback
- OG tags fallback
- Default fallback
- Multiple fetch prevention

## Mocking

The tests use Vitest's mocking capabilities to:

- Mock service functions (`lickService`, `projectService`, `postService`)
- Mock Ant Design's `message` component
- Mock browser APIs (`window.location`, `localStorage`)
- Isolate unit tests from external dependencies

## Notes

- All utility functions are recreated in the test file for isolation
- In a production setup, consider extracting these utilities to separate modules
- The tests focus on business logic rather than React component rendering
- Mock data structures match the actual API response formats

