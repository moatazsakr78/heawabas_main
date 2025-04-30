import { NextRequest, NextResponse } from 'next/server';
import { getImageCacheHeaders } from '@/lib/image-utils';

export const runtime = 'edge'; // تشغيل على Edge Runtime للأداء الأفضل

export async function GET(request: NextRequest) {
  try {
    // الحصول على رابط الصورة من معلمات الاستعلام
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image URL provided' },
        { status: 400 }
      );
    }
    
    // التحقق من أن عنوان URL للصورة صالح (لأسباب أمنية)
    if (!imageUrl.startsWith('https://') || !imageUrl.includes('supabase.co/storage')) {
      return NextResponse.json(
        { error: 'Invalid image URL. Only Supabase storage URLs are allowed.' },
        { status: 400 }
      );
    }
    
    // جلب الصورة
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Accept': 'image/*',
      },
    });
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponse.statusText}` },
        { status: imageResponse.status }
      );
    }
    
    // الحصول على بيانات الصورة وtype
    const imageData = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    
    // إنشاء استجابة مع هيدرز التخزين المؤقت المناسبة
    const response = new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...getImageCacheHeaders(),
      },
    });
    
    return response;
  } catch (error: any) {
    console.error('Error in optimized-image route:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error.message}` },
      { status: 500 }
    );
  }
} 