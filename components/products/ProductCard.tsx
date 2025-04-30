import Image from 'next/image';
import { Product } from '@/types';
import { useState, useEffect } from 'react';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  
  // استخدام useEffect لتحقق من وجود الصورة في cache المتصفح
  useEffect(() => {
    if (!product.imageUrl) return;
    
    // محاولة استرجاع الصورة من cache المتصفح
    const checkImageCache = async () => {
      try {
        // فحص ما إذا كانت الصورة مخزنة في cache
        const cache = await caches.open('product-images-cache');
        const cachedResponse = await cache.match(product.imageUrl);
        
        if (cachedResponse) {
          console.log('Image found in cache:', product.imageUrl);
        } else {
          // إذا لم تكن الصورة في cache، قم بتخزينها
          await cache.add(product.imageUrl);
          console.log('Image added to cache:', product.imageUrl);
        }
        
        // تعيين مصدر الصورة بعد التحقق من cache
        setImageSrc(product.imageUrl);
      } catch (error) {
        console.error('Error with cache:', error);
        // في حالة الخطأ، استخدم الرابط المباشر
        setImageSrc(product.imageUrl);
      }
    };
    
    checkImageCache();
  }, [product.imageUrl]);

  return (
    <div className="bg-[#D7D7D7] rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-64 md:h-72">
        {imageSrc ? (
          <>
            {/* استخدام صورة مؤقتة للتحميل (placeholder) */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-contain p-2 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              priority={priority}
              quality={85}
              loading={priority ? 'eager' : 'lazy'}
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="h-full w-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">لا توجد صورة</span>
          </div>
        )}
        {product.isNew && (
          <span className="absolute top-2 right-2 bg-secondary text-white text-xs px-2 py-1 rounded-full">
            جديد
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{product.name}</h3>
        
        <div className="bg-gray-100 p-3 rounded-md mb-3 text-center">
          <p className="font-bold text-gray-700 mb-1">كود المنتج</p>
          <p className="text-xl md:text-2xl font-bold text-primary">{product.productCode}</p>
        </div>
        
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="bg-gray-50 p-2 rounded text-center">
              <p className="font-bold text-primary">سعر القطعة</p>
              <p className="text-lg">{product.piecePrice} جنيه</p>
            </div>
            <div className="bg-gray-50 p-2 rounded text-center">
              <p className="font-semibold">الكمية في الكرتونة</p>
              <p className="text-lg">{product.boxQuantity} قطعة</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 