'use client';

import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types';
import { loadData } from '@/lib/localStorage';

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
        // محاولة تحميل البيانات من التخزين الدائم
        const savedProducts = await loadData('products');
        const savedSettings = await loadData('productSettings');
        
        // احتياطياً، إذا لم يتم العثور على البيانات في التخزين الدائم، نحاول من localStorage
        const localProducts = savedProducts || JSON.parse(localStorage.getItem('products') || '[]');
        const localSettings = savedSettings || JSON.parse(localStorage.getItem('productSettings') || '{}');
        
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
                let newProductDays = localSettings.newProductDays || 14; // استخدام القيمة الافتراضية إذا لم تكن موجودة
                
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
    
    // الاستماع لتغييرات التخزين
    const handleStorageChange = () => {
      console.log('Storage changed, reloading products');
      setLastUpdate(Date.now());
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('customStorageChange', handleStorageChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleStorageChange as EventListener);
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