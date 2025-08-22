import { beforeEach, describe, expect, jest } from "@jest/globals";
import { 
  createSlug, 
  truncateSlug, 
  convertBigInts, 
  escapeAllStrings,
  sanitizeFilename 
} from "../utils/utils.js";
import { createEscapeInputMiddleware } from "../middleware/securityMiddleware.js";

let req, res, next;

beforeEach(() => {
  req = {
    body: { title: "<b>abc</b> Das Gewitter kommmt, wenn es dunkel wird!", content: "<b>test</b>" },
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
describe("test createEscapeInputMiddleware", () => {
  it("should escape in req: body, query, params, cookies, headers and file names", () => {
    const whitelist = ["content"];
    const escapeInputMiddleware = createEscapeInputMiddleware(whitelist);
    
    escapeInputMiddleware(req, res, next);
    
    expect(req.body.title).toBe('&lt;b&gt;abc&lt;/b&gt; Das Gewitter kommmt, wenn es dunkel wird!');
    expect(req.body.content).toBe("<b>test</b>"); // Whitelisted
    expect(req.query.q).toBe('&lt;script&gt;');
    expect(req.params.id).toBe('&lt;img&gt;');
    expect(req.cookies.session).toBe('&lt;cookie&gt;');
    expect(req.headers["user-agent"]).toBe('&lt;us&gt;');
    expect(req.headers.referer).toBe('&lt;ref&gt;');
    expect(req.file.safeFilename).toBe("safe_file.txt");
    expect(req.files[0].safeFilename).toBe("safe_file1.txt");
    expect(req.files[1].safeFilename).toBe("safe_file2.txt");
    expect(next).toHaveBeenCalled();
  });
});
describe('Test createSlug', () => {
  it('should create a slug from the title', () => {
    console.log('Actual:', createSlug('Hello World! This is a Test.'));
    console.log('Expected: hello-world-this-is-a-test');
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
    const expected = 'das-ist-ein-sehr-langer-titel-mit-mehr-als-fuenfz';
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