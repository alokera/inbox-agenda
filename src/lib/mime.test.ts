import { describe, expect, it } from "vitest";
import { buildMime, encodeHeaderText, safeFilename, sanitizeHeader, toBase64Url } from "./mime";
import { replySubject } from "./ui-format";

const decodeTextPart = (mime: string) => {
  const match = mime.match(/Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)(\r\n--|$)/);
  return Buffer.from(match![1].replace(/\r\n/g, ""), "base64").toString("utf8");
};

describe("header safety", () => {
  it("strips CR/LF so a value can't inject extra headers", () => {
    expect(sanitizeHeader("Hello\r\nBcc: attacker@evil.com")).toBe("Hello Bcc: attacker@evil.com");
    const mime = buildMime({ to: "hr@acme.com\r\nBcc: attacker@evil.com", subject: "Hi\nCc: x@y.z", body: "b" });
    expect(mime).not.toMatch(/^Bcc:/m);
    expect(mime).not.toMatch(/^Cc:/m);
  });

  it("encodes non-ASCII subjects (RFC 2047) and leaves ASCII alone", () => {
    expect(encodeHeaderText("Application")).toBe("Application");
    const encoded = encodeHeaderText("Application – Frontend Developer");
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(Buffer.from(encoded.slice(10, -2), "base64").toString("utf8")).toBe("Application – Frontend Developer");
  });

  it("makes filenames safe", () => {
    expect(safeFilename('Aalok "Resume"\r\n.pdf')).toBe("Aalok _Resume_ .pdf");
    expect(safeFilename("")).toBe("attachment");
  });
});

describe("replySubject", () => {
  it("adds Re: once", () => {
    expect(replySubject("Frontend role")).toBe("Re: Frontend role");
    expect(replySubject("RE: Frontend role")).toBe("RE: Frontend role");
  });
});

describe("buildMime", () => {
  it("builds a plain-text reply with threading headers", () => {
    const mime = buildMime({ from: "me@gmail.com", to: "hr@acme.com", subject: "Re: Role", body: "Hello\nThanks!", inReplyTo: "<abc@mail>", references: "<root@mail>" });
    expect(mime).toContain("To: hr@acme.com\r\n");
    expect(mime).toContain("In-Reply-To: <abc@mail>\r\n");
    expect(mime).toContain("References: <root@mail> <abc@mail>\r\n");
    expect(mime).not.toContain("multipart");
    expect(decodeTextPart(mime)).toBe("Hello\r\nThanks!");
  });

  it("adds the resume as a multipart attachment", () => {
    const pdf = Buffer.from("%PDF-1.4 fake resume").toString("base64");
    const mime = buildMime({ to: "hr@acme.com", subject: "Application", body: "See attached", attachment: { filename: "Aalok Resume.pdf", mimeType: "application/pdf", base64: pdf } }, "BOUNDARY");
    expect(mime).toContain('Content-Type: multipart/mixed; boundary="BOUNDARY"');
    expect(mime).not.toContain("multipart/alternative");
    expect(mime).toContain('Content-Disposition: attachment; filename="Aalok Resume.pdf"');
    expect(mime.trimEnd().endsWith("--BOUNDARY--")).toBe(true);
    expect(mime).toContain(pdf);
    expect(decodeTextPart(mime)).toBe("See attached");
  });

  it("sends text and HTML as alternatives, inside mixed when there's an attachment", () => {
    const pdf = Buffer.from("%PDF").toString("base64");
    const mime = buildMime({ to: "hr@acme.com", subject: "s", body: "Portfolio: x", html: "<strong>Portfolio:</strong> x", attachment: { filename: "r.pdf", mimeType: "application/pdf", base64: pdf } }, "B");
    const mixed = mime.indexOf('multipart/mixed; boundary="B"');
    const alternative = mime.indexOf('multipart/alternative; boundary="B_alt"');
    expect(mixed).toBeGreaterThan(-1);
    expect(alternative).toBeGreaterThan(mixed);
    expect(mime.indexOf("text/plain")).toBeLessThan(mime.indexOf("text/html")); // plain first, richest last
    expect(mime).toContain("--B_alt--");
    expect(mime.trimEnd().endsWith("--B--")).toBe(true);
    const htmlB64 = mime.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split("\r\n--")[0];
    expect(Buffer.from(htmlB64.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe("<strong>Portfolio:</strong> x");
  });

  it("uses multipart/alternative alone when there's HTML but no attachment", () => {
    const mime = buildMime({ to: "a@b.co", subject: "s", body: "b", html: "<b>b</b>" }, "C");
    expect(mime).toContain('multipart/alternative; boundary="C_alt"');
    expect(mime).not.toContain("multipart/mixed");
  });

  it("wraps long base64 lines at 76 characters", () => {
    const big = Buffer.alloc(3000, 7).toString("base64");
    const mime = buildMime({ to: "a@b.co", subject: "s", body: "b", attachment: { filename: "r.pdf", mimeType: "application/pdf", base64: big } });
    expect(mime.split("\r\n").every((line) => line.length <= 998)).toBe(true);
    expect(mime.split("\r\n").filter((l) => /^[A-Za-z0-9+/=]{76}$/.test(l)).length).toBeGreaterThan(10);
  });

  it("encodes to base64url for the Gmail API", () => {
    expect(toBase64Url("a?b>c")).not.toMatch(/[+/=]/);
  });
});
