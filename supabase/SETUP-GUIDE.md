# دليل إعداد مشروع Supabase لتقليل Egress

هذا الدليل يشرح خطوات إعداد مشروع Supabase جديد مع تطبيق استراتيجيات تقليل استهلاك Egress لتحسين الأداء وتقليل التكاليف.

## الخطوة 1: إنشاء مشروع Supabase جديد

1. قم بتسجيل الدخول إلى [لوحة تحكم Supabase](https://app.supabase.io)
2. انقر على زر "New Project"
3. اختر منظمتك وقم بتعيين اسم للمشروع
4. قم بتعيين كلمة مرور قوية لقاعدة البيانات
5. اختر المنطقة الأقرب جغرافياً لمستخدميك
6. انتظر حتى يتم إنشاء المشروع

## الخطوة 2: إعداد تخزين الصور

1. انتقل إلى قسم "Storage" في لوحة تحكم Supabase
2. أنشئ bucket جديد باسم "product-images"
3. قم بتعيين الإعدادات التالية:
   - اختر "Public" لإتاحة الصور للعامة
   - قم بتعيين حد حجم الملف إلى 10MB
   - قم بتحديد أنواع الملفات المسموح بها (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)

## الخطوة 3: تطبيق سياسات الأمان

افتح محرر SQL في Supabase وقم بتنفيذ الاستعلامات التالية:

### إنشاء الجداول وإعدادات الصور

```sql
-- إنشاء جدول المنتجات
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_code TEXT,
  box_quantity INTEGER,
  piece_price NUMERIC,
  pack_price NUMERIC,
  box_price NUMERIC,
  image_url TEXT,
  is_new BOOLEAN DEFAULT TRUE,
  category_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء جدول إعدادات التطبيق
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة إعدادات افتراضية للصور
INSERT INTO app_settings (key, value)
VALUES ('image_settings', '{"compression_quality": 80, "max_width": 1200, "cache_duration_seconds": 31536000}')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
```

### إعداد سياسات الأمان للتخزين

```sql
-- سياسات Storage لصور المنتجات
-- السماح للجميع بقراءة صور المنتجات
CREATE POLICY "السماح للجميع بقراءة صور المنتجات"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'product-images');

-- السماح للمستخدمين المسجلين فقط برفع الصور
CREATE POLICY "السماح للمستخدمين المسجلين برفع صور المنتجات"
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- السماح للمستخدمين المسجلين بتحديث الصور التي قاموا برفعها
CREATE POLICY "السماح للمستخدمين المسجلين بتحديث صور المنتجات"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- السماح للمستخدمين المسجلين بحذف الصور التي قاموا برفعها
CREATE POLICY "السماح للمستخدمين المسجلين بحذف صور المنتجات"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
```

## الخطوة 4: إنشاء Edge Function لمعالجة الصور

1. قم بتثبيت أدوات Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. قم بإنشاء Edge Function:
   ```bash
   supabase functions new optimize-images
   ```

3. افتح ملف `supabase/functions/optimize-images/index.ts` وقم بنسخ الكود التالي:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // التعامل مع طلبات CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // قراءة الإعدادات من الطلب
    const body = await req.json();
    const { bucketId, objectName, eventType } = body;

    // التحقق من أنه حدث تحميل في bucket صور المنتجات
    if (eventType !== 'INSERT' || bucketId !== 'product-images') {
      return new Response(
        JSON.stringify({ message: 'Not a relevant event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // إنشاء عميل Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // الحصول على إعدادات الصور من جدول الإعدادات
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'image_settings')
      .single();

    if (settingsError) {
      console.error('Error fetching image settings:', settingsError);
      throw settingsError;
    }

    const settings = settingsData.value;
    const cacheDuration = settings.cache_duration_seconds || 31536000; // سنة كاملة

    // تحديث الـ metadata للملف لتعيين cache-control header
    const { error: updateError } = await supabaseAdmin
      .storage
      .from(bucketId)
      .updateBucket({
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        corsConfigurations: [
          {
            allowedMethods: ['GET'],
            allowedOrigins: ['*'],
            maxAgeSeconds: cacheDuration
          }
        ]
      });

    if (updateError) {
      console.error('Error updating bucket settings:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Image processed successfully',
        objectName,
        cacheControl: `public, max-age=${cacheDuration}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error processing image:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

4. نشر Edge Function:
   ```bash
   supabase functions deploy optimize-images --project-ref your-project-ref
   ```

## الخطوة 5: إعداد تطبيق الواجهة الأمامية

### إضافة الوظائف لمعالجة الصور

أنشئ ملف `lib/images.ts` في مشروعك وأضف الكود التالي:

```typescript
import { supabase } from './supabase';

// الحصول على إعدادات الصور من Supabase
export async function getImageSettings() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'image_settings')
      .single();

    if (error) {
      console.error('Error fetching image settings:', error);
      // قيم افتراضية في حالة حدوث خطأ
      return {
        compression_quality: 80,
        max_width: 1200,
        cache_duration_seconds: 31536000 // سنة كاملة
      };
    }

    return data.value;
  } catch (error) {
    console.error('Error in getImageSettings:', error);
    // قيم افتراضية في حالة حدوث استثناء
    return {
      compression_quality: 80,
      max_width: 1200,
      cache_duration_seconds: 31536000 // سنة كاملة
    };
  }
}

// ضغط الصورة قبل الرفع لتقليل الحجم
export async function compressImage(file: File): Promise<File> {
  try {
    // الحصول على إعدادات الصور
    const settings = await getImageSettings();
    const quality = settings.compression_quality / 100; // تحويل النسبة المئوية إلى قيمة بين 0 و 1
    const maxWidth = settings.max_width;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          // حساب الأبعاد الجديدة مع الحفاظ على نسبة العرض إلى الارتفاع
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = height * ratio;
          }

          // إنشاء كانفاس للصورة المضغوطة
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // رسم الصورة على الكانفاس بالأبعاد الجديدة
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // تحويل الكانفاس إلى blob بجودة مضغوطة
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              
              // إنشاء ملف جديد من البلوب
              const compressedFile = new File(
                [blob],
                file.name,
                { type: 'image/jpeg', lastModified: Date.now() }
              );
              
              console.log(`Original size: ${file.size}, Compressed size: ${compressedFile.size}, Reduction: ${(1 - compressedFile.size / file.size) * 100}%`);
              
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  } catch (error) {
    console.error('Error in compressImage:', error);
    return file; // إرجاع الملف الأصلي في حالة حدوث خطأ
  }
}

// رفع الصورة إلى Supabase Storage مع تعيين Cache-Control header
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  try {
    // ضغط الصورة قبل الرفع
    const compressedFile = await compressImage(file);
    
    // إنشاء اسم فريد للملف باستخدام معرف المنتج وطابع الوقت
    const fileExt = file.name.split('.').pop();
    const fileName = `${productId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    
    // الحصول على مدة الـ cache من الإعدادات
    const settings = await getImageSettings();
    
    // رفع الملف إلى Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, compressedFile, {
        cacheControl: `public, max-age=${settings.cache_duration_seconds}`,
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
    
    // إنشاء رابط عام للصورة
    const { data: publicUrl } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);
    
    return publicUrl.publicUrl;
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    throw error;
  }
}

// حذف صورة منتج من Storage عند الحاجة
export async function deleteProductImage(imageUrl: string): Promise<void> {
  try {
    // استخراج اسم الملف من الرابط الكامل
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // حذف الملف من Storage
    const { error } = await supabase.storage
      .from('product-images')
      .remove([fileName]);
    
    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
    
    console.log('Image deleted successfully:', fileName);
  } catch (error) {
    console.error('Error in deleteProductImage:', error);
    throw error;
  }
}
```

### إنشاء Service Worker لتخزين الصور

1. أنشئ ملف `public/sw.js` وأضف الكود التالي:

```javascript
// Service Worker لتخزين الصور في cache بشكل فعال
const CACHE_NAME = 'product-images-cache-v1';
const PRODUCT_IMAGES_REGEX = /.*\.supabase\.co\/storage\/v1\/object\/public\/product-images\/.*/;

// عند تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});

// عند تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(clients.claim());
  
  // حذف ذاكرة التخزين المؤقت القديمة
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// التقاط طلبات الشبكة
self.addEventListener('fetch', (event) => {
  // التحقق مما إذا كان الطلب لصورة منتج
  if (PRODUCT_IMAGES_REGEX.test(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // إذا كانت الصورة موجودة في cache، نعيدها مباشرة
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // إذا لم تكن الصورة في cache، نقوم بطلبها من الشبكة
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          
          // نقوم بنسخ الاستجابة لأن الجسم يمكن استخدامه مرة واحدة فقط
          const responseToCache = networkResponse.clone();
          
          // نضيف الاستجابة إلى cache
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        });
      })
    );
  }
});
```

2. أنشئ مكون لتسجيل Service Worker:

```typescript
// components/ServiceWorkerRegistration.tsx
'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}
```

3. استخدم المكون في ملف `layout.tsx`:

```tsx
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ServiceWorkerRegistration />
        {/* باقي محتوى الصفحة */}
        {children}
      </body>
    </html>
  );
}
```

## الخطوة 6: تنفيذ Lazy Loading وتحميل تدريجي للصور

1. أنشئ مكون منتج يدعم Lazy Loading:

```tsx
// components/ProductCard.tsx
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function ProductCard({ product, priority = false }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <div>
      {product.imageUrl && (
        <div className="relative h-64">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
            className={`object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            priority={priority}
            quality={85}
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      )}
      
      {/* باقي معلومات المنتج */}
    </div>
  );
}
```

2. أنشئ شبكة منتجات مع تحميل تدريجي:

```tsx
// components/ProductGrid.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProductCard from './ProductCard';

