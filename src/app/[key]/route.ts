import { NextResponse } from "next/server";

/** IndexNow key file: /{INDEXNOW_KEY}.txt — serves the key as plain text. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const expected = `${process.env.INDEXNOW_KEY}.txt`;
  if (!process.env.INDEXNOW_KEY || key !== expected) {
    return new NextResponse("not found", { status: 404 });
  }
  return new NextResponse(process.env.INDEXNOW_KEY, {
    headers: { "content-type": "text/plain" },
  });
}
