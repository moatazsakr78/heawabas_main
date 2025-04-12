import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// الإعدادات الثابتة للمسؤول
const ADMIN_USERNAME = 'goodmorning';
const ADMIN_PASSWORD = 'shahenda';
const JWT_SECRET = 'hea_wa_bas_secret_key'; // استخدم متغير بيئة في الإنتاج

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // التحقق من بيانات الاعتماد
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'بيانات الاعتماد غير صالحة' },
        { status: 401 }
      );
    }

    // إنشاء توكن JWT
    const token = jwt.sign(
      { username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({ token, success: true });
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في عملية تسجيل الدخول' },
      { status: 500 }
    );
  }
} 