import type { InfrastructureMetric, InfrastructureProvider } from "@/lib/infrastructure-usage";

function formatValue(value: number, unit: InfrastructureMetric["unit"]) {
  if (unit === "bytes") {
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(value < 10 * 1024 ** 3 ? 2 : 1)} ГБ`;
    return `${(value / 1024 ** 2).toFixed(1)} МБ`;
  }
  if (unit === "seconds") return `${(value / 3600).toFixed(2)} ч`;
  if (unit === "gb-hours") return `${value.toFixed(1)} ГБ·ч`;
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function MetricCard({ metric }: { metric: InfrastructureMetric }) {
  const percent = metric.used === null ? null : Math.min(100, Math.max(0, metric.used / metric.limit * 100));
  const level = percent === null ? "unknown" : percent >= 90 ? "critical" : percent >= 70 ? "warning" : "safe";
  return (
    <article className={`infra-metric ${level}`}>
      <header><h3>{metric.label}</h3><span>{percent === null ? "НЕТ ДАННЫХ" : `${percent.toFixed(percent < 1 ? 1 : 0)}%`}</span></header>
      <div className="infra-values">
        <strong>{metric.used === null ? "—" : formatValue(metric.used, metric.unit)}</strong>
        <small>из {formatValue(metric.limit, metric.unit)}</small>
      </div>
      <div className="infra-progress" aria-label={percent === null ? "Данные недоступны" : `Использовано ${percent.toFixed(1)} процента`}>
        <i style={{ width: `${percent || 0}%` }} />
      </div>
      <p>{metric.note}</p>
    </article>
  );
}

export default function InfrastructureDashboard({ providers }: { providers: InfrastructureProvider[] }) {
  return <div className="infra-providers">
    {providers.map((provider) => <section className="infra-provider" key={provider.id}>
      <header className="infra-provider-header">
        <div><span className={`infra-provider-status ${provider.status}`} /> <strong>{provider.name}</strong><small>Тариф {provider.plan}</small></div>
        <a href={provider.dashboardUrl} target="_blank" rel="noreferrer">Открыть Usage ↗</a>
      </header>
      <div className="infra-metric-grid">{provider.metrics.map((metric) => <MetricCard metric={metric} key={metric.id} />)}</div>
      {provider.message && <p className="infra-provider-message">{provider.message}</p>}
    </section>)}
  </div>;
}

