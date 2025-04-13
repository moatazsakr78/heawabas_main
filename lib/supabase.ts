import { createClient } from '@supabase/supabase-js';
import { Product } from '@/types';
import { saveData } from './localStorage';

// إعدادات Supabase من متغيرات البيئة أو القيم الثابتة
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzdhtfmtaznscbxfykxy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZGh0Zm10YXpuc2NieGZ5a3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcxNTMzNzgsImV4cCI6MjAzMjcyOTM3OH0.Wbn1KGfCSYjNtvYSyDpjMDhHUw9E5iA-6YK2Qe16ZyY';

// إعداد خيارات العميل
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'HeaWaBas Web App',
    },
  },
  // تعيين مهلة للطلبات
  fetch: (url: RequestInfo, options?: RequestInit) => {
    return fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(30000), // مهلة 30 ثانية
    });
  },
};

// إنشاء عميل Supabase
export const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

// متغير عام للإشارة إلى آخر تحديث
let lastSyncTimestamp = 0;
// عند تهيئة التطبيق، نحاول استرجاع آخر وقت مزامنة من التخزين
if (typeof window !== 'undefined') {
  try {
    const savedTimestamp = localStorage.getItem('lastSyncTimestamp');
    if (savedTimestamp) {
      lastSyncTimestamp = parseInt(savedTimestamp, 10);
    }
  } catch (e) {
    console.error('خطأ في تحميل طابع المزامنة الزمني:', e);
  }
}

// دالة مساعدة لتحويل أسماء الحقول من صيغة الشرطة السفلية إلى الحالة الجملية
function mapDatabaseToAppModel(product: any) {
  if (!product) return null;
  
  return {
    id: product.id,
    name: product.name,
    productCode: product.product_code,
    boxQuantity: product.box_quantity,
    piecePrice: product.piece_price,
    packPrice: product.pack_price,
    boxPrice: product.box_price,
    imageUrl: product.image_url,
    isNew: product.is_new,
    createdAt: product.created_at || product.createdAt,
    categoryId: product.category_id
  };
}

// دالة مساعدة لتحويل أسماء الحقول من الحالة الجملية إلى صيغة الشرطة السفلية
function mapAppModelToDatabase(product: any) {
  if (!product) return null;
  
  console.log('تحويل المنتج:', product.id, 'createdAt:', product.createdAt);
  
  // إنشاء كائن النتيجة
  const result = {
    id: product.id,
    name: product.name,
    product_code: product.productCode,
    box_quantity: product.boxQuantity,
    piece_price: product.piecePrice,
    pack_price: product.packPrice,
    box_price: product.boxPrice,
    image_url: product.imageUrl,
    is_new: product.isNew,
    created_at: product.createdAt, // تحويل من createdAt إلى created_at
    category_id: product.categoryId
  };
  
  // طباعة الناتج للتحقق
  console.log('بعد التحويل:', result.id, 'created_at:', result.created_at);
  
  return result;
}

// دالة مساعدة لإنشاء جدول المنتجات يدوياً من خلال استعلام SQL مباشر
async function createProductsTable() {
  try {
    console.log('محاولة إنشاء جدول المنتجات مباشرة...');
    
    // استعلام SQL لإنشاء الجدول
    const { data, error } = await supabase.rpc('create_products_table_query');
    
    if (error) {
      // إذا فشلت الـ RPC، نحاول استخدام الطريقة البديلة باستخدام REST API
      console.error('فشل إنشاء الجدول باستخدام RPC:', error);
      
      // محاولة استخدام REST API
      const { error: restError } = await supabase
        .from('_products_creation_helper')
        .insert({ create_table: true })
        .select();
        
      if (restError) {
        console.error('فشل إنشاء الجدول باستخدام REST API:', restError);
        return false;
      }
      
      console.log('تم إنشاء جدول المنتجات باستخدام REST API');
      return true;
    }
    
    console.log('تم إنشاء جدول المنتجات بنجاح باستخدام RPC');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع أثناء محاولة إنشاء جدول المنتجات:', error);
    return false;
  }
}

