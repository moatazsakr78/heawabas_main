import { supabase } from './supabase';
import { addVersionToImageUrl, getImageCacheHeaders } from './image-utils';

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
        compression_quality: 80, // قيمة ثابتة لا تتجاوز 80%
        max_width: 1200,
        cache_duration_seconds: 31536000 // سنة كاملة
      };
    }

    // ضمان أن جودة الضغط لا تتجاوز 80%
    const settings = data.value;
    settings.compression_quality = Math.min(settings.compression_quality, 80);
    
    return settings;
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
    // تحويل النسبة المئوية إلى قيمة بين 0 و 1، وضمان أنها لا تتجاوز 80%
    const quality = Math.min(settings.compression_quality, 80) / 100;
    // ضمان أن العرض الأقصى هو 1200px
    const maxWidth = Math.min(settings.max_width, 1200);

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
          
          // تحقق إذا كانت الصورة أعرض من الحد الأقصى
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
              
              console.log(`Original size: ${file.size}, Compressed size: ${compressedFile.size}, Reduction: ${(1 - compressedFile.size / file.size) * 100}%, Quality: ${quality*100}%, Max Width: ${maxWidth}px`);
              
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
export async function uploadProductImage(fileOrBase64: File | string | null, productId: string): Promise<string> {
  try {
    // إذا لم يتم توفير ملف أو بيانات الصورة، إرجاع سلسلة فارغة
    if (!fileOrBase64) {
      console.log('No image file or data provided');
      return '';
    }
    
    let compressedFile: File;
    
    // التعامل مع ملف الصورة أو بيانات base64
    if (typeof fileOrBase64 === 'string') {
      // التحقق مما إذا كانت الصورة بالفعل URL لصورة موجودة في Supabase
      if (fileOrBase64.includes('supabase.co/storage')) {
        console.log('Image is already in Supabase:', fileOrBase64);
        // إضافة معلمة الإصدار للتأكد من تحديث الكاش
        return addVersionToImageUrl(fileOrBase64);
      }
      
      // التحقق مما إذا كانت القيمة هي "لا توجد صورة"
      if (fileOrBase64 === 'لا توجد صورة') {
        console.log('No image indicator provided');
        return '';
      }
      
      // تحويل بيانات base64 إلى ملف
      if (fileOrBase64.startsWith('data:image')) {
        // استخراج نوع الصورة وبياناتها
        const matches = fileOrBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 image format');
        }
        
        const type = matches[1];
        const data = atob(matches[2]);
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          buffer[i] = data.charCodeAt(i);
        }
        
        // إنشاء Blob من البيانات
        const blob = new Blob([buffer], { type });
        compressedFile = new File([blob], `${productId}_image.${type.split('/')[1]}`, { type });
        
        // ضغط الصورة بعد تحويلها
        compressedFile = await compressImage(compressedFile);
      } else {
        console.log('Not a valid base64 or Supabase URL:', fileOrBase64.substring(0, 30) + '...');
        return '';
      }
    } else {
      // ضغط ملف الصورة المرفق
      compressedFile = await compressImage(fileOrBase64);
    }
    
    // إنشاء اسم فريد للملف باستخدام معرف المنتج وطابع الوقت
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${productId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    
    // الحصول على مدة الـ cache من الإعدادات
    const settings = await getImageSettings();
    
    // الحصول على هيدرز التخزين المؤقت المحسنة
    const cacheControlHeaders = getImageCacheHeaders();
    
    try {
      // التحقق من وجود الـ bucket قبل الرفع
      const { data: buckets, error: listBucketsError } = await supabase.storage
        .listBuckets();
        
      if (listBucketsError) {
        console.error('Error listing buckets:', listBucketsError);
        throw new Error(`تعذر الوصول إلى Storage: ${listBucketsError.message}`);
      }
      
      // التحقق إذا كان bucket "product-images" موجود
      const bucketExists = buckets.some(bucket => bucket.name === 'product-images');
      
      // إنشاء bucket إذا لم يكن موجودًا
      if (!bucketExists) {
        console.warn('"product-images" bucket does not exist, attempting to create it');
        const { error: createBucketError } = await supabase.storage
          .createBucket('product-images', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          });
          
        if (createBucketError) {
          console.error('Error creating bucket:', createBucketError);
          throw new Error(`تعذر إنشاء bucket: ${createBucketError.message}`);
        }
      }
      
      // رفع الملف إلى Supabase Storage مع هيدرز كاش محسنة
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          cacheControl: cacheControlHeaders['Cache-Control'],
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true
        });
      
      if (error) {
        console.error('Error uploading image:', error);
        throw new Error(`فشل رفع الصورة: ${error.message}`);
      }
      
      // إنشاء رابط عام للصورة
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      
      // إضافة معلمة الإصدار للرابط
      const versionedUrl = addVersionToImageUrl(publicUrl.publicUrl);
      
      console.log('Image uploaded successfully, public URL:', versionedUrl);
      return versionedUrl;
    } catch (uploadError) {
      console.error('Storage operation failed:', uploadError);
      
      // محاولة استخدام service role إذا كان الخطأ متعلقاً بالصلاحيات
      const error = uploadError as Error;
      if (error.message && (
          error.message.includes('permission') || 
          error.message.includes('access') || 
          error.message.includes('not authorized')
        )) {
        console.log('Attempting to use service role for upload');
        
        // هنا يمكن تنفيذ منطق للرفع باستخدام service role، مثل استدعاء Edge Function
        throw new Error('تعذر الوصول إلى التخزين: قد تحتاج إلى تكوين صلاحيات إضافية');
      } else {
        // إعادة رفع الخطأ للتعامل معه في واجهة المستخدم
        throw uploadError;
      }
    }
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

