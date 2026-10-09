import "server-only";
import { buildEmailMessage, buildExtractionPrompt, parseExtraction, toAgendaItem } from "./extract";
import { getLLMClient, LLM_MODEL } from "./llm";
import type { AgendaItem, EmailCandidate } from "./types";

/** Asks Grok for the appointments in one email. A failure for one email doesn't fail the scan. */
export async function extractAppointments(email: EmailCandidate, timezone: string): Promise<AgendaItem[]> {
  try {
    const completion = await getLLMClient().chat.completions.create({
      model: LLM_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildExtractionPrompt(timezone) },
        { role: "user", content: buildEmailMessage(email) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    return parseExtraction(raw).map((appointment, i) => toAgendaItem(appointment, email, i));
  } catch (error) {
    console.error(`Extraction failed for email ${email.id}:`, error instanceof Error ? error.message : error);
    return [];
  }
}
