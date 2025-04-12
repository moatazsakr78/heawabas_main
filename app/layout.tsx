import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import InitLocalStorage from '@/components/storage/InitLocalStorage';

export const metadata: Metadata = {
  title: 'Product Catalog | Your Brand Name',
  description: 'Browse through our wide range of products in this online catalog',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="min-h-screen flex flex-col">
          <InitLocalStorage />
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
} 