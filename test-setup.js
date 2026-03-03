/**
 * Test setup file for Jest
 * Configures the testing environment for mobile calendar list view tests
 */

// Mock window.innerWidth for viewport testing
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024
});

// Mock window.innerHeight
Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768
});

// Mock matchMedia for media query testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: () => {},
  warn: () => {},
};
