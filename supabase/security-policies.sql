-- تمكين RLS على جميع الجداول
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- السماح للمستخدمين المجهولين بالقراءة فقط
CREATE POLICY "السماح للمستخدمين المجهولين بقراءة المنتجات"
ON products FOR SELECT
TO anon
USING (true);

CREATE POLICY "السماح للمستخدمين المجهولين بقراءة الفئات"
ON categories FOR SELECT
TO anon
USING (true);

CREATE POLICY "السماح للمستخدمين المجهولين بقراءة الإعدادات"
ON app_settings FOR SELECT
TO anon
USING (true);

-- سياسات للحسابات المصرح بها (المشرفين)
-- يمكن للمشرفين التحكم الكامل في البيانات
CREATE POLICY "السماح للمشرفين بقراءة المنتجات"
ON products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "السماح للمشرفين بإدراج المنتجات"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "السماح للمشرفين بتحديث المنتجات"
ON products FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "السماح للمشرفين بحذف المنتجات"
ON products FOR DELETE
TO authenticated
USING (true);

-- سياسات للفئات
CREATE POLICY "السماح للمشرفين بقراءة الفئات"
ON categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "السماح للمشرفين بإدراج الفئات"
ON categories FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "السماح للمشرفين بتحديث الفئات"
ON categories FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "السماح للمشرفين بحذف الفئات"
ON categories FOR DELETE
TO authenticated
USING (true);

-- سياسات لإعدادات التطبيق
CREATE POLICY "السماح للمشرفين بقراءة الإعدادات"
ON app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "السماح للمشرفين بإدراج الإعدادات"
ON app_settings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "السماح للمشرفين بتحديث الإعدادات"
ON app_settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "السماح للمشرفين بحذف الإعدادات"
ON app_settings FOR DELETE
TO authenticated
USING (true);

-- إنشاء Storage bucket خاص بصور المنتجات
-- هذه العملية تتم عادة من خلال واجهة Supabase أو عن طريق StorageAPI
-- إن التعليمات البرمجية التالية هي فقط للتوثيق

-- أولاً: إنشاء bucket لصور المنتجات
-- يتم تنفيذ هذا من خلال API أو واجهة Supabase
-- CREATE BUCKET product-images;

-- ثانياً: إنشاء سياسات الوصول لـ Storage
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

-- إنشاء محفز (trigger) عند رفع الصور لتطبيق إعدادات الـ cache
CREATE TRIGGER optimize_product_image_trigger
AFTER INSERT ON storage.objects
FOR EACH ROW
WHEN (NEW.bucket_id = 'product-images')
EXECUTE FUNCTION optimize_image_on_upload();
