import InfrastructureDashboard from "@/components/InfrastructureDashboard";
import { getInfrastructureUsage } from "@/lib/infrastructure-usage";

export default async function InfrastructurePage() {
  const providers = await getInfrastructureUsage();
  return <>
    <header className="admin-page-header">
      <div><span className="admin-eyebrow">КОНТРОЛЬ РЕСУРСОВ</span><h1>Лимиты инфраструктуры</h1><p>Текущее потребление критических квот Vercel и Supabase. Зелёный статус — до 70%, жёлтый — от 70%, красный — от 90%.</p></div>
    </header>
    <InfrastructureDashboard providers={providers} />
  </>;
}

