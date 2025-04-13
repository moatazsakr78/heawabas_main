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
