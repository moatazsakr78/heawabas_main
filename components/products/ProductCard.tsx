import Image from 'next/image';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-64 md:h-72">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-2"
            priority
            quality={90}
          />
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