'use client';

import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types';
import { loadData } from '@/lib/localStorage';
import { syncProductsFromSupabase, isOnline } from '@/lib/supabase';

interface ProductGridProps {
  title?: string;
  showViewAll?: boolean;
  viewAllLink?: string;
  limit?: number;
  filterByCategory?: string;
}

export default function ProductGrid({
  title,
  showViewAll = false,
  viewAllLink = '/products',
  limit,
  filterByCategory,
}: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    // تحميل المنتجات من التخزين المحلي الدائم
    const loadProductsData = async () => {
      setLoading(true);
      
      try {
        // أولاً، محاولة مزامنة البيانات من Supabase إذا كان متصلاً بالإنترنت
        if (isOnline()) {
          try {
            await syncProductsFromSupabase();
          } catch (error) {
            console.error('Error syncing products from Supabase:', error);
          }
        }
        
        // محاولة تحميل البيانات من التخزين الدائم
        const savedProducts = await loadData('products');
        const savedSettings = await loadData('productSettings');
        
        // احتياطياً، إذا لم يتم العثور على البيانات في التخزين الدائم، نحاول من localStorage
        let localProducts = [];
        let localSettings = {};
        
        if (savedProducts !== null) {
          localProducts = savedProducts;
        } else {
          try {
            const productsFromLS = localStorage.getItem('products');
            if (productsFromLS) {
              localProducts = JSON.parse(productsFromLS);
            }
          } catch (error) {
            console.error('Error parsing products from localStorage:', error);
          }
        }
        
        if (savedSettings !== null) {
          localSettings = savedSettings;
        } else {
          try {
            const settingsFromLS = localStorage.getItem('productSettings');
            if (settingsFromLS) {
              localSettings = JSON.parse(settingsFromLS);
            }
          } catch (error) {
            console.error('Error parsing settings from localStorage:', error);
          }
        }
        
        if (localProducts && Array.isArray(localProducts) && localProducts.length > 0) {
          console.log('Products loaded:', localProducts.length);
          
          let filteredProducts = localProducts;
          
          // تطبيق التصفية حسب الفئة إذا كانت موجودة
          if (filterByCategory) {
            filteredProducts = filteredProducts.filter((product: Product) => 
              product.categoryId && String(product.categoryId) === String(filterByCategory)
            );
          }
          
          // طريقة تحديد المنتجات الجديدة بناءً على إعدادات المنتجات الجديدة
          if (localSettings) {
            try {
              // إذا كان مسار الصفحة الحالية هو صفحة المنتجات الجديدة
              if (window.location.pathname.includes('/products/new')) {
                const currentDate = new Date();
                let newProductDays = (localSettings as {newProductDays?: number}).newProductDays || 14;
                
                // تصفية المنتجات التي تم إنشاؤها خلال المدة المحددة فقط
                filteredProducts = localProducts.filter((product: Product) => {
                  if (!product.createdAt || !product.isNew) return false;
                  
                  const createdDate = new Date(product.createdAt);
                  const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  return diffDays <= newProductDays;
                });
              }
            } catch (error) {
              console.error('Error parsing product settings:', error);
            }
          }

          // ترتيب المنتجات من الأحدث إلى الأقدم
          filteredProducts.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; // ترتيب تنازلي (من الأحدث إلى الأقدم)
          });

          // تطبيق الحد على عدد المنتجات إذا كان موجودًا
          if (limit && limit > 0) {
            filteredProducts = filteredProducts.slice(0, limit);
          }

          setProducts(filteredProducts);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProductsData();
    
    // الاستماع لتغييرات التخزين والاتصال بالإنترنت
    const handleStorageChange = () => {
      console.log('Storage changed, reloading products');
      setLastUpdate(Date.now());
    };
    
    const handleOnlineStatusChange = () => {
      if (isOnline()) {
        // محاولة مزامنة البيانات عند عودة الاتصال
        syncProductsFromSupabase().then(() => {
          setLastUpdate(Date.now());
        });
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('customStorageChange', handleStorageChange as EventListener);
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleStorageChange as EventListener);
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, [limit, lastUpdate, filterByCategory]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">لا توجد منتجات متاحة حاليًا</p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
} 