import { beforeEach, describe, expect, jest } from "@jest/globals";

// 1. ERST das originale Modul importieren
const actualUtils = await import("../utils/utils.js");

// 2. DANN mocken
jest.unstable_mockModule("../utils/utils.js", () => ({
  escapeAllStrings: jest.fn(),
  sanitizeFilename: jest.fn((filename) => "safe_" + filename),
}));

// Die gemockten Funktionen importieren
const { escapeAllStrings, sanitizeFilename } = await import("../utils/utils.js");

// 4. Mock-Implementierung mit der ECHTEN Funktion setzen
escapeAllStrings.mockImplementation((obj, whitelist, path) => 
  actualUtils.escapeAllStrings(obj, whitelist, path)
);

// 5. Rest der Imports
const { createEscapeInputMiddleware } = await import("../middleware/securityMiddleware.js");
const whitelist = ["content"];
const escapeInputMiddleware = createEscapeInputMiddleware(whitelist);

let req, res, next, i;
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
  i = 0;
});

describe("test createEscapeInputMiddleware", () => {
  it("should escape in req: body, query, params, cookies, headers and file names", async () => {

  escapeInputMiddleware(req, res, next);
  //console.log('escapeAllStrings called with:', escapeAllStrings.mock.calls);
  expect(req.body.title).toBe('&lt;b&gt;abc&lt;/b&gt; Das Gewitter kommmt, wenn es dunkel wird!');
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
});

describe('Test createSlug', () => {
  it('should create a slug from the title', () => {
    const title = ['Hello World! This is a Test.',
      'Hällo! > Das ist ein sehr langer Titööl, mit Sönderzeichen <.',
      '',
      '../../..',
      "..\\..\\..",
      "..\\..\\..TitelName",
      'something.exe'
    ];
    const slugs = ['hello-world-this-is-a-test',
      'haello-das-ist-ein-sehr-langer-titoeoel-mit',
      '',
      '',
      '',
      'titelname',
      'somethingexe'
    ];
    const result = [];
    title.forEach(title => {
        const slug = actualUtils.createSlug(title);
        result.push(slug);  
    });
    result.forEach((slug, i) => {
      //console.log(slug + '===' + slugs[i]);
      expect(slug).toBe(slugs[i])
    });
  });
  it('should truncate a slug to 50 chars', () => {
    let langerTitel = 'Das ist ein sehr langer Titel, mit mehr als Fünfzig Zeichen an Text! Er wird jetzt auf Fünfzig gekürzt.';
    let expected = 'Das ist ein sehr langer Titel, mit mehr als Fünfzi';
    let result = actualUtils.truncateSlug(langerTitel);
    expect(result).toBe(expected);
  });
});

describe('Test convertBigInts', () => {
  it('Should convert all big ints to int' , () => {
    let input = [3n, 12, 1235213n, 1214.2, 1234123413251231323411324n,-12312, 'abcs'];
    let expected = [3, 12, 1235213, 1214.2,NaN,-12312, NaN];
    let result = [];
    input.forEach(number => {
      result.push(actualUtils.convertBigInts(number));
    });
    result.forEach((number, i) => {
      //console.log(number + ' === ' + expected[i]);
      expect(number).toBe(expected[i]);
    });
  });
});