// رفع صورة المنتج باستخدام API الخادم (أكثر أمانًا)
export async function uploadProductImageViaAPI(fileOrBase64: File | string | null, productId: string): Promise<string> {
  try {
    // إذا لم يتم توفير ملف أو بيانات الصورة، إرجاع سلسلة فارغة
    if (!fileOrBase64) {
      console.log('No image file or data provided');
      return '';
    }

    // تجهيز FormData لإرسال الملف
    const formData = new FormData();
    let file: File;

    // التعامل مع ملف الصورة أو بيانات base64
    if (typeof fileOrBase64 === 'string') {
      // التحقق مما إذا كانت الصورة بالفعل URL لصورة موجودة في Supabase
      if (fileOrBase64.includes('supabase.co/storage')) {
        console.log('Image is already in Supabase:', fileOrBase64);
        // إضافة معلمة الإصدار للتأكد من تحديث الكاش
        return addVersionToImageUrl(fileOrBase64);
      }

      // التحقق مما إذا كانت القيمة هي "لا توجد صورة"
      if (fileOrBase64 === 'لا توجد صورة') {
        console.log('No image indicator provided');
        return '';
      }

      // تحويل بيانات base64 إلى ملف
      if (fileOrBase64.startsWith('data:image')) {
        // استخراج نوع الصورة وبياناتها
        const matches = fileOrBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 image format');
        }

        const type = matches[1];
        const base64Data = matches[2];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type });
        file = new File([blob], `${productId}_image.${type.split('/')[1]}`, { type });
      } else {
        console.log('Not a valid base64 or Supabase URL');
        return '';
      }
    } else {
      // استخدام ملف الصورة المرفق مباشرة
      file = fileOrBase64;
    }

    // إضافة الملف إلى FormData
    formData.append('file', file);
    
    // إضافة مسار داخل البكت (باستخدام معرف المنتج)
    const fileExt = file.name.split('.').pop();
    const path = `${productId}_${Date.now()}.${fileExt}`;
    formData.append('path', path);

    console.log('Uploading image via API...');
    
    // إرسال الطلب إلى API الخادم
    const response = await fetch('/api/upload-product-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload image');
    }

    const result = await response.json();
    
    // إضافة معلمة الإصدار للرابط
    const versionedUrl = addVersionToImageUrl(result.url);
    console.log('Image uploaded successfully via API:', versionedUrl);
    
    return versionedUrl;
  } catch (error) {
    console.error('Error in uploadProductImageViaAPI:', error);
    throw error;
  }
} 