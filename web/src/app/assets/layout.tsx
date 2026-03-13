import MainLayout from '@/components/MainLayout';

export default function AssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
