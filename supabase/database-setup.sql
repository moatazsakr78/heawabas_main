-- إنشاء جدول الفئات
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  createdAt TEXT,
  category_id UUID REFERENCES categories(id),
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

-- إضافة مؤشرات للبحث السريع
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- وظيفة لتحديث الطابع الزمني عند التحديث
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء المحفزات لتحديث الطابع الزمني
CREATE TRIGGER update_products_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_categories_timestamp
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_app_settings_timestamp
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- إنشاء إجراء مخزن لتحويل الصور قبل تخزينها
CREATE OR REPLACE FUNCTION optimize_image_on_upload()
RETURNS TRIGGER AS $$
DECLARE
  settings jsonb;
BEGIN
  -- استرجاع إعدادات الصور من جدول الإعدادات
  SELECT value INTO settings FROM app_settings WHERE key = 'image_settings';
  
  -- يُستخدم في البيئة الحقيقية لمعالجة الصور
  -- هنا فقط نحدّد الـ cache-control header للصور المخزنة
  PERFORM set_bucket_object_cache_control(
    'product-images',  -- اسم الـ bucket
    NEW.name,          -- اسم الملف
    'public, max-age=' || (settings->>'cache_duration_seconds')::text  -- cache control header
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء الدالة المساعدة لتعيين cache-control header
CREATE OR REPLACE FUNCTION set_bucket_object_cache_control(bucket_name text, object_name text, cache_control text)
RETURNS void AS $$
BEGIN
  -- هذه وظيفة تطبق عن طريق دالة خارجية في الإعداد الحقيقي لـ Supabase
  -- في النموذج الحالي هي فقط placeholder
  RAISE NOTICE 'Setting cache-control to % for object % in bucket %', cache_control, object_name, bucket_name;
END;
$$ LANGUAGE plpgsql;
