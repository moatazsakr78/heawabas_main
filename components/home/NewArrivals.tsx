import ProductGrid from '../products/ProductGrid';

export default function NewArrivals() {
  return (
    <ProductGrid 
      title="وصل حديثًا" 
      showViewAll={true} 
      viewAllLink="/products/new"
      limit={4}
    />
  );
} 