import { LayoutShell } from '@/components/layout/layout-shell'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutShell>{children}</LayoutShell>
}
