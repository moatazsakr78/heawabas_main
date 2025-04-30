# استراتيجية تقليل Egress في مشروع Supabase

هذا المستند يشرح الاستراتيجيات والتقنيات المستخدمة لتقليل استهلاك Egress (البيانات الخارجة) من Supabase، وتحسين الأداء العام للتطبيق، وتقليل التكاليف.

## المشكلة

Supabase يحسب تكاليف البيانات الخارجة (Egress) عند تجاوز حد معين. يمكن أن تزداد هذه التكاليف بشكل كبير خاصة عند تحميل ملفات كبيرة مثل الصور مرارًا وتكرارًا.

## الحلول المطبقة

### 1. تخزين الصور في Supabase Storage بدلاً من قاعدة البيانات

بدلاً من تخزين الصور مباشرة في جداول قاعدة البيانات (كـ BLOB أو Base64)، نقوم بتخزينها في خدمة Supabase Storage ونحتفظ فقط برابط الصورة في الجدول.

```sql
-- بنية جدول المنتجات مع حقل image_url فقط
CREATE TABLE IF NOT EXISTS products (
  -- حقول أخرى
  image_url TEXT,
  -- حقول أخرى
);
```

### 2. ضغط الصور قبل رفعها

نقوم بتقليل حجم الصور قبل رفعها إلى Supabase Storage:

1. تغيير أبعاد الصور الكبيرة لتناسب الحد الأقصى (1200px)
2. ضغط الصور بجودة محددة (80%)
3. تحويل الصور إلى JPEG عند الإمكان لتوفير المساحة

هذه العملية تتم في ملف `images.ts`:

```typescript
// ضغط الصورة قبل الرفع
export async function compressImage(file: File): Promise<File> {
  // الحصول على إعدادات الضغط
  const settings = await getImageSettings();
  const quality = settings.compression_quality / 100;
  const maxWidth = settings.max_width;
  
  // تغيير حجم الصورة وضغطها
  // ...
}
```

### 3. تعيين Cache-Control Headers لفترة طويلة

نقوم بتعيين `Cache-Control` header للصور بقيمة `max-age=31536000` (سنة كاملة) لمنع إعادة التحميل من Supabase في كل زيارة:

```typescript
// رفع الصورة مع تعيين Cache-Control header
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  // ...
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, compressedFile, {
      cacheControl: `public, max-age=${settings.cache_duration_seconds}`,
      contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
      upsert: true
    });
  // ...
}
```

### 4. استخدام Service Worker للتخزين المؤقت

نستخدم Service Worker لتخزين الصور في cache المتصفح واستخدامها دون الحاجة للتحميل من الخادم في كل مرة:

```javascript
// في sw.js
self.addEventListener('fetch', (event) => {
  // التحقق مما إذا كان الطلب لصورة منتج
  if (PRODUCT_IMAGES_REGEX.test(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // إذا كانت الصورة موجودة في cache، نعيدها مباشرة
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // إذا لم تكن الصورة في cache، نقوم بطلبها من الشبكة وتخزينها
        // ...
      })
    );
  }
});
```

### 5. Lazy Loading للصور

نستخدم تقنية Lazy Loading لتحميل الصور فقط عندما تظهر في نطاق العرض المرئي:

```tsx
// في مكون ProductCard
<Image
  src={imageSrc}
  alt={product.name}
  loading="lazy" // تحميل الصورة فقط عند الحاجة
  // ...
/>
```

### 6. تحميل تدريجي للمنتجات (Infinite Scroll)

بدلاً من تحميل جميع المنتجات وصورها مرة واحدة، نقوم بتحميل 8 منتجات فقط في البداية، ثم نحمل المزيد عند التمرير:

```tsx
// في مكون ProductGrid
// عرض المنتجات المرئية فقط
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
  {visibleProducts.map((product, index) => (
    <ProductCard 
      key={product.id} 
      product={product} 
      priority={index < INITIAL_PRODUCTS_COUNT}
    />
  ))}
</div>

// عنصر التحميل عند التمرير
{hasMore && (
  <div ref={loadMoreRef} className="flex justify-center mt-8 py-4">
    {/* ... */}
  </div>
)}
```

## Edge Function لمعالجة الصور

تم إنشاء Edge Function في Supabase تعمل عند تحميل الصور لتأكيد تطبيق إعدادات الـ caching وإضافة معالجة إضافية للصور:

```typescript
// في supabase/functions/optimize-images/index.ts
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
```

## إعدادات SQL

تم تضمين الإعدادات والوظائف اللازمة في ملفات SQL:

1. `database-setup.sql`: يحتوي على بنية الجداول والإعدادات الافتراضية للصور
2. `security-policies.sql`: يحتوي على سياسات الوصول للـ Storage ومحفزات معالجة الصور

## أفضل الممارسات الإضافية

1. استخدم حجم `quality: 85` للصور بدلاً من 100 للتوازن بين الجودة وحجم الملف
2. اعرض صورًا منخفضة الدقة كـ placeholder أثناء تحميل الصور الفعلية
3. استخدم `next/image` مع خاصية `sizes` لتحميل الصور بالحجم المناسب للشاشة

## النتائج المتوقعة

باستخدام هذه الاستراتيجيات مجتمعة، يمكن تقليل استهلاك Egress بنسبة تصل إلى 90% مقارنة بالطرق التقليدية، وتحسين أداء التطبيق وتجربة المستخدم بشكل كبير. 