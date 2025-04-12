import { createClient } from '@supabase/supabase-js';

// رابط الوصول إلى قاعدة البيانات
const SUPABASE_URL = 'https://vcwosfhhfktmtwqwkwzd.supabase.co';
// مفتاح الوصول العام (ليس سراً - فقط يسمح بالقراءة والكتابة في جداول محددة)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjd29zZmhoZmt0bXR3cXdrd3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODA0NTY5NzUsImV4cCI6MTk5NTk4Mjk3NX0.xmdpAvA7SRyfyx9VcfZCkgFJCiD5f4TGgOeYqIAqvTE';

// إنشاء عميل Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// وظائف التعامل مع المنتجات
export async function saveProductsToSupabase(products: any[]) {
  try {
    // حذف جميع المنتجات الحالية
    await supabase.from('products').delete().neq('id', '0');
    
    // إضافة المنتجات الجديدة
    const { data, error } = await supabase.from('products').insert(products);
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('خطأ في حفظ المنتجات:', error);
    throw error;
  }
}

export async function loadProductsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('خطأ في تحميل المنتجات:', error);
    return [];
  }
}

// دالة لتحديث المنتجات المحلية من Supabase
export async function syncProductsFromSupabase() {
  try {
    const products = await loadProductsFromSupabase();
    
    if (products && products.length > 0) {
      // تحديث التخزين المحلي بالبيانات الجديدة
      localStorage.setItem('products', JSON.stringify(products));
      
      // إرسال حدث لإعلام بقية التطبيق بالتغييرات
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'products', timestamp: Date.now() }
        }));
      }
    }
    
    return products;
  } catch (error) {
    console.error('خطأ في مزامنة المنتجات:', error);
    return [];
  }
}

// وظيفة للتحقق من الاتصال بالإنترنت
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
} 