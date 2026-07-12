import AppNavRail from "@/components/AppNavRail";

export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell case-builder-shell">
      <AppNavRail />
      <div className="admin-main">{children}</div>
    </main>
  );
}
