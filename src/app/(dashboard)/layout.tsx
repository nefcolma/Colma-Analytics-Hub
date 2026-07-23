import { Header } from "@/components/shell/Header";
import { MobileNav, Sidebar } from "@/components/shell/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:pl-56">
      <Sidebar />
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      <MobileNav />
    </div>
  );
}
