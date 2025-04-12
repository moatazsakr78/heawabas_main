import CategoryList from '@/components/categories/CategoryList';

export const metadata = {
  title: 'Categories | Product Catalog',
  description: 'Browse all product categories in our catalog',
};

export default function CategoriesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">الأقسام</h1>
      <p className="text-lg text-gray-600 mb-8">
        تصفح منتجاتنا حسب الأقسام. اختر القسم الذي يناسب احتياجاتك.
      </p>
      <CategoryList showAll={true} />
    </div>
  );
} 