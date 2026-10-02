import { NextResponse } from "next/server";
import { indexNowKey } from "@/lib/env";

/** IndexNow key file: /{INDEXNOW_KEY}.txt — serves the key as plain text. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const secret = indexNowKey();
  if (!secret || key !== `${secret}.txt`) {
    return new NextResponse("not found", { status: 404 });
  }
  return new NextResponse(secret, {
    headers: { "content-type": "text/plain" },
  });
}