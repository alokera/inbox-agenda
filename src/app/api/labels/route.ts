import { connection } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient } from "@/lib/google";
import { getLabelCounts } from "@/lib/mailbox";

/** Unread/total counts for the sidebar badges. */
export async function GET() {
  await connection(); // per-request only: never prerender a user's mailbox
  try {
    const { client } = await getAuthorizedClient();
    return Response.json(await getLabelCounts(client));
  } catch (error) {
    return errorResponse(error, "Couldn't load mailbox counts.");
  }
}
