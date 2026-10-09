import { describe, expect, it } from "vitest";
import { toHtml, toPlainText } from "./rich-text";

describe("toPlainText", () => {
  it("removes bold markers and expands links", () => {
    expect(toPlainText("**Portfolio:** https://aalok.dev")).toBe("Portfolio: https://aalok.dev");
    expect(toPlainText("[my site](https://aalok.dev)")).toBe("my site (https://aalok.dev)");
    expect(toPlainText("[a@b.com](mailto:a@b.com)")).toBe("a@b.com");
  });
});

describe("toHtml", () => {
  it("renders bold, explicit links and bare URLs", () => {
    const html = toHtml("**GitHub:** https://github.com/alokera\n[a@b.com](mailto:a@b.com)");
    expect(html).toContain('<strong>GitHub:</strong> <a href="https://github.com/alokera">https://github.com/alokera</a><br>');
    expect(html).toContain('<a href="mailto:a@b.com">a@b.com</a>');
  });

  it("does not double-link a URL inside an explicit link", () => {
    const html = toHtml("[https://aalok.dev](https://aalok.dev)");
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("escapes HTML so nothing can be injected", () => {
    const html = toHtml('<script>alert(1)</script> **<img src=x onerror=alert(1)>** [x](javascript:alert(1))');
    expect(html).not.toMatch(/<script|<img|href="javascript/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps trailing punctuation out of links", () => {
    expect(toHtml("See https://aalok.dev.")).toContain('<a href="https://aalok.dev">https://aalok.dev</a>.');
  });
});
