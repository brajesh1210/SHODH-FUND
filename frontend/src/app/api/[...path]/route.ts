import { NextRequest } from "next/server";
import { handleApi } from "@/server/handleApi";

export const dynamic = "force-dynamic";

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return handleApi(req, path);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
