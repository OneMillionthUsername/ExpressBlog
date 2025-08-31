jest.unstable_mockModule('dompurify', () => ({
  default: () => ({
    sanitize: jest.fn(() => { throw new Error("Sanitization failed"); })
  })
}));
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: "test" })
  })
);

const DOMPurifyServer = (await import('dompurify')).default;

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { 
  createSlug, 
  truncateSlug, 
  convertBigInts,
} from "../utils/utils.js";
import { createEscapeInputMiddleware } from "../middleware/securityMiddleware.js";
import { sanitizeFilename, escapeHtml, unescapeHtml, escapeAllStrings } from '../utils/utils.js';

const { makeApiRequest } = await import('../public/assets/js/api.js');
let req, res, next, mockSanitize;

beforeEach(() => {
  req = {
    body: { title: "<b>abc</b> Das Gewitter kommmt, wenn es dunkel wird!", content: "<b>test</b>" },
    query: { q: "<script>" },
    params: { id: "<img>" },
    cookies: { session: "<cookie>" },
    headers: { "user-agent": "<us>", referer: "<ref>" },
    file: { originalname: "file<>:\"|?*.txt" },
    files: [
      { originalname: "C:\\Windows\\system32\\file.exe" },
      { originalname: "../../../etc/passwd" },
      { originalname: "my file & data!.txt" },
      { originalname: "document.pdf" }
    ]
  };
  res = {};
  next = jest.fn();
  mockSanitize = DOMPurifyServer.sanitize;
  jest.clearAllMocks();
});
afterEach(() => {
  req = null;
  res = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.clearAllTimers();
});

