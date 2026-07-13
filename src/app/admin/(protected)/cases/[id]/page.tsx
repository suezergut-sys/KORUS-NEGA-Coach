import { notFound } from "next/navigation";
import AdminCaseEditor from "@/components/AdminCaseEditor";
import { mapCaseRow } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export default async function AdminCaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await getSupabaseAdmin().from("negotiation_cases").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const item = mapCaseRow(data);
  return <AdminCaseEditor initialCase={{ ...item, status: data.status, createdBy: data.created_by || "Источник не указан" }} />;
}
