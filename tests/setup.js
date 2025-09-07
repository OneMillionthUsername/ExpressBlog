// Test-Umgebungsvariablen setzen
process.env.JWT_SECRET = 'test_jwt_secret_key_with_at_least_32_characters_for_testing_purposes';
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';

// Polyfills für jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// URL and URLSearchParams polyfills
global.URL = URL;
global.URLSearchParams = URLSearchParams;

// Additional polyfills for jsdom
global.Request = class Request {};
global.Response = class Response {};
global.Headers = class Headers {};
// Note: fetch will be mocked in individual test files if needed