'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types';
import { 
  loadProductsFromSupabase, 
  isOnline,
  supabase
} from '@/lib/supabase';

interface ProductGridProps {
  title?: string;
  showViewAll?: boolean;
  viewAllLink?: string;
  limit?: number;
  filterByCategory?: string;
}

// يتم عرض 8 منتجات في البداية، ثم تحميل المزيد عند التمرير
const INITIAL_PRODUCTS_COUNT = 8;
const PRODUCTS_PER_PAGE = 8;

export default function ProductGrid({
  title,
  showViewAll = false,
  viewAllLink = '/products',
  limit,
  filterByCategory,
}: ProductGridProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [productPage, setProductPage] = useState(1);
  
  const loadProductsDataRef = useRef<() => Promise<void>>();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // تحميل المنتجات من السيرفر
  useEffect(() => {
    const loadProductsData = async () => {
      // Reset state at the beginning
      setLoading(true);
      
      // Check if we're offline first
      if (!isOnline()) {
        setIsOffline(true);
        setLoading(false);
        return;
      }
      
      // We're online, reset offline state
      setIsOffline(false);
      
      try {
        console.log('Loading products from Supabase...');
        const serverProducts = await loadProductsFromSupabase();
        
        if (serverProducts && serverProducts.length > 0) {
          console.log('Successfully loaded products from server:', serverProducts.length);
          
          // Process the products - add packPrice and boxPrice
          let processedProducts = serverProducts
            .filter(product => product !== null)
            .map(product => ({
              ...product,
              packPrice: product.piecePrice * 6, // مثال: علبة تحتوي على 6 قطع
              boxPrice: product.piecePrice * product.boxQuantity
            })) as Product[];
          
          // Apply category filter if needed
          if (filterByCategory) {
            processedProducts = processedProducts.filter((product: Product) => 
              product.categoryId && String(product.categoryId) === String(filterByCategory)
            );
            console.log('Filtered by category. Remaining count:', processedProducts.length);
          }
          
          // Filter new products if we're on the new products page
          if (window.location.pathname.includes('/products/new')) {
            const currentDate = new Date();
            const newProductDays = 14; // Hard-coded instead of from settings
            
            processedProducts = processedProducts.filter((product: Product) => {
              if (!product.createdAt || !product.isNew) return false;
              
              const createdDate = new Date(product.createdAt);
              const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              return diffDays <= newProductDays;
            });
            console.log('Filtered new products by date. Remaining count:', processedProducts.length);
          }
          
          // Sort products by date (newest first)
          processedProducts.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; 
          });
          
          // Apply limit if specified
          if (limit && limit > 0) {
            processedProducts = processedProducts.slice(0, limit);
            console.log('Applied limit. Final count:', processedProducts.length);
          }
          
          // تعيين كل المنتجات
          setAllProducts(processedProducts);
          
          // تعيين المنتجات المرئية في الصفحة الأولى
          const initialProducts = processedProducts.slice(0, INITIAL_PRODUCTS_COUNT);
          setVisibleProducts(initialProducts);
          
          // تحديد ما إذا كان هناك المزيد من المنتجات للتحميل
          setHasMore(processedProducts.length > INITIAL_PRODUCTS_COUNT);
          
          // إعادة تعيين رقم الصفحة
          setProductPage(1);
        } else {
          console.log('No products found on server');
          setAllProducts([]);
          setVisibleProducts([]);
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error loading products from server:', error);
        setAllProducts([]);
        setVisibleProducts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };
    
    // Store the function in a ref so it can be called from the Supabase subscription handlers
    loadProductsDataRef.current = loadProductsData;
    
    loadProductsData();
    
    // Handle online/offline status changes
    const handleOnlineStatusChange = () => {
      const online = isOnline();
      setIsOffline(!online);
      
      if (online) {
        console.log('Connection restored. Loading fresh data...');
        loadProductsData();
      } else {
        console.log('Connection lost. Showing offline message.');
      }
    };
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, [limit, filterByCategory]);

  // دالة لتحميل المزيد من المنتجات
  const loadMoreProducts = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    // حساب نطاق المنتجات الجديدة للتحميل
    const startIndex = productPage * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    
    // الحصول على المنتجات الجديدة من القائمة الكاملة
    const newProducts = allProducts.slice(startIndex, endIndex);
    
    // إضافة المنتجات الجديدة إلى القائمة المرئية
    setVisibleProducts(prev => [...prev, ...newProducts]);
    
    // زيادة رقم الصفحة
    setProductPage(prev => prev + 1);
    
    // التحقق مما إذا كان هناك المزيد من المنتجات
    setHasMore(endIndex < allProducts.length);
    
    setLoadingMore(false);
  }, [productPage, allProducts, loadingMore, hasMore]);

  // إعداد مراقب التقاطع للتمرير اللانهائي
  useEffect(() => {
    // إزالة المراقب السابق إذا كان موجودًا
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // إنشاء مراقب جديد
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1 }
    );
    
    // بدء المراقبة إذا كان عنصر التحميل موجودًا
    const loadMoreElement = loadMoreRef.current;
    if (loadMoreElement) {
      observerRef.current.observe(loadMoreElement);
    }
    
    // تنظيف عند الإلغاء
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreProducts, hasMore, loadingMore]);

  // Set up Supabase Realtime subscription
  useEffect(() => {
    // Don't set up subscription if offline
    if (isOffline) return;

    console.log('Setting up Supabase Realtime subscription for products table');
    
    // Create a channel for postgres_changes on the products table
    const channel = supabase
      .channel('product-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Received Realtime update:', payload.eventType, payload);
          
          // Call loadProductsData to refresh the data
          if (loadProductsDataRef.current) {
            console.log(`Product ${payload.eventType} detected. Reloading data...`);
            loadProductsDataRef.current();
          }
        }
      )
      .subscribe((status) => {
        console.log('Supabase Realtime subscription status:', status);
      });

    // Cleanup function to remove the channel when the component unmounts
    return () => {
      console.log('Cleaning up Supabase Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [isOffline]); // Only re-subscribe when online/offline status changes

  // Show loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Show offline message
  if (isOffline) {
    return (
      <div className="text-center py-10 bg-gray-100 rounded-lg shadow-inner">
        <p className="text-gray-700 font-medium text-lg">لا يوجد اتصال بالإنترنت</p>
        <p className="text-gray-500 mt-2">يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى</p>
      </div>
    );
  }

  // Show empty state if no products
  if (visibleProducts.length === 0) {
    return (
      <div className="p-8">
        {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">لا توجد منتجات متاحة حاليًا</p>
        </div>
      </div>
    );
  }

  // Display products
  return (
    <div className="p-4 md:p-8">
      {title && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
          {showViewAll && (
            <a href={viewAllLink} className="text-primary hover:underline font-medium">
              عرض الكل
            </a>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {visibleProducts.map((product, index) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            // إعطاء الأولوية فقط للمنتجات الثمانية الأولى
            priority={index < INITIAL_PRODUCTS_COUNT}
          />
        ))}
      </div>
      
      {/* عنصر يستخدم للتمرير اللانهائي */}
      {hasMore && (
        <div 
          ref={loadMoreRef} 
          className="flex justify-center mt-8 py-4"
        >
          {loadingMore ? (
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          ) : (
            <button 
              onClick={loadMoreProducts}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              تحميل المزيد
            </button>
          )}
        </div>
      )}
    </div>
  );
} 