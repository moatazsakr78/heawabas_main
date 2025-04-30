import { useState, useEffect } from 'react';
import Image from 'next/image';
import { twMerge } from 'tailwind-merge';

type OptimizedImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  fill?: boolean;
  sizes?: string;
  onError?: () => void;
};

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 80,
  fill = false,
  sizes,
  onError,
  ...props
}: OptimizedImageProps & Omit<React.ComponentProps<typeof Image>, 'src' | 'alt' | 'width' | 'height' | 'className' | 'priority' | 'quality' | 'fill' | 'sizes'>) {
  // معالجة الـ src للتأكد من إضافة معلمة الإصدار
  const [optimizedSrc, setOptimizedSrc] = useState(src);

  useEffect(() => {
    // تطبيق معلمة الإصدار فقط إذا كان المصدر من Supabase
    if (src && typeof src === 'string') {
      if (src.includes('supabase.co/storage')) {
        // استخدام الطابع الزمني الحالي لمعلمة الإصدار
        const timestamp = Date.now();
        const separator = src.includes('?') ? '&' : '?';
        setOptimizedSrc(`${src}${separator}v=${timestamp}`);
      } else {
        setOptimizedSrc(src);
      }
    }
  }, [src]);

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      className={twMerge('object-cover', className)}
      priority={priority}
      quality={quality}
      fill={fill}
      sizes={sizes}
      onError={onError}
      {...props}
    />
  );
}

// إصدار بسيط يستخدم علامة img العادية
export function OptimizedImg({
  src,
  alt,
  className,
  width,
  height,
  onError,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { 
  onError?: React.ReactEventHandler<HTMLImageElement>
}) {
  // معالجة الـ src للتأكد من إضافة معلمة الإصدار
  const [optimizedSrc, setOptimizedSrc] = useState(src);

  useEffect(() => {
    // تطبيق معلمة الإصدار فقط إذا كان المصدر من Supabase
    if (src && typeof src === 'string') {
      if (src.includes('supabase.co/storage')) {
        // استخدام الطابع الزمني الحالي لمعلمة الإصدار
        const timestamp = Date.now();
        const separator = src.includes('?') ? '&' : '?';
        setOptimizedSrc(`${src}${separator}v=${timestamp}`);
      } else {
        setOptimizedSrc(src);
      }
    }
  }, [src]);

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={onError}
      {...props}
    />
  );
} 