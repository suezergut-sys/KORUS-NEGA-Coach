import AppNavRail from "@/components/AppNavRail";

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="analysis-upload-shell">
      <AppNavRail />
      <div className="analysis-upload-main">{children}</div>
    </main>
  );
}
