import type { CaseRole, NegotiationPair } from "@/lib/case-types";

export default function CaseNegotiationPairs({ roles, pairs }: { roles: CaseRole[]; pairs: NegotiationPair[] }) {
  return (
    <section className="case-negotiation-pairs">
      <strong>ВОЗМОЖНЫЕ ПОЕДИНКИ</strong>
      <ul>{pairs.map((pair) => <li key={`${pair.roleAIndex}-${pair.roleBIndex}`}><b>{roles[pair.roleAIndex]?.name} ↔ {roles[pair.roleBIndex]?.name}</b><span>{pair.reason}</span></li>)}</ul>
    </section>
  );
}
