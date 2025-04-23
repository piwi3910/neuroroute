/**
 * Jest Setup File
 * 
 * This file is loaded before running tests to set up the testing environment.
 * It makes Jest globals available to all test files.
 */

// Make Jest globals available
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Export Jest globals to make them available to all test files
export { jest, describe, it, expect, beforeEach, afterEach };

// Make Jest globals available globally
global.jest = jest;
global.describe = describe;
global.it = it;
global.expect = expect;
global.beforeEach = beforeEach;
global.afterEach = afterEach;