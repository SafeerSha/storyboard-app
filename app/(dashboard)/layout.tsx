import { FreelancerLayout } from "@/components/layout/FreelancerLayout";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FreelancerLayout>{children}</FreelancerLayout>;
}
