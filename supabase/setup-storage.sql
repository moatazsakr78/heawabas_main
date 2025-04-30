-- تهيئة Supabase Storage للمشروع

-- إنشاء bucket جديد للصور إذا لم يكن موجودًا
SELECT
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM storage.buckets WHERE name = 'product-images'
    )
    THEN (
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('product-images', 'product-images', true)
      RETURNING 'تم إنشاء bucket جديد'
    )
    ELSE 'bucket موجود بالفعل'
  END AS result;

-- تعيين الإعدادات المناسبة للـ bucket
UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 10485760, -- 10MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE 
  name = 'product-images';

-- إنشاء سياسات الوصول للتخزين
-- السماح للجميع بقراءة صور المنتجات
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE policyname = 'السماح للجميع بقراءة صور المنتجات'
  ) THEN
    CREATE POLICY "السماح للجميع بقراءة صور المنتجات"
    ON storage.objects FOR SELECT
    TO anon
    USING (bucket_id = 'product-images');
  END IF;
END $$;

-- السماح للمستخدمين المسجلين فقط برفع الصور
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE policyname = 'السماح للمستخدمين المسجلين برفع صور المنتجات'
  ) THEN
    CREATE POLICY "السماح للمستخدمين المسجلين برفع صور المنتجات"
    ON storage.objects FOR INSERT 
    TO authenticated
    WITH CHECK (bucket_id = 'product-images');
  END IF;
END $$;

-- السماح للمستخدمين المسجلين بتحديث الصور
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE policyname = 'السماح للمستخدمين المسجلين بتحديث صور المنتجات'
  ) THEN
    CREATE POLICY "السماح للمستخدمين المسجلين بتحديث صور المنتجات"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'product-images');
  END IF;
END $$;

-- السماح للمستخدمين المسجلين بحذف الصور
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE policyname = 'السماح للمستخدمين المسجلين بحذف صور المنتجات'
  ) THEN
    CREATE POLICY "السماح للمستخدمين المسجلين بحذف صور المنتجات"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'product-images');
  END IF;
END $$;

-- إضافة إعدادات صور افتراضية في جدول app_settings إذا لم تكن موجودة
INSERT INTO public.app_settings (key, value)
VALUES (
  'image_settings', 
  '{"compression_quality": 80, "max_width": 1200, "cache_duration_seconds": 31536000}'
)
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value; 