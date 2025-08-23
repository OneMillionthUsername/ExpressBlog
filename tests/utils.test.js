jest.unstable_mockModule('dompurify', () => ({
  default: () => ({
    sanitize: jest.fn(() => { throw new Error("Sanitization failed"); })
  })
}));
const DOMPurifyServer = (await import('dompurify')).default;

import { beforeEach, describe, expect, jest } from "@jest/globals";
import { 
  createSlug, 
  truncateSlug, 
  convertBigInts,
} from "../utils/utils.js";
import { createEscapeInputMiddleware } from "../middleware/securityMiddleware.js";
const { escapeAllStrings } = await import('../utils/utils.js');
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

describe("Test escapeAllStrings", () => {
  it("should throw an error for null input", () => {
    expect(() => escapeAllStrings(null)).toThrow("Invalid input: Object is null or undefined");
  });

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
describe("test createEscapeInputMiddleware", () => {
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
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const next = jest.fn();
    // Simuliere einen Fehler in der Middleware
    req.body = 123; // Setze req.body auf eine Zahl, um einen Fehler zu provozieren
    const escapeInputMiddleware = createEscapeInputMiddleware([]);

    escapeInputMiddleware(req, res, next);

    // Überprüfe, ob console.error aufgerufen wurde
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in escapeInputMiddleware:",
      expect.any(Error)
    );

    // Überprüfe, ob next() aufgerufen wurde
    expect(next).toHaveBeenCalled();

    consoleSpy.mockRestore(); // Stelle console.error wieder her
  });
  it("should call next middleware", () => {
    const escapeInputMiddleware = createEscapeInputMiddleware([]);
    
    escapeInputMiddleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
});
describe('Test createSlug', () => {
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
describe('Test convertBigInts', () => {
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
});