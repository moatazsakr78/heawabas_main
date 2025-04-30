-- حذف جميع سياسات RLS الموجودة على جدول storage.objects والمتعلقة بالـ bucket "product-images"

-- حذف سياسة القراءة
DROP POLICY IF EXISTS "السماح للجميع بقراءة صور المنتجات" ON storage.objects;

-- حذف سياسة الرفع (INSERT)
DROP POLICY IF EXISTS "السماح للمستخدمين المسجلين برفع صور المنتجات" ON storage.objects;

-- حذف سياسة التحديث
DROP POLICY IF EXISTS "السماح للمستخدمين المسجلين بتحديث صور المنتجات" ON storage.objects;

-- حذف سياسة الحذف
DROP POLICY IF EXISTS "السماح للمستخدمين المسجلين بحذف صور المنتجات" ON storage.objects;

-- إضافة سياسات جديدة مفتوحة بدون أي قيود على المستخدم أو الدور

-- سياسة للقراءة (SELECT) - مفتوحة للجميع
CREATE POLICY "open_select_product_images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- سياسة للإدخال (INSERT) - مفتوحة للجميع
CREATE POLICY "open_insert_product_images"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-images');

-- سياسة للتحديث (UPDATE) - مفتوحة للجميع
CREATE POLICY "open_update_product_images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- سياسة للحذف (DELETE) - مفتوحة للجميع
CREATE POLICY "open_delete_product_images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- رسالة تأكيد
DO $$
BEGIN
  RAISE NOTICE 'تم تطبيق سياسات وصول مفتوحة على bucket "product-images"';
END $$; 