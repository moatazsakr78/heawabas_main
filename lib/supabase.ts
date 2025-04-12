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
    // حذف جميع المنتجات الحالية ثم إضافة المنتجات الجديدة بأسلوب أكثر فعالية
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .not('id', 'is', null); // حذف جميع المنتجات
    
    if (deleteError) {
      console.error('Error deleting products:', deleteError);
      // إذا فشل الحذف، حاول الإدراج على أي حال
    }
    
    // تأكد من عدم وجود تعارضات في المعرفات
    const uniqueProducts = products.filter((p, index, self) => 
      index === self.findIndex(t => t.id === p.id)
    );
    
    // إعادة ترميز المنتجات للتأكد من حلها لجميع المواقع
    const serializedProducts = uniqueProducts.map(product => ({
      ...product,
      // تحويل التواريخ إلى سلاسل نصية إذا كانت كائنات Date
      createdAt: product.createdAt instanceof Date ? product.createdAt.toISOString() : product.createdAt
    }));
    
    // إضافة المنتجات
    const { data, error } = await supabase
      .from('products')
      .upsert(serializedProducts, { onConflict: 'id', ignoreDuplicates: false });
    
    if (error) {
      console.error('Error saving products:', error);
      throw error;
    }
    
    console.log('Successfully saved products to Supabase:', serializedProducts.length);
    
    return data;
  } catch (error) {
    console.error('Error in saveProductsToSupabase:', error);
    throw error;
  }
}

export async function loadProductsFromSupabase() {
  try {
    console.log('Loading products from Supabase...');
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('createdAt', { ascending: false });
    
    if (error) {
      console.error('Error loading products from Supabase:', error);
      throw error;
    }
    
    console.log('Successfully loaded products from Supabase:', data?.length || 0);
    
    return data || [];
  } catch (error) {
    console.error('Error in loadProductsFromSupabase:', error);
    return [];
  }
}

// دالة لتحديث المنتجات المحلية من Supabase وضمان المزامنة
export async function syncProductsFromSupabase(forceServerData = true) {
  try {
    console.log('Starting products sync...');
    
    if (!isOnline()) {
      console.log('Device is offline. Using local data only.');
      return [];
    }
    
    // جلب البيانات من السيرفر
    const onlineProducts = await loadProductsFromSupabase();
    
    if (onlineProducts && onlineProducts.length > 0) {
      console.log('Using server data for products. Count:', onlineProducts.length);
      
      // تحديث التخزين المحلي دائماً بأحدث البيانات من السيرفر
      localStorage.setItem('products', JSON.stringify(onlineProducts));
      
      try {
        if (typeof indexedDB !== 'undefined') {
          // حفظ في التخزين الدائم أيضاً إذا كان متاحاً
          const request = indexedDB.open('HeaWaBas_Storage', 1);
          
          request.onsuccess = function(event) {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction(['data_store'], 'readwrite');
            const store = transaction.objectStore('data_store');
            
            store.put({ key: 'products', value: onlineProducts });
            
            console.log('Updated IndexedDB with latest products');
          };
        }
      } catch (error) {
        console.error('Error updating IndexedDB:', error);
      }
      
      // إرسال حدث لإعلام بقية التطبيق بالتغييرات
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'products', timestamp: Date.now() }
        }));
      }
      
      return onlineProducts;
    } else if (!forceServerData) {
      // إذا كان السيرفر لا يحتوي على بيانات، نحاول استخدام البيانات المحلية
      try {
        const localProducts = JSON.parse(localStorage.getItem('products') || '[]');
        
        if (localProducts && localProducts.length > 0) {
          console.log('No server data found. Uploading local data to server...');
          await saveProductsToSupabase(localProducts);
          return localProducts;
        }
      } catch (error) {
        console.error('Error parsing local products:', error);
      }
    }
    
    console.log('No products found on server or locally');
    return [];
  } catch (error) {
    console.error('Error in syncProductsFromSupabase:', error);
    return [];
  }
}

// وظيفة للتحقق من الاتصال بالإنترنت
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
} 