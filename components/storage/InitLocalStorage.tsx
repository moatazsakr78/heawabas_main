'use client';

import { useEffect, useState } from 'react';
import { loadData, saveData } from '@/lib/localStorage';

/**
 * مكون لتهيئة وضمان استمرارية بيانات التخزين المحلي
 * يقوم هذا المكون بتحميل البيانات من التخزين الدائم واستعادتها عند بدء التطبيق
 */
export default function InitLocalStorage() {
  // استخدام حالة للتحقق من أن الكود يعمل في جانب العميل فقط
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // تعيين isClient إلى true بمجرد تحميل المكون في المتصفح
    setIsClient(true);
  }, []);

  useEffect(() => {
    // تشغيل الكود فقط بعد تأكيد أننا في جانب العميل
    if (!isClient) return;

    const initializeStorage = async () => {
      // ضمان تحميل البيانات من التخزين الدائم واستعادتها في localStorage العادي للتوافق
      await syncLocalStorage('products');
      await syncLocalStorage('categories');
      await syncLocalStorage('productSettings');
      
      console.log('Local storage initialization complete');
    };
    
    // دالة مساعدة لمزامنة مفتاح معين بين التخزين الدائم و localStorage العادي
    const syncLocalStorage = async (key: string) => {
      try {
        // محاولة تحميل البيانات من التخزين الدائم
        const persistentData = await loadData(key);
        
        if (persistentData) {
          // إذا وجدت البيانات في التخزين الدائم، نقوم بتحميلها في localStorage العادي
          localStorage.setItem(key, JSON.stringify(persistentData));
          console.log(`Restored ${key} from persistent storage`);
        } else {
          // إذا لم توجد البيانات في التخزين الدائم، نحاول تحميلها من localStorage العادي
          const localData = localStorage.getItem(key);
          if (localData) {
            // إذا وجدت في localStorage، نحفظها في التخزين الدائم
            saveData(key, JSON.parse(localData));
            console.log(`Saved ${key} to persistent storage from localStorage`);
          }
        }
      } catch (error) {
        console.error(`Error syncing ${key}:`, error);
      }
    };

    initializeStorage();
  }, [isClient]); // تعتمد على isClient

  // هذا المكون لا يعرض أي محتوى مرئي
  return null;
} 