# ترحيل الصور من تنسيق Base64 إلى Supabase Storage

تم تعديل التطبيق لاستخدام Supabase Storage بدلاً من تخزين الصور كـ Base64 في قاعدة البيانات. هذا التغيير يوفر العديد من الفوائد:

1. **تقليل حجم قاعدة البيانات**: لم تعد الصور تُخزن كسلاسل طويلة من البيانات المشفرة.
2. **تقليل استهلاك Egress**: تم تطبيق إعدادات التخزين المؤقت (Cache) لمدة سنة كاملة.
3. **تحسين الأداء**: تحميل الصور أسرع وتستهلك موارد أقل.
4. **ضغط الصور تلقائيًا**: يتم تقليل حجم الصور قبل رفعها.

## التغييرات الرئيسية

1. تم إنشاء مكتبة `lib/images.ts` لإدارة معالجة الصور:
   - `compressImage()`: ضغط الصور قبل رفعها
   - `uploadProductImage()`: رفع الصور إلى Supabase Storage
   - `deleteProductImage()`: حذف الصور من التخزين

2. تم تعديل صفحة إدارة المنتجات:
   - تغيير وظيفة رفع الصور لاستخدام Supabase Storage
   - تخزين فقط رابط الصورة (URL) في قاعدة البيانات
   - إضافة منطق لحذف الصور القديمة عند تحديث المنتج

3. تم إنشاء سكربت ترحيل:
   - أداة `tools/migrate-images.js` لتحويل الصور الموجودة من Base64 إلى Supabase Storage

## إعداد Storage في Supabase

تم إنشاء ملف SQL `supabase/setup-storage.sql` لتهيئة Storage في Supabase:

1. إنشاء bucket "product-images"
2. تعيين إعدادات الوصول والأمان
3. تعيين سياسات RLS (Row Level Security) للقراءة والكتابة
4. إضافة إعدادات الصور في جدول `app_settings`

## كيفية ترحيل الصور الموجودة

لترحيل الصور الموجودة بالفعل من تنسيق Base64 إلى Supabase Storage:

1. تأكد من تشغيل Supabase SQL لإنشاء البنية اللازمة:

```bash
# تنفيذ SQL على مشروع Supabase
npx supabase db push
```

2. قم بتشغيل سكربت الترحيل:

```bash
# تثبيت الاعتماديات المطلوبة
npm install dotenv --save-dev

# تشغيل سكربت الترحيل
node tools/migrate-images.js
```

سيقوم هذا السكربت بما يلي:
- البحث عن جميع المنتجات التي تستخدم صور Base64
- تحويل كل صورة إلى ملف
- رفع الملف إلى Supabase Storage
- تحديث المنتج برابط الصورة الجديد

## إعدادات تحسين الأداء

تم تطبيق الإعدادات التالية لتحسين أداء الصور:

1. **ضغط الصور**: تقليل حجم الصور قبل رفعها (جودة 80%)
2. **تغيير حجم الصور الكبيرة**: تقليل أبعاد الصور إلى 1200 بكسل كحد أقصى
3. **تحسين Cache**: تعيين Cache-Control header لمدة سنة كاملة (31536000 ثانية)

## ملاحظات مهمة

1. يجب التأكد من وجود bucket "product-images" في Supabase قبل استخدام السكربت
2. الصور القديمة بتنسيق Base64 ستبقى في قاعدة البيانات حتى يتم ترحيلها
3. لا يتم حذف أي بيانات من قاعدة البيانات تلقائيًا، يجب تشغيل سكربت الترحيل لتحديث الروابط 