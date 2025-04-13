# إعداد Supabase لتطبيق كتالوج المنتجات

## الخطوات الأساسية لإعداد قاعدة البيانات

1. قم بإنشاء حساب على منصة Supabase مجاناً من خلال https://supabase.com

2. أنشئ مشروع جديد باسم 'product-catalog' أو اسم آخر

3. انتقل لقسم SQL في واجهة البرمجة

4. قم بتحميل ملف 'database-setup.sql' الذي يحتوي على هيكل قاعدة البيانات

5. اضغط على زر 'تنفيذ' لإنشاء الهياكل الأساسية

6. قم بتنفيذ ملف 'security-policies.sql' لإعداد سياسات الأمان

## هيكل قاعدة البيانات

### جدول الفئات (categories)

- id: معرف فريد للفئة
- name: اسم الفئة
- slug: اسم مختصر للفئة للاستخدام في URLs
- image: مسار صورة الفئة
- description: وصف الفئة
- created_at: تاريخ إنشاء الفئة
- updated_at: تاريخ آخر تحديث للفئة

### جدول المنتجات (products)

- id: معرف فريد للمنتج
- name: اسم المنتج
- product_code: رمز المنتج
- box_quantity: كمية العلبة
- piece_price: سعر القطعة
- pack_price: سعر الدستة
- box_price: سعر الكرتونة
- image_url: مسار صورة المنتج
- is_new: علامة تشير إلى ما إذا كان المنتج جديداً
- createdAt: تاريخ إنشاء المنتج (بتنسيق نصي)
- category_id: مؤشر للفئة التي ينتمي إليها المنتج
- created_at: تاريخ إنشاء المنتج (من النظام)
- updated_at: تاريخ آخر تحديث للمنتج

### جدول إعدادات التطبيق (app_settings)

- id: معرف فريد للإعداد
- key: مفتاح الإعداد
- value: قيمة الإعداد (JSONB)
- created_at: تاريخ إنشاء الإعداد
- updated_at: تاريخ آخر تحديث للإعداد

## تحديث معلومات الاتصال

بعد إنشاء المشروع، قم بتحديث ملف `lib/supabase.ts` بمعلومات الاتصال الجديدة:

```typescript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

يمكنك العثور على هذه المعلومات في لوحة تحكم Supabase تحت قسم "Project Settings" > "API".
