import ProductGrid from '@/components/products/ProductGrid';

export default function ProductsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">جميع المنتجات</h1>
      <ProductGrid />
    </div>
  );
} 