// يتم عرض 8 منتجات في البداية، ثم تحميل المزيد عند التمرير
const INITIAL_PRODUCTS_COUNT = 8;
const PRODUCTS_PER_PAGE = 8;

export default function ProductGrid({ products }) {
  const [visibleProducts, setVisibleProducts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [productPage, setProductPage] = useState(1);
  const loadMoreRef = useRef(null);
  
  // تهيئة المنتجات المرئية الأولية
  useEffect(() => {
    const initialProducts = products.slice(0, INITIAL_PRODUCTS_COUNT);
    setVisibleProducts(initialProducts);
    setHasMore(products.length > INITIAL_PRODUCTS_COUNT);
  }, [products]);
  
  // دالة لتحميل المزيد من المنتجات
  const loadMoreProducts = useCallback(() => {
    const startIndex = productPage * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    const newProducts = products.slice(startIndex, endIndex);
    
    setVisibleProducts(prev => [...prev, ...newProducts]);
    setProductPage(prev => prev + 1);
    setHasMore(endIndex < products.length);
  }, [productPage, products]);
  
  // إعداد مراقب التقاطع للتمرير اللانهائي
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1 }
    );
    
    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMoreProducts, hasMore]);
  
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleProducts.map((product, index) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            priority={index < INITIAL_PRODUCTS_COUNT} 
          />
        ))}
      </div>
      
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center mt-8 py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
```

## الخلاصة

باتباع هذه الخطوات، ستقوم بإنشاء مشروع Supabase مُهيّأ لتقليل استهلاك Egress من خلال:

1. تخزين الصور في Supabase Storage بدلاً من قاعدة البيانات
2. ضغط الصور قبل رفعها لتقليل الحجم
3. تعيين Cache-Control header للصور للتخزين المؤقت لمدة سنة كاملة
4. استخدام Service Worker للتخزين المؤقت في المتصفح
5. تطبيق Lazy Loading للصور
6. تنفيذ تحميل تدريجي للمنتجات (8 منتجات في البداية، ثم المزيد عند التمرير)

هذه الإستراتيجيات مجتمعة ستؤدي إلى تقليل استهلاك Egress بشكل كبير، وتحسين أداء التطبيق، وتوفير تكاليف استضافة المشروع. 