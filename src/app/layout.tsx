import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portal Sekolah SaaS',
  description: 'Multi-Tenant School Management Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
