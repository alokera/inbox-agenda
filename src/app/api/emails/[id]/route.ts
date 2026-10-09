import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient } from "@/lib/google";
import { getEmail } from "@/lib/mailbox";

export async function GET(_request: Request, ctx: RouteContext<"/api/emails/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9]+$/.test(id)) return Response.json({ error: "Invalid email id" }, { status: 400 });
  try {
    const { client } = await getAuthorizedClient();
    return Response.json(await getEmail(client, id));
  } catch (error) {
    return errorResponse(error, "Couldn't open this email.");
  }
}
