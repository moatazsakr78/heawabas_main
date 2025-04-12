'use client';

import { useState, useEffect } from 'react';
import ProductGrid from '@/components/products/ProductGrid';
import { loadData } from '@/lib/localStorage';

export default function NewProductsPage() {
  const [newProductDays, setNewProductDays] = useState(14);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settings = await loadData('productSettings');
        
        if (settings && settings.newProductDays) {
          setNewProductDays(settings.newProductDays);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">المنتجات الجديدة</h1>
      
      {!loading && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            تعرض هذه الصفحة المنتجات التي تم إضافتها في آخر {newProductDays} يوم.
          </p>
        </div>
      )}
      
      <ProductGrid />
    </div>
  );
} 