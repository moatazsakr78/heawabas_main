import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ClientInitProvider from '@/components/storage/ClientInitProvider';

export const metadata: Metadata = {
  title: 'سنتر هي و بس | كتالوج المنتجات',
  description: 'كتالوج شامل لجميع منتجاتنا المميزة بتصنيفات متعددة وتحديثات دورية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#c5c5c5]">
        <div className="min-h-screen flex flex-col">
          <ClientInitProvider />
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
} 