describe('makeApiRequest', () => {
  it("should make a GET request", async () => {
    const result = await makeApiRequest("https://api.example.com/data", "GET");
    expect(result).toEqual({ success: true, data: "test" });
  });
  it("should make a POST request", async () => {
    const result = await makeApiRequest("https://api.example.com/data", "POST", { body: { key: "value" } });
    expect(result).toEqual({ success: true, data: "test" });
  });
  it("should handle non-OK responses", async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, error: "Not found" })
      })
    );
    const result = await makeApiRequest("https://api.example.com/data", "GET");
    expect(result).toEqual({ success: false, error: "Not found", status: 404 });
  });
  it("should handle network errors", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Network error")));
    
    await expect(makeApiRequest("https://api.example.com/data", "GET"))
      .rejects
      .toThrow("API-Request fehlgeschlagen: Network error");  
  });
  it("should handle other errors", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Other error")));

    await expect(makeApiRequest("https://api.example.com/data", "GET"))
      .rejects
      .toThrow("API-Request fehlgeschlagen: Other error");
  });
  it("should include custom headers", async () => {
    const customHeaders = { Authorization: "Bearer testtoken" };
    
    global.fetch = jest.fn((url, options) => {
      expect(options.headers.Authorization).toBe("Bearer testtoken");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
    
    const result = await makeApiRequest("https://api.example.com/data", { headers: customHeaders });
    expect(result).toEqual({ success: true });
  });
  it("should handle other HTTP methods", async () => {
    const customHeaders = { Authorization: "Bearer testtoken" };

    global.fetch = jest.fn((url, options) => {
      expect(options.headers.Authorization).toBe("Bearer testtoken");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    const result = await makeApiRequest("https://api.example.com/data", { method: "UPDATE", headers: customHeaders });
    expect(result).toEqual({ success: true });
  });
  it("should make a DELETE request", async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, deleted: true })
    })
  );
  const result = await makeApiRequest("https://api.example.com/data", { method: "DELETE" });
  expect(result).toEqual({ success: true, deleted: true });
  });
  it("should make an UPDATE request", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, updated: true })
      })
    );
    const result = await makeApiRequest("https://api.example.com/data", { method: "UPDATE", body: JSON.stringify({ key: "value" }) });
    expect(result).toEqual({ success: true, updated: true });
  });
});
describe('escapeAllStrings', () => {
  it("should throw an error for undefined input", () => {
    expect(() => escapeAllStrings(undefined)).toThrow("Invalid input: Object is null or undefined");
  });
  it("should throw an error for unsupported input types", () => {
    expect(() => escapeAllStrings(123)).toThrow("Unsupported input type");
    expect(() => escapeAllStrings(true)).toThrow("Unsupported input type");
    expect(() => escapeAllStrings(() => {})).toThrow("Unsupported input type");
  });
  it("should throw an error for forbidden keys", () => {
    const obj = {};
    Object.defineProperty(obj, "__proto__", {
      value: "malicious",
      enumerable: true,
      writable: true,
      configurable: true
    });
    expect(() => escapeAllStrings(obj)).toThrow("Forbidden key detected: \"__proto__\"");
  });
  it("should throw an error when DOMPurify fails", () => {
    const obj = { content: '<script>alert("xss")</script>' };
    const whitelist = ["content"];
    const mockDomPurify = {
  sanitize: jest.fn(() => { throw new Error("Sanitization failed"); })
};
    expect(() => escapeAllStrings(obj, whitelist, [], mockDomPurify)).toThrow("Sanitization failed");
  });
  it("should sanitize content with DOMPurify when in whitelist", () => {
    const whitelist = ["content"];
    const obj = { content: "<script>alert('XSS')</script>" };

    const mockSanitize = jest.fn().mockReturnValue("Clean content");
    const mockDomPurify = { sanitize: mockSanitize };

    const result = escapeAllStrings(obj, whitelist, [], mockDomPurify);

    expect(result.content).toBe("Clean content");
    expect(mockSanitize).toHaveBeenCalledWith(
      "<script>alert('XSS')</script>",
      expect.objectContaining({
        ALLOWED_TAGS: expect.any(Array),
        ALLOWED_ATTR: expect.any(Array),
        ALLOW_DATA_ATTR: false
      })
    );
  });
});
describe("createEscapeInputMiddleware", () => {
  it("should escape body fields except whitelisted ones", () => {
    const whitelist = ["content"];
    const escapeInputMiddleware = createEscapeInputMiddleware(whitelist);
    
    escapeInputMiddleware(req, res, next);
    
    expect(req.body.title).toBe('&lt;b&gt;abc&lt;/b&gt; Das Gewitter kommmt, wenn es dunkel wird!');
    expect(req.body.content).toBe("<b>test</b>"); // Whitelisted
    expect(next).toHaveBeenCalled();
  });

  it("should escape query, params, and cookies", () => {
    const escapeInputMiddleware = createEscapeInputMiddleware([]);
    
    escapeInputMiddleware(req, res, next);
    
    expect(req.query.q).toBe('&lt;script&gt;');
    expect(req.params.id).toBe('&lt;img&gt;');
    expect(req.cookies.session).toBe('&lt;cookie&gt;');
    expect(next).toHaveBeenCalled();
  });

  it("should sanitize file names", () => {
    const escapeInputMiddleware = createEscapeInputMiddleware([]);
    
    escapeInputMiddleware(req, res, next);
    
    expect(req.file.safeFilename).toBe("file_______.txt");
    expect(req.files[0].safeFilename).toBe("file.exe");
    expect(req.files[1].safeFilename).toBe("passwd");
    expect(req.files[2].safeFilename).toBe("my_file___data_.txt");
    expect(req.files[3].safeFilename).toBe("document.pdf");
    expect(next).toHaveBeenCalled();
  });
  it("should handle errors gracefully", () => {
    const next = jest.fn();
    // Simuliere einen Fehler in der Middleware
    req.body = 123; // Setze req.body auf eine Zahl, um einen Fehler zu provozieren
    const escapeInputMiddleware = createEscapeInputMiddleware([]);
    escapeInputMiddleware(req, res, next);
    // Überprüfe, ob next() aufgerufen wurde
    expect(next).toHaveBeenCalled();
  });
  it("should call next middleware", () => {
    const escapeInputMiddleware = createEscapeInputMiddleware([]);
    
    escapeInputMiddleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
});
describe('createSlug', () => {
  it('should create a slug from the title', () => {
    const testCases = [
      ['Hello World! This is a Test.', 'hello-world-this-is-a-test'],
      ['Hällo! > Das ist ein sehr langer Titööl, mit Sönderzeichen <.', 'haello-das-ist-ein-sehr-langer-titoeoel-mit'],
      ['', ''],
      ['../../..', ''],
      ["..\\..\\..", ''],
      ["..\\..\\..TitelName", 'titelname'],
      ['something.exe', 'somethingexe']
    ];
    
    testCases.forEach(([input, expected]) => {
      expect(createSlug(input)).toBe(expected);
    });
  });
  it('should truncate a slug to 50 chars', () => {
    const langerTitel = 'Das ist ein sehr langer Titel, mit mehr als Fünfzig Zeichen an Text! Er wird jetzt auf Fünfzig gekürzt.';
    const expected = 'Das ist ein sehr langer Titel, mit mehr als Fünfzi';
    expect(truncateSlug(langerTitel)).toBe(expected);
  });
});
describe('convertBigInts', () => {
  it('Should convert BigInts in objects', () => {
    const input = {
      id: 3n,
      views: 1235213n,
      name: 'test',
      count: 42
    };
    convertBigInts(input);
    
    expect(input.id).toBe(3);
    expect(input.views).toBe(1235213);
    expect(input.name).toBe('test');
    expect(input.count).toBe(42);
  });
  it('Should handle primitive BigInts', () => {
    expect(convertBigInts(3n)).toBe(3);
    expect(convertBigInts(1235213n)).toBe(1235213);
    expect(convertBigInts(42)).toBe(42);
    expect(convertBigInts('test')).toBe('test');
  });
  it('Should return NaN for BigInts that are too large', () => {
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 1000000000000000000000000000000000000n;
    expect(convertBigInts(tooBig)).toBeNaN();
    const tooSmall = BigInt(Number.MIN_SAFE_INTEGER) - 1000000000000000000000000000000000000n;
    expect(convertBigInts(tooSmall)).toBeNaN();
  });
});
describe('sanitizeFilename', () => {
  it('removes path and replaces forbidden chars', () => {
    expect(sanitizeFilename('../foo/bar\\baz.txt')).toBe('baz.txt');
    expect(sanitizeFilename('my*file?.txt')).toBe('my_file_.txt');
    expect(sanitizeFilename('a'.repeat(300) + '.txt').length).toBeLessThanOrEqual(255);
  });
});
describe('escapeHtml', () => {
  it('escapes HTML special chars', () => {
    expect(escapeHtml('<div>"Test"&\'</div>')).toBe('&lt;div&gt;&quot;Test&quot;&amp;&#39;&lt;/div&gt;');
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });
  it('returns non-string unchanged', () => {
    expect(escapeHtml(123)).toBe(123);
    expect(escapeHtml(null)).toBe(null);
  });
});
describe('unescapeHtml', () => {
  it('unescapes HTML entities', () => {
    expect(unescapeHtml('&lt;div&gt;&quot;Test&quot;&amp;&#39;&lt;/div&gt;')).toBe('<div>"Test"&\'</div>');
    expect(unescapeHtml('&amp;')).toBe('&');
    expect(unescapeHtml('&quot;')).toBe('"');
    expect(unescapeHtml('&#39;')).toBe("'");
  });
  it('returns non-string unchanged', () => {
    expect(unescapeHtml(123)).toBe(123);
    expect(unescapeHtml(null)).toBe(null);
  });
});