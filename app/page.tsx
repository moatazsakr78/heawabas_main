import Link from 'next/link';
import Image from 'next/image';
import FeaturedProducts from '@/components/home/FeaturedProducts';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Featured Products */}
      <section className="mb-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">المنتجات</h2>
        </div>
        <FeaturedProducts />
      </section>
    </div>
  );
} 