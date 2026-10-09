import { extractText, getDocumentProxy } from "unpdf";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Reads the text of an uploaded resume PDF so the AI can compare resumes to a job.
 * Nothing is stored: the PDF itself stays in the user's browser.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Resume must be under 4 MB." }, { status: 413 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Please upload a PDF." }, { status: 415 });
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!clean) return Response.json({ error: "No text found in this PDF (is it a scanned image?)." }, { status: 422 });
    return Response.json({ text: clean.slice(0, 20_000), pages: totalPages });
  } catch (error) {
    console.error("Resume parse failed:", error);
    return Response.json({ error: "Couldn't read this PDF." }, { status: 400 });
  }
}
