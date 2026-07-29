import { notFound } from "next/navigation";
import P2E2EHarness from "@/components/P2E2EHarness";

export default function P2E2EPage() {
  if (process.env.E2E_TEST_MODE !== "1") notFound();
  return <P2E2EHarness />;
}
