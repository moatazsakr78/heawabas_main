// استدعاء Supabase Edge Function لمعالجة وتحسين الصور
// تعمل هذه الدالة عند تحميل صورة جديدة إلى bucket الصور

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

    console.log('Received storage event:', { bucketId, objectName, eventType });

    // التحقق من أنه حدث تحميل في bucket صور المنتجات أو طلب مباشر لتحديث الصلاحيات
    if ((eventType !== 'INSERT' && eventType !== 'UPDATE' && eventType !== 'DIRECT_UPDATE') || 
       (bucketId !== 'product-images' && eventType !== 'DIRECT_UPDATE')) {
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
      // استخدام القيم الافتراضية
      const settings = {
        compression_quality: 80,
        max_width: 1200,
        cache_duration_seconds: 31536000 // سنة كاملة
      };
    }

    const settings = settingsData?.value || {
      compression_quality: 80,
      max_width: 1200,
      cache_duration_seconds: 31536000
    };
    
    // تطبيق الحد الأقصى للجودة (80%)
    const compressionQuality = Math.min(settings.compression_quality || 80, 80);
    const cacheDuration = settings.cache_duration_seconds || 31536000;
    const maxWidth = Math.min(settings.max_width || 1200, 1200);

    console.log('Updating bucket configuration and permissions...');

    // التحقق من وجود bucket "product-images"
    let { data: buckets, error: listBucketsError } = await supabaseAdmin.storage
      .listBuckets();
      
    if (listBucketsError) {
      console.error('Error listing buckets:', listBucketsError);
      throw listBucketsError;
    }
    
    // إنشاء bucket إذا لم يكن موجودًا
    const bucketExists = buckets.some((bucket: any) => bucket.name === 'product-images');
    if (!bucketExists) {
      console.log('Creating "product-images" bucket...');
      const { error: createBucketError } = await supabaseAdmin.storage
        .createBucket('product-images', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });
        
      if (createBucketError) {
        console.error('Error creating bucket:', createBucketError);
        throw createBucketError;
      }
    }

    // تحديث الـ metadata للملف لتعيين cache-control header
    const { error: updateError } = await supabaseAdmin
      .storage
      .from('product-images')
      .updateBucket({
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        corsConfigurations: [
          {
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedOrigins: ['*'],
            maxAgeSeconds: cacheDuration
          }
        ]
      });

    if (updateError) {
      console.error('Error updating bucket settings:', updateError);
      throw updateError;
    }

    // تحديث صلاحيات الوصول للـ bucket لضمان أن المستخدمين المصادق عليهم يمكنهم الرفع
    try {
      console.log('Updating bucket policies...');
      
      const { error: policiesError } = await supabaseAdmin
        .storage
        .from('product-images')
        .updateBucketPolicy({
          name: 'allow-public-read-authenticated-write',
          definition: {
            statements: [
              {
                effect: 'allow',
                principal: { id: '*' },
                actions: ['select'],
                resources: [`product-images/*`]
              },
              {
                effect: 'allow',
                principal: { type: 'authenticated' },
                actions: ['select', 'insert', 'update', 'delete'],
                resources: [`product-images/*`]
              }
            ]
          }
        });
  
      if (policiesError) {
        console.error('Error updating bucket policies:', policiesError);
        throw policiesError;
      }
      
      console.log('Bucket policies updated successfully');
    } catch (policyError) {
      console.error('Failed to update policies, trying alternative approach:', policyError);
      
      // محاولة تعيين الصلاحيات باستخدام الأسلوب البديل
      try {
        const { error: publicityError } = await supabaseAdmin.storage
          .from('product-images')
          .setPublic(true);
        
        if (publicityError) {
          console.error('Error setting bucket publicity:', publicityError);
        } else {
          console.log('Successfully made bucket public using alternative method');
        }
      } catch (err) {
        console.error('Alternative policy update approach also failed:', err);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Image bucket and settings configured successfully',
        objectName,
        cacheControl: `public, max-age=${cacheDuration}`,
        settings: {
          compressionQuality,
          maxWidth,
          cacheDuration
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error processing image bucket configuration:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}); 