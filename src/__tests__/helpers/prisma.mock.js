import { vi, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Create a deep mock of the PrismaClient instance
export const mockPrisma = mockDeep();

// Reset the mocks before every test execution
beforeEach(() => {
  mockReset(mockPrisma);
});

// Intercept imports of './src/core/config/db.js' and return the mock client instead
vi.mock('../../core/config/db.js', () => ({
  default: {
    client: mockPrisma
  }
}));
