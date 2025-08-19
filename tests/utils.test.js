import { beforeEach, describe, expect, jest } from "@jest/globals";

// 1. ERST das originale Modul importieren
const actualUtils = await import("../utils/utils.js");

// 2. DANN mocken
jest.unstable_mockModule("../utils/utils.js", () => ({
  escapeAllStrings: jest.fn(),
  sanitizeFilename: jest.fn((filename) => "safe_" + filename),
  // Andere Funktionen, die du brauchst, kannst du hier explizit definieren
  parseTags: jest.fn(),
  convertBigInts: jest.fn(),
  createSlug: jest.fn()
}));

// 3. Die gemockten Funktionen importieren
const { escapeAllStrings, sanitizeFilename, createSlug } = await import("../utils/utils.js");

// 4. Mock-Implementierung mit der ECHTEN Funktion setzen
escapeAllStrings.mockImplementation((obj, whitelist, path) => 
  actualUtils.escapeAllStrings(obj, whitelist, path)
);

// 5. Rest der Imports
const { createEscapeInputMiddleware } = await import("../utils/middleware.js");
const whitelist = ["content"];
const escapeInputMiddleware = createEscapeInputMiddleware(whitelist);

let req, res, next;
beforeEach(() => {
  req = {
    body: { title: "<b>abc</b> Das Gewitter kommmt!", content: "<b>test</b>" },
    query: { q: "<script>" },
    params: { id: "<img>" },
    cookies: { session: "<cookie>" },
    headers: { "user-agent": "<us>", referer: "<ref>" },
    file: { originalname: "file.txt" },
    files: [{ originalname: "file1.txt" }, { originalname: "file2.txt" }]
  };
  res = {};
  next = jest.fn();
});

describe("test the createEscapeInputMiddleware", () => {
  it("should escape body, query, params, cookies, headers and file names", async () => {

  escapeInputMiddleware(req, res, next);
  //console.log('escapeAllStrings called with:', escapeAllStrings.mock.calls);


    expect(req.body.title).toBe('&lt;b&gt;abc&lt;/b&gt; Das Gewitter kommmt!');
    expect(req.body.content).toBe("<b>test</b>");
    expect(req.query.q).toBe('&lt;script&gt;');
    expect(req.file.safeFilename).toBe("safe_file.txt");
    expect(req.files[0].safeFilename).toBe("safe_file1.txt");
    expect(req.files[1].safeFilename).toBe("safe_file2.txt");
    expect(req.params.id).toBe('&lt;img&gt;');
    expect(req.cookies.session).toBe('&lt;cookie&gt;');
    expect(req.headers["user-agent"]).toBe('&lt;us&gt;');
    expect(req.headers.referer).toBe('&lt;ref&gt;');
    expect(escapeAllStrings).toHaveBeenCalled();
    expect(sanitizeFilename).toHaveBeenCalledWith("file.txt");
    expect(next).toHaveBeenCalled();
  });
  describe('Test createSlug', () => {
    it('should create a slug from the title', () => {
      const title = 'Hello World! This is a Test.';
      const slug = actualUtils.createSlug(title);
      expect(slug).toBe('hello-world-this-is-a-test');
    });
  });
});