// وظائف التعامل مع المنتجات
export async function saveProductsToSupabase(products: any[]) {
  try {
    if (!isOnline()) {
      console.error('خطأ المزامنة: لا يوجد اتصال بالإنترنت. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.');
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    if (!products || !Array.isArray(products)) {
      console.error('خطأ في بنية البيانات: المنتجات المقدمة ليست مصفوفة صالحة.', products);
      throw new Error('بيانات المنتجات غير صالحة: يجب أن تكون مصفوفة من المنتجات');
    }

    console.log('بدء حفظ المنتجات في Supabase...', products.length, 'منتج');
    
    // 1. تنظيف وتجهيز البيانات (حذف التكرارات)
    const uniqueProducts = products.filter((p, index, self) => 
      index === self.findIndex(t => t.id === p.id)
    );
    
    // طباعة أول منتج للتحقق
    if (uniqueProducts.length > 0) {
      console.log('نموذج منتج من التطبيق:', JSON.stringify(uniqueProducts[0]));
    } else {
      console.warn('تحذير: لا توجد منتجات للحفظ بعد تصفية المنتجات المكررة');
    }
    
    // 2. تحويل البيانات إلى الصيغة المطلوبة لقاعدة البيانات
    interface InvalidProduct {
      product: any;
      error: string;
    }
    
    const invalidProducts: InvalidProduct[] = [];
    const serializedProducts = uniqueProducts.map(product => {
      if (!product || typeof product !== 'object') {
        console.error('خطأ في بنية المنتج: المنتج ليس كائناً صالحاً', product);
        invalidProducts.push({ product, error: 'ليس كائناً صالحاً' });
        return null;
      }

      const dbProduct = mapAppModelToDatabase(product);
      
      // تأكد من أن البيانات صالحة
      if (!dbProduct) {
        console.warn('تم تخطي منتج غير صالح:', product?.id || 'بدون معرف', 'السبب: فشل التحويل إلى نموذج قاعدة البيانات');
        invalidProducts.push({ product, error: 'فشل التحويل إلى نموذج قاعدة البيانات' });
        return null;
      }
      
      // تأكد من أن التاريخ سلسلة نصية
      if (dbProduct.created_at instanceof Date) {
        dbProduct.created_at = dbProduct.created_at.toISOString();
      } else if (dbProduct.created_at === undefined || dbProduct.created_at === null) {
        console.warn('تحذير: تاريخ إنشاء غير محدد للمنتج:', dbProduct.id);
        dbProduct.created_at = new Date().toISOString();
      } else if (typeof dbProduct.created_at !== 'string') {
        console.warn('تحذير: تنسيق تاريخ إنشاء غير صالح للمنتج:', dbProduct.id);
        try {
          dbProduct.created_at = new Date(dbProduct.created_at).toISOString();
        } catch (error) {
          console.error('خطأ في تحويل التاريخ:', error);
          dbProduct.created_at = new Date().toISOString();
        }
      }
      
      // تأكد من وجود معرف صالح
      if (!dbProduct.id || dbProduct.id.trim() === '') {
        console.warn('تحذير: معرف غير صالح للمنتج. إنشاء معرف جديد.');
        dbProduct.id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      }
      
      return dbProduct;
    }).filter(Boolean); // استبعاد القيم null
    
    if (serializedProducts.length === 0) {
      console.error('خطأ: لا توجد منتجات للحفظ بعد التحقق من الصلاحية.', 
        invalidProducts.length > 0 ? 
          `تم رفض ${invalidProducts.length} منتج، أسباب الرفض: ${JSON.stringify(invalidProducts.map(p => p.error))}` : 
          'لم تقدم أي منتجات صالحة');
      throw new Error('لا توجد منتجات صالحة للحفظ');
    }
    
    // طباعة نموذج للتحقق بعد التحويل
    console.log('نموذج المنتج للإدراج بعد التحويل:', JSON.stringify(serializedProducts[0]));
    
    // 3. حاول الإدراج باستخدام الطلب المباشر
    try {
      console.log('إدراج المنتجات باستخدام طلب مباشر...');
      
      const response = await fetch(`${supabaseUrl}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(serializedProducts)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('خطأ في إدراج المنتجات:', response.status, response.statusText);
        console.error('تفاصيل الخطأ من الخادم:', errorText);
        
        // تحليل نوع الخطأ وتقديم رسالة أكثر تحديداً
        let errorDetails = 'خطأ غير معروف في الاتصال بالخادم';
        
        if (response.status === 401 || response.status === 403) {
          errorDetails = 'خطأ في المصادقة: تحقق من صلاحية مفتاح API الخاص بك ومن الصلاحيات المناسبة للجدول.';
        } else if (response.status === 404) {
          errorDetails = 'لم يتم العثور على جدول المنتجات: تأكد من إنشاء جدول المنتجات في Supabase.';
        } else if (response.status === 409) {
          errorDetails = 'تعارض في البيانات: ربما تكون هناك منتجات مكررة أو مخالفة للقيود الفريدة.';
        } else if (response.status === 422) {
          errorDetails = 'بيانات غير صالحة: تأكد من أن هيكل المنتجات يتوافق مع مخطط قاعدة البيانات.';
        } else if (response.status >= 500) {
          errorDetails = 'خطأ في خادم Supabase: يرجى المحاولة مرة أخرى لاحقاً أو التحقق من حالة الخدمة.';
        }
        
        throw new Error(`فشل الإدراج: ${response.status} ${errorDetails} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('تم إدراج المنتجات بنجاح:', responseData.length);
      
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
      
      // تحويل البيانات المسترجعة إلى نموذج التطبيق
      const appModels = responseData.map(mapDatabaseToAppModel);
      return appModels;
    } catch (directError) {
      console.error('فشل الطلب المباشر:', directError);
      
      // 4. إذا فشل الطلب المباشر، حاول باستخدام واجهة Supabase
      console.log('محاولة استخدام واجهة Supabase كحل بديل...');
      
      // حاول إدراج واحد تلو الآخر بدلاً من دفعة واحدة
      const results = [];
      
      interface ProductError {
        productId: string;
        error: string;
        code?: string;
        details?: string;
        hint?: string;
        stack?: string;
      }
      
      const errors: ProductError[] = [];
      
      for (const product of serializedProducts) {
        // تخطي المنتجات غير الصالحة
        if (!product || !product.id) {
          console.warn('تخطي منتج غير صالح في الإدراج الفردي');
          continue;
        }
        
        try {
          const { data, error } = await supabase
            .from('products')
            .insert(product)
            .select();
          
          if (error) {
            console.error(`خطأ في إدراج المنتج ${product.id}:`, error);
            errors.push({
              productId: product.id,
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint || 'لا توجد تلميحات إضافية'
            });
          } else if (data && data.length > 0) {
            console.log(`تم إدراج المنتج بنجاح: ${product.id}`);
            results.push(mapDatabaseToAppModel(data[0]));
          } else {
            console.warn(`لم يتم إرجاع بيانات للمنتج المدرج: ${product.id}`);
          }
        } catch (singleError: unknown) {
          const error = singleError as Error;
          console.error(`استثناء في إدراج المنتج الفردي ${product.id}:`, error);
          errors.push({
            productId: product.id,
            error: error.message || 'خطأ غير معروف',
            stack: error.stack
          });
        }
      }
      
      if (results.length > 0) {
        console.log(`تم إدراج ${results.length} من ${serializedProducts.length} منتج`);
        
        if (errors.length > 0) {
          console.warn(`فشل إدراج ${errors.length} منتج. تفاصيل الأخطاء:`, JSON.stringify(errors, null, 2));
        }
        
        return results;
      }
      
      // إذا فشلت جميع المحاولات، أظهر تفاصيل الأخطاء وارجع المنتجات الأصلية
      if (errors.length > 0) {
        console.error('فشلت جميع محاولات الإدراج. تفاصيل الأخطاء:', JSON.stringify(errors, null, 2));
        
        // تحليل الأخطاء الشائعة وتقديم نصائح محددة
        interface ErrorCounts {
          [key: string]: number;
        }
        
        const commonErrors: ErrorCounts = errors.reduce((acc: ErrorCounts, curr) => {
          const errorType = curr.code || curr.error || 'unknown';
          acc[errorType] = (acc[errorType] || 0) + 1;
          return acc;
        }, {});
        
        console.error('تحليل الأخطاء الشائعة:', commonErrors);
        
        let errorHint = 'تحقق من الاتصال بالإنترنت وهيكل البيانات وإعدادات Supabase.';
        if (commonErrors['23505']) {
          errorHint = 'أخطاء تكرار المعرفات: تأكد من أن جميع المنتجات لها معرفات فريدة.';
        } else if (commonErrors['42P01']) {
          errorHint = 'الجدول غير موجود: تأكد من إنشاء جدول المنتجات في Supabase.';
        } else if (commonErrors['23502']) {
          errorHint = 'حقول إلزامية مفقودة: تأكد من ملء جميع الحقول المطلوبة.';
        } else if (commonErrors['42703']) {
          errorHint = 'حقول غير موجودة: تأكد من تطابق هيكل البيانات مع مخطط قاعدة البيانات.';
        } else if (commonErrors['unauthorized']) {
          errorHint = 'خطأ في المصادقة: تحقق من صلاحية مفتاح API ومن الصلاحيات المناسبة.';
        }
        
        throw new Error(`فشلت مزامنة المنتجات: ${errorHint}`);
      }
      
      console.log('فشلت جميع محاولات الإدراج، استخدام البيانات المحلية فقط');
      return uniqueProducts; // إرجاع البيانات الأصلية بعد إزالة التكرارات
    }
  } catch (error: any) {
    console.error('خطأ في saveProductsToSupabase:', error);
    
    // تحسين رسالة الخطأ للمستخدم بناءً على نوع الخطأ
    let userFriendlyError = error.message || 'حدث خطأ غير معروف أثناء حفظ المنتجات';
    
    if (userFriendlyError.includes('fetch')) {
      userFriendlyError = 'فشل الاتصال بخادم Supabase. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
    } else if (userFriendlyError.includes('timeout')) {
      userFriendlyError = 'انتهت مهلة الطلب. قد يكون الخادم بطيئًا أو الاتصال ضعيفًا. حاول مرة أخرى.';
    } else if (userFriendlyError.includes('parse') || userFriendlyError.includes('JSON')) {
      userFriendlyError = 'خطأ في تنسيق البيانات. تأكد من أن المنتجات بصيغة صحيحة.';
    }
    
    error.userFriendlyMessage = userFriendlyError;
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
      .order('created_at', { ascending: false });
    
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
    
    // تحويل البيانات إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    return appModels;
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
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log('تم العثور على البيانات في السيرفر:', data.length);
        // تحويل البيانات إلى نموذج التطبيق
        serverData = data.map(mapDatabaseToAppModel);
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
        
        // تحويل البيانات إلى تنسيق قاعدة البيانات
        const dbProducts = uniqueProducts.map((product: any) => {
          const dbProduct = mapAppModelToDatabase(product);
          
          if (dbProduct && dbProduct.created_at instanceof Date) {
            dbProduct.created_at = dbProduct.created_at.toISOString();
          }
          
          return dbProduct || {};
        });
        
        // رفع البيانات المحلية
        const { data, error } = await supabase
          .from('products')
          .insert(dbProducts)
          .select();
        
        if (error) {
          throw error;
        }
        
        console.log('تم رفع البيانات المحلية بنجاح:', data.length);
        
        // تحويل البيانات المسترجعة إلى نموذج التطبيق
        const appModels = data.map(mapDatabaseToAppModel);
        
        // تحديث الطابع الزمني للمزامنة
        lastSyncTimestamp = Date.now();
        localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
        
        return appModels;
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
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد بيانات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل البيانات بنجاح من السيرفر:', data.length);
    
    // تحويل البيانات إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    
    // تحديث البيانات المحلية
    localStorage.setItem('products', JSON.stringify(appModels));
    try {
      await saveData('products', appModels);
    } catch (e) {
      console.error('خطأ في حفظ البيانات في التخزين الدائم:', e);
    }
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    
    // إعلام التطبيق بالتغييرات بضمان التنفيذ بعد التخزين
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('customStorageChange', { 
            detail: { type: 'products', timestamp: Date.now(), source: 'server' }
          }));
          console.log('تم إرسال إشعارات تحديث البيانات بنجاح');
        } catch (e) {
          console.error('خطأ أثناء إرسال إشعارات تحديث البيانات:', e);
        }
      }
    }, 100);
    
    return appModels;
  } catch (error) {
    console.error('خطأ في forceRefreshFromServer:', error);
    throw error;
  }
}

// وظيفة للتحقق من الاتصال بالإنترنت
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
} 