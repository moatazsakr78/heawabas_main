"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChart3, Settings, Package, Tag, RefreshCw } from 'lucide-react';
import SyncStatusIndicator from '@/components/admin/SyncStatusIndicator';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
  });

  useEffect(() => {
    // حساب الإحصائيات
    const getStats = () => {
      try {
        // حساب عدد المنتجات
        const products = localStorage.getItem('products');
        const parsedProducts = products ? JSON.parse(products) : [];
        
        // حساب عدد الفئات
        const categories = localStorage.getItem('categories');
        const parsedCategories = categories ? JSON.parse(categories) : [];
        
        setStats({
          products: Array.isArray(parsedProducts) ? parsedProducts.length : 0,
          categories: Array.isArray(parsedCategories) ? parsedCategories.length : 0,
        });
      } catch (error) {
        console.error('خطأ في حساب الإحصائيات', error);
      }
    };
    
    // تنفيذ الحساب عند تحميل الصفحة
    getStats();
    
    // الاستماع لتغييرات التخزين المحلي
    const handleStorageChange = () => {
      getStats();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('customStorageChange', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleStorageChange);
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <Link href="/admin/sync-logs">
          <Button variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            سجل المزامنة
          </Button>
        </Link>
      </div>
      
      <div className="mb-6">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">حالة المزامنة</CardTitle>
            <CardDescription>حالة المزامنة مع خادم Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            <SyncStatusIndicator />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">المنتجات</CardTitle>
            </div>
            <CardDescription>إدارة المنتجات والعروض</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.products}</div>
            <Link href="/admin/products">
              <Button className="w-full">عرض المنتجات</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">الفئات</CardTitle>
            </div>
            <CardDescription>إدارة فئات المنتجات</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{stats.categories}</div>
            <Link href="/admin/categories">
              <Button className="w-full">عرض الفئات</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">الإعدادات</CardTitle>
            </div>
            <CardDescription>إعدادات المتجر والتطبيق</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">-</div>
            <Link href="/admin/settings">
              <Button className="w-full">عرض الإعدادات</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 