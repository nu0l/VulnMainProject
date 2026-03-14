import MainLayout from '@/components/MainLayout';

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
