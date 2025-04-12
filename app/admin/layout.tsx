'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiPackage, FiLogOut, FiSettings } from 'react-icons/fi';
import { hasData, removeData } from '@/lib/localStorage';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    // Check if the user is authenticated
    const checkAuth = () => {
      const isAuth = hasData('admin_token');
      setIsAuthenticated(isAuth);
      
      if (!isAuth) {
        router.push('/');
      }
    };
    
    checkAuth();
  }, [router]);
  
  const handleLogout = () => {
    removeData('admin_token');
    router.push('/');
  };
  
  const navigation = [
    { name: 'إدارة المنتجات', href: '/admin/products', icon: FiPackage },
    { name: 'إعدادات المنتجات', href: '/admin/settings', icon: FiSettings },
  ];
  
  if (!isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen">جاري التحميل...</div>;
  }
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="h-20 flex items-center justify-center border-b">
          <h1 className="text-xl font-bold text-primary">لوحة التحكم</h1>
        </div>
        <nav className="mt-5">
          <ul>
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.name} className="px-6 py-2">
                  <Link
                    href={item.href}
                    className={`flex items-center space-x-3 rtl:space-x-reverse ${
                      isActive
                        ? 'text-primary font-medium'
                        : 'text-gray-600 hover:text-primary'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
            <li className="px-6 py-2 mt-10">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 rtl:space-x-reverse text-red-500 hover:text-red-600"
              >
                <FiLogOut className="h-5 w-5" />
                <span>تسجيل الخروج</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 