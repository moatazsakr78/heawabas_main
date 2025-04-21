'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function ProductGrid({
  title,
  showViewAll = false,
  viewAllLink = '/products',
  limit,
  filterByCategory,
}: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const loadProductsDataRef = useRef<() => Promise<void>>();

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
          
          setProducts(processedProducts);
        } else {
          console.log('No products found on server');
          setProducts([]);
        }
      } catch (error) {
        console.error('Error loading products from server:', error);
        setProducts([]);
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
  if (products.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">لا توجد منتجات متاحة حاليًا</p>
      </div>
    );
  }

  // Show products
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