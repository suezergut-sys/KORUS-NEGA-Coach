import AppNavRail from "@/components/AppNavRail";

export default function CaseLibraryLayout({ children }: { children: React.ReactNode }) {
  return <main className="admin-shell case-library-shell"><AppNavRail /><div className="admin-main">{children}</div></main>;
}
