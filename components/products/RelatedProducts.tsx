import ProductCard from './ProductCard';
import { getRelatedProducts } from '@/lib/data';

interface RelatedProductsProps {
  categoryId: string;
  currentProductId: string;
  limit?: number;
}

export default function RelatedProducts({ 
  categoryId, 
  currentProductId, 
  limit = 4 
}: RelatedProductsProps) {
  const products = getRelatedProducts(categoryId, currentProductId, limit);

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
} 