import { NextRequest } from "next/server";
import { handleApi } from "@/server/handleApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleApi(req, ["export", "expenses.csv"]);
}
