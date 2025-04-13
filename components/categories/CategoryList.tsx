'use client';

import Link from 'next/link';
import Image from 'next/image';
import { getCategories } from '@/lib/data';
import { useEffect, useState } from 'react';
import { Category } from '@/types';

interface CategoryListProps {
  showAll?: boolean;
}

export default function CategoryList({ showAll = false }: CategoryListProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // إضافة حالة لتتبع آخر تحديث
  
  useEffect(() => {
    // جلب البيانات من وظيفة getCategories 
    const loadCategories = () => {
      setCategories(getCategories());
    };
    
    loadCategories();
    
    // الاستماع لتغييرات localStorage
    const handleStorageChange = () => {
      console.log('Storage changed, reloading categories');
      setLastUpdate(Date.now()); // تحديث وقت آخر تغيير لإعادة تشغيل التأثير
      loadCategories();
    };
    
    // إضافة مستمع لأحداث تغيير التخزين
    window.addEventListener('storage', handleStorageChange);
    
    // استجابة مخصصة لأحداث التخزين المشتقة يدويًا
    const handleCustomStorageEvent = () => {
      console.log('Custom storage event received');
      setLastUpdate(Date.now());
      loadCategories();
    };
    
    window.addEventListener('customStorageChange', handleCustomStorageEvent as EventListener);
    
    // إنشاء interval للتحقق من التغييرات بشكل دوري (احتياطي)
    const interval = setInterval(() => {
      loadCategories();
    }, 5000); // التحقق كل خمس ثوان
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleCustomStorageEvent as EventListener);
      clearInterval(interval);
    };
  }, [lastUpdate]); // إضافة lastUpdate كتبعية
  
  const displayCategories = showAll ? categories : categories.slice(0, 6);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
      {displayCategories.map((category) => (
        <Link 
          key={category.id} 
          href={`/categories/${category.slug}`}
          className="group"
        >
          <div className="rounded-lg overflow-hidden bg-white shadow-md transition-shadow group-hover:shadow-lg">
            <div className="relative h-48">
              {category.image ? (
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-gray-400">{category.name}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <h3 className="absolute bottom-0 left-0 right-0 p-4 text-white text-lg font-medium">
                {category.name}
              </h3>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
} 