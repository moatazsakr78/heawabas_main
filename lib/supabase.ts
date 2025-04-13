import { createClient } from '@supabase/supabase-js';

// رابط الوصول إلى قاعدة البيانات
const SUPABASE_URL = 'https://xuchmfujikkosqtlmsnt.supabase.co';
// مفتاح الوصول العام (ليس سراً - فقط يسمح بالقراءة والكتابة في جداول محددة)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Y2htZnVqaWtrb3NxdGxtc250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0NzM2ODEsImV4cCI6MjA2MDA0OTY4MX0.T6vlaQDbJk15K0739PRdU1GOyxTW86fOMZ_Ev_9UT90';

// إنشاء عميل Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// متغير عام للإشارة إلى آخر تحديث
let lastSyncTimestamp = 0;

// وظائف التعامل مع المنتجات
export async function saveProductsToSupabase(products: any[]) {
  try {
    if (!isOnline()) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('بدء حفظ المنتجات في Supabase...');
    
    // حذف جميع المنتجات الحالية أولاً
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .not('id', 'is', null);
    
    if (deleteError) {
      console.error('خطأ في حذف المنتجات:', deleteError);
      throw deleteError;
    }
    
    // تنظيف البيانات قبل الحفظ
    const uniqueProducts = products.filter((p, index, self) => 
      index === self.findIndex(t => t.id === p.id)
    );
    
    // إعادة تنسيق البيانات للتأكد من توافقها
    const serializedProducts = uniqueProducts.map(product => ({
      ...product,
      // تأكد من أن التاريخ سلسلة نصية
      createdAt: product.createdAt instanceof Date ? product.createdAt.toISOString() : product.createdAt
    }));
    
    // إضافة المنتجات
    const { data, error } = await supabase
      .from('products')
      .insert(serializedProducts)
      .select();
    
    if (error) {
      console.error('خطأ في حفظ المنتجات:', error);
      throw error;
    }
    
    console.log('تم حفظ المنتجات بنجاح في Supabase:', serializedProducts.length);
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    try {
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    } catch (error) {
      console.error('خطأ في حفظ وقت المزامنة:', error);
    }
    
    return data;
  } catch (error) {
    console.error('خطأ في saveProductsToSupabase:', error);
    throw error;
  }
}

export async function loadProductsFromSupabase() {
  try {
    if (!isOnline()) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('جاري تحميل المنتجات من Supabase...');
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('createdAt', { ascending: false });
    
    if (error) {
      console.error('خطأ في تحميل المنتجات من Supabase:', error);
      throw error;
    }
    
    // التحقق من وجود بيانات
    if (!data || data.length === 0) {
      console.log('لا توجد منتجات في Supabase');
      return null;
    }
    
    console.log('تم تحميل المنتجات بنجاح من Supabase:', data.length);
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    try {
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    } catch (error) {
      console.error('خطأ في حفظ وقت المزامنة:', error);
    }
    
    return data;
  } catch (error) {
    console.error('خطأ في loadProductsFromSupabase:', error);
    throw error;
  }
}

