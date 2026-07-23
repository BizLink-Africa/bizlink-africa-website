import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// 'server-only' relies on Next.js's bundler resolving it to a no-op file via
// the "react-server" package-export condition; outside that bundler (i.e.
// under Vitest) its default entry point throws unconditionally. Mocking it
// away is the standard way to unit-test server-only modules directly.
vi.mock('server-only', () => ({}));
