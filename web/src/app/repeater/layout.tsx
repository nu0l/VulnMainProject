import MainLayout from '@/components/MainLayout';

export default function RepeaterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
