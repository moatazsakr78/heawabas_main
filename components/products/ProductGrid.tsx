'use client';

import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types';
import { loadData } from '@/lib/localStorage';
import { 
  syncProductsFromSupabase, 
  loadProductsFromSupabase, 
  isOnline,
  forceRefreshFromServer 
} from '@/lib/supabase';

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
  const [showSyncMessage, setShowSyncMessage] = useState(false);

  useEffect(() => {
    // تحميل المنتجات من التخزين المحلي الدائم
    const loadProductsData = async () => {
      setLoading(true);
      
      try {
        let productData: Product[] = [];
        
        // دائماً محاولة تحميل البيانات من السيرفر أولاً إذا كان متصلاً بالإنترنت
        if (isOnline()) {
          try {
            console.log('Trying to load products directly from server...');
            const serverProducts = await loadProductsFromSupabase();
            
            if (serverProducts && serverProducts.length > 0) {
              console.log('Successfully loaded products from server:', serverProducts.length);
              productData = serverProducts;
              
              // تحديث البيانات المحلية
              localStorage.setItem('products', JSON.stringify(serverProducts));
              setShowSyncMessage(true);
              setTimeout(() => setShowSyncMessage(false), 3000);
            } else {
              console.log('No products found on server, falling back to local data');
            }
          } catch (error) {
            console.error('Error loading products from server:', error);
            // استمر باستخدام البيانات المحلية
          }
        }
        
        // إذا لم نحصل على بيانات من الخادم، نستخدم البيانات المحلية
        if (productData.length === 0) {
          console.log('Using local data...');
          // محاولة تحميل البيانات من التخزين الدائم
          const savedProducts = await loadData('products');
          
          if (savedProducts && Array.isArray(savedProducts) && savedProducts.length > 0) {
            console.log('Loaded products from persistent storage:', savedProducts.length);
            productData = savedProducts;
          } else {
            // احتياطياً، نحاول من localStorage العادي
            try {
              const productsFromLS = localStorage.getItem('products');
              if (productsFromLS) {
                const parsedProducts = JSON.parse(productsFromLS);
                if (parsedProducts && Array.isArray(parsedProducts) && parsedProducts.length > 0) {
                  console.log('Loaded products from localStorage:', parsedProducts.length);
                  productData = parsedProducts;
                }
              }
            } catch (error) {
              console.error('Error parsing products from localStorage:', error);
            }
          }
        }
        
        // إذا وجدنا منتجات، نقوم بتصفيتها وعرضها
        if (productData && Array.isArray(productData) && productData.length > 0) {
          console.log('Processing products. Total count:', productData.length);
          
          let filteredProducts = productData;
          
          // تطبيق التصفية حسب الفئة إذا كانت موجودة
          if (filterByCategory) {
            filteredProducts = filteredProducts.filter((product: Product) => 
              product.categoryId && String(product.categoryId) === String(filterByCategory)
            );
            console.log('Filtered by category. Remaining count:', filteredProducts.length);
          }
          
          // محاولة تحميل إعدادات المنتجات (غير مهمة جداً إذا فشلت)
          try {
            const savedSettings = await loadData('productSettings');
            let localSettings = savedSettings || {};
            
            if (!savedSettings) {
              try {
                const settingsFromLS = localStorage.getItem('productSettings');
                if (settingsFromLS) {
                  localSettings = JSON.parse(settingsFromLS);
                }
              } catch (error) {
                console.error('Error parsing settings from localStorage:', error);
              }
            }
            
            // طريقة تحديد المنتجات الجديدة بناءً على إعدادات المنتجات الجديدة
            if (localSettings && window.location.pathname.includes('/products/new')) {
              const currentDate = new Date();
              // إضافة تحديد نوع لـ localSettings وضمان أن newProductDays موجودة
              let newProductDays = (localSettings as {newProductDays?: number}).newProductDays || 14;
              
              // تصفية المنتجات التي تم إنشاؤها خلال المدة المحددة فقط
              filteredProducts = productData.filter((product: Product) => {
                if (!product.createdAt || !product.isNew) return false;
                
                const createdDate = new Date(product.createdAt);
                const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return diffDays <= newProductDays;
              });
              console.log('Filtered new products by date. Remaining count:', filteredProducts.length);
            }
          } catch (error) {
            console.error('Error loading product settings:', error);
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
            console.log('Applied limit. Final count:', filteredProducts.length);
          }

          setProducts(filteredProducts);
        } else {
          console.log('No products found in any storage');
          setProducts([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setProducts([]);
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
        console.log('Connection restored. Syncing data...');
        // محاولة مزامنة البيانات عند عودة الاتصال
        try {
          // استخدام await بداخل دالة async فورية للتعامل مع الوعد بشكل صحيح
          (async () => {
            try {
              const serverData = await forceRefreshFromServer();
              if (serverData && serverData.length > 0) {
                console.log('تم تحديث البيانات بنجاح من السيرفر:', serverData.length);
                // تحديث المنتجات مباشرة بدلاً من إعادة تحميلها
                const filteredProducts = serverData.filter(p => p !== null) as Product[];
                
                // تطبيق نفس المرشحات للعرض
                let displayProducts = filteredProducts;
                
                if (filterByCategory) {
                  displayProducts = displayProducts.filter((product: Product) => 
                    product.categoryId && String(product.categoryId) === String(filterByCategory)
                  );
                }
                
                if (limit && limit > 0) {
                  displayProducts = displayProducts.slice(0, limit);
                }
                
                setProducts(displayProducts);
                setShowSyncMessage(true);
                setTimeout(() => setShowSyncMessage(false), 3000);
              } else {
                console.log('لم يتم العثور على بيانات في السيرفر، استخدام البيانات المحلية');
                loadProductsData();
              }
            } catch (error) {
              console.error('حدث خطأ أثناء تحديث البيانات من السيرفر:', error);
              loadProductsData();
            }
          })();
        } catch (error) {
          console.error('Error syncing data on connection restore:', error);
          loadProductsData();
        }
      } else {
        console.log('Connection lost. Using local data only.');
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
      {showSyncMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
          تم تحديث البيانات من الخادم المركزي
        </div>
      )}
      
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