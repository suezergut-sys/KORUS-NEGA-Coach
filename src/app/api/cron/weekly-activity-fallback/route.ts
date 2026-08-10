import { GET as sendWeeklyActivityReport } from "../weekly-activity/route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return sendWeeklyActivityReport(request);
}
