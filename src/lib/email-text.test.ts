import { describe, expect, it } from "vitest";
import { extractEmailText, getHeader, htmlToText, listAttachments, parseAddress, type MessagePart } from "./email-text";

const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("extractEmailText", () => {
  it("prefers text/plain inside nested multipart emails", () => {
    const payload: MessagePart = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: b64("Your dentist appointment is on Friday at 4pm.") } },
            { mimeType: "text/html", body: { data: b64("<p>HTML version</p>") } },
          ],
        },
        { mimeType: "application/pdf", filename: "invoice.pdf", body: { data: b64("binary") } },
      ],
    };
    expect(extractEmailText(payload)).toBe("Your dentist appointment is on Friday at 4pm.");
  });

  it("falls back to HTML converted to text", () => {
    const payload: MessagePart = { mimeType: "text/html", body: { data: b64("<div>Interview&nbsp;on <b>Monday</b></div><p>10:00 AM</p>") } };
    expect(extractEmailText(payload)).toBe("Interview on Monday\n10:00 AM");
  });

  it("truncates very long emails", () => {
    const payload: MessagePart = { mimeType: "text/plain", body: { data: b64("x".repeat(10_000)) } };
    expect(extractEmailText(payload).length).toBeLessThanOrEqual(6001);
  });
});

describe("htmlToText", () => {
  it("drops scripts and styles, keeps https link targets, decodes entities", () => {
    const html = `<style>.a{}</style><script>alert(1)</script><a href="https://meet.google.com/abc-defg-hij">Join</a> &amp; &#8211; &lt;ok&gt;`;
    const text = htmlToText(html);
    expect(text).not.toContain("alert");
    expect(text).not.toContain(".a{}");
    expect(text).toContain("Join (https://meet.google.com/abc-defg-hij)");
    expect(text).toContain("& – <ok>");
  });
});

describe("getHeader", () => {
  it("is case-insensitive", () => {
    expect(getHeader({ headers: [{ name: "Subject", value: "Hello" }] }, "subject")).toBe("Hello");
    expect(getHeader({ headers: [] }, "From")).toBe("");
  });
});

describe("parseAddress", () => {
  it("parses quoted and unquoted display names", () => {
    expect(parseAddress('"Asha Rao" <asha@example.com>')).toEqual({ name: "Asha Rao", email: "asha@example.com" });
    expect(parseAddress("Amazon.in <order-update@amazon.in>")).toEqual({ name: "Amazon.in", email: "order-update@amazon.in" });
  });
  it("falls back to the address when there is no name", () => {
    expect(parseAddress("<noreply@bank.com>")).toEqual({ name: "noreply@bank.com", email: "noreply@bank.com" });
    expect(parseAddress("rohan@example.com")).toEqual({ name: "rohan", email: "rohan@example.com" });
  });
});

describe("listAttachments", () => {
  it("finds attachments in nested parts", () => {
    const payload: MessagePart = { parts: [{ mimeType: "text/plain" }, { parts: [{ filename: "ticket.pdf" }, { filename: "invite.ics" }] }] };
    expect(listAttachments(payload)).toEqual(["ticket.pdf", "invite.ics"]);
  });
});