// دالة فعالة للمزامنة مع قاعدة البيانات
export async function syncProductsFromSupabase(force = false) {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن المزامنة.');
    return null;
  }
  
  try {
    console.log('بدء مزامنة المنتجات...');
    
    // تحقق مما إذا كانت المزامنة الأخيرة جديدة جدًا (أقل من 10 ثوانٍ) ولم يتم طلب التحديث القسري
    const storedTimestamp = localStorage.getItem('lastSyncTimestamp');
    if (!force && storedTimestamp) {
      const lastSync = parseInt(storedTimestamp);
      const now = Date.now();
      // إذا كانت آخر مزامنة في آخر 10 ثوانٍ، تخطي المزامنة
      if (now - lastSync < 10000) {
        console.log('تم المزامنة مؤخرًا، سيتم تخطي هذا الطلب');
        return null;
      }
    }
    
    // تحميل البيانات من السيرفر أولاً
    console.log('محاولة تحميل البيانات من السيرفر...');
    let serverData = null;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log('تم العثور على البيانات في السيرفر:', data.length);
        serverData = data;
      } else {
        console.log('لم يتم العثور على بيانات في السيرفر');
      }
    } catch (error) {
      console.error('خطأ في جلب البيانات من السيرفر:', error);
    }
    
    // تحميل البيانات المحلية
    let localData = [];
    try {
      const storedData = localStorage.getItem('products');
      if (storedData) {
        localData = JSON.parse(storedData);
        console.log('تم تحميل البيانات المحلية:', localData.length);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات المحلية:', error);
    }
    
    // إذا وجدنا بيانات على السيرفر، استخدمها وحدّث البيانات المحلية
    if (serverData) {
      console.log('استخدام بيانات السيرفر وتحديث التخزين المحلي');
      
      // تحديث البيانات المحلية
      localStorage.setItem('products', JSON.stringify(serverData));
      try {
        const request = indexedDB.open('HeaWaBas_Storage', 1);
        request.onsuccess = function(event) {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['data_store'], 'readwrite');
          const store = transaction.objectStore('data_store');
          store.put({ key: 'products', value: serverData });
        };
      } catch (error) {
        console.error('خطأ في تحديث IndexedDB:', error);
      }
      
      // تحديث الطابع الزمني للمزامنة
      lastSyncTimestamp = Date.now();
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
      
      // إعلام التطبيق بالتغييرات
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'products', timestamp: Date.now(), source: 'server' }
        }));
      }
      
      return serverData;
    } 
    // إذا لم نجد بيانات على السيرفر ولكن لدينا بيانات محلية، ارفعها إلى السيرفر
    else if (localData.length > 0) {
      console.log('لم يتم العثور على بيانات في السيرفر. رفع البيانات المحلية...');
      
      try {
        // حذف أي بيانات موجودة في السيرفر
        await supabase.from('products').delete().not('id', 'is', null);
        
        // تنظيف البيانات
        const uniqueProducts = localData.filter((p: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === p.id)
        );
        
        // تأكد من أن جميع البيانات بالتنسيق الصحيح
        const formattedProducts = uniqueProducts.map((product: any) => ({
          ...product,
          createdAt: product.createdAt instanceof Date ? product.createdAt.toISOString() : product.createdAt
        }));
        
        // رفع البيانات المحلية
        const { data, error } = await supabase
          .from('products')
          .insert(formattedProducts)
          .select();
        
        if (error) {
          throw error;
        }
        
        console.log('تم رفع البيانات المحلية بنجاح:', data.length);
        
        // تحديث الطابع الزمني للمزامنة
        lastSyncTimestamp = Date.now();
        localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
        
        return formattedProducts;
      } catch (error) {
        console.error('خطأ في رفع البيانات المحلية إلى السيرفر:', error);
        throw error;
      }
    }
    
    // لا توجد بيانات في أي مكان
    console.log('لا توجد بيانات محلية أو على السيرفر');
    return null;
  } catch (error) {
    console.error('خطأ في syncProductsFromSupabase:', error);
    throw error;
  }
}

// إجبار تحديث البيانات من السيرفر
export async function forceRefreshFromServer() {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن التحديث.');
    return null;
  }
  
  try {
    console.log('إجبار تحديث البيانات من السيرفر...');
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('createdAt', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد بيانات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل البيانات بنجاح من السيرفر:', data.length);
    
    // تحديث البيانات المحلية
    localStorage.setItem('products', JSON.stringify(data));
    try {
      saveData('products', data);
    } catch (e) {
      console.error('خطأ في حفظ البيانات في التخزين الدائم:', e);
    }
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    
    // إعلام التطبيق بالتغييرات
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('customStorageChange', { 
        detail: { type: 'products', timestamp: Date.now(), source: 'server' }
      }));
    }
    
    return data;
  } catch (error) {
    console.error('خطأ في forceRefreshFromServer:', error);
    throw error;
  }
}

// وظيفة للتحقق من الاتصال بالإنترنت
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// دالة مساعدة لحفظ البيانات في التخزين الدائم
export async function saveData(key: string, value: any) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
    
    if (typeof indexedDB !== 'undefined') {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('HeaWaBas_Storage', 1);
        
        request.onupgradeneeded = function(event) {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('data_store')) {
            db.createObjectStore('data_store', { keyPath: 'key' });
          }
        };
        
        request.onsuccess = function(event) {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            const transaction = db.transaction(['data_store'], 'readwrite');
            const store = transaction.objectStore('data_store');
            
            const storeRequest = store.put({ key, value });
            
            storeRequest.onsuccess = function() {
              resolve(true);
            };
            
            storeRequest.onerror = function(e) {
              reject(e);
            };
          } catch (error) {
            reject(error);
          }
        };
        
        request.onerror = function(event) {
          reject(event);
        };
      });
    }
  } catch (error) {
    console.error(`Error saving data for key ${key}:`, error);
  }
} 