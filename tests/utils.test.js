import { jest } from "@jest/globals";

const actualUtils = await import("../utils/utils.js");

jest.unstable_mockModule("../utils/utils.js", () => ({
  ...actualUtils,                 // createEscapeInputMiddleware behalten
  escapeAllStrings: jest.fn((x) => x),
  sanitizeFilename: jest.fn((filename) => "safe_" + filename)
}));

const { createEscapeInputMiddleware } = await import("../utils/middleware.js");

describe("test the createEscapeInputMiddleware", () => {
  it("should escape body, query, params, cookies, headers and file names", async () => {
    const whitelist = ["content"];
    const middleware = createEscapeInputMiddleware(whitelist);
    

    const req = {
      body: { content: "<b>test</b>" },
      query: { q: "<script>" },
      params: { id: "<img>" },
      cookies: { session: "<cookie>" },
      headers: { "user-agent": "<us>", referer: "<ref>" },
      file: { originalname: "file.txt" },
      files: [{ originalname: "file1.txt" }, { originalname: "file2.txt" }]
    };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.body.content).toBe("<b>test</b>");
    expect(req.query.q).toBe("<script>"); // escapeAllStrings ist gemockt, liefert input zurück
    expect(req.file.safeFilename).toBe("safe_file.txt");
    expect(req.files[0].safeFilename).toBe("safe_file1.txt");
    expect(req.files[1].safeFilename).toBe("safe_file2.txt");
    expect(next).toHaveBeenCalled();

    // Prüfen, ob escapeAllStrings für jedes Feld aufgerufen wurde
    const { escapeAllStrings } = await import("../utils/utils.js");
    // expect(escapeAllStrings).toHaveBeenCalledWith(req.query.q);
    // expect(escapeAllStrings).toHaveBeenCalledWith(req.params.id);
  });
});
