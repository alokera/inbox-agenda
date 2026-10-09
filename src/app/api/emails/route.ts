import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient } from "@/lib/google";
import { isMailCategory, isMailView, listEmails } from "@/lib/mailbox";

/** GET /api/emails?view=inbox&category=primary&q=from:amazon&pageToken=… */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "inbox";
  if (!isMailView(view)) return Response.json({ error: `Unknown view "${view}"` }, { status: 400 });
  const rawCategory = params.get("category");
  if (rawCategory && !isMailCategory(rawCategory)) return Response.json({ error: `Unknown category "${rawCategory}"` }, { status: 400 });
  const category = isMailCategory(rawCategory) ? rawCategory : undefined;
  const query = (params.get("q") ?? "").slice(0, 200);

  try {
    const { client } = await getAuthorizedClient();
    return Response.json(await listEmails(client, { view, category, query, pageToken: params.get("pageToken") ?? undefined }));
  } catch (error) {
    return errorResponse(error, "Couldn't load emails.");
  }
}
