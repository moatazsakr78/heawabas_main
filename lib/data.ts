import productsData from './data/products.json';
import categoriesData from './data/categories.json';

export interface Product {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: { id: string; name: string; slug: string };
  images: string[];
  isNew: boolean;
  features: string[];
  specifications: Record<string, string>;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
}

export function getProducts({ categoryId, newOnly, limit }: { categoryId?: string; newOnly?: boolean; limit?: number }) {
  let products = productsData as Product[];

  if (categoryId) {
    products = products.filter((product) => product.category.id === categoryId);
  }

  if (newOnly) {
    products = products.filter((product) => product.isNew);
  }

  if (limit) {
    products = products.slice(0, limit);
  }

  return products;
}

export function getProductById(id: string) {
  return (productsData as Product[]).find((product) => product.id === id);
}

export function getRelatedProducts(categoryId: string, currentProductId: string, limit: number) {
  return (productsData as Product[])
    .filter((product) => product.category.id === categoryId && product.id !== currentProductId)
    .slice(0, limit);
}

export function getFeaturedProducts(limit: number) {
  return (productsData as Product[]).filter((product) => product.isNew).slice(0, limit);
}

export function getNewProducts(limit?: number) {
  // تحقق من وجود بيانات في localStorage
  if (typeof window !== 'undefined') {
    try {
      const savedProducts = localStorage.getItem('products');
      const savedSettings = localStorage.getItem('productSettings');
      
      if (savedProducts) {
        let products = JSON.parse(savedProducts);
        let newProductDays = 14; // القيمة الافتراضية: 14 يوم
        
        // استخدام إعدادات المنتجات الجديدة إذا كانت متوفرة
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.newProductDays) {
            newProductDays = settings.newProductDays;
          }
        }
        
        const currentDate = new Date();
        
        // تصفية المنتجات التي تم إنشاؤها خلال المدة المحددة
        products = products.filter((product: any) => {
          if (!product.createdAt || !product.isNew) return false;
          
          const createdDate = new Date(product.createdAt);
          const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // إرجاع المنتجات التي تم إنشاؤها خلال المدة المحددة فقط
          return diffDays <= newProductDays;
        });
        
        // تطبيق حد عدد المنتجات إذا كان موجودًا
        if (limit && limit > 0) {
          products = products.slice(0, limit);
        }
        
        return products;
      }
    } catch (e) {
      console.error('Error loading new products:', e);
    }
  }
  
  // في حالة عدم وجود بيانات في localStorage أو وجود خطأ
  let products = productsData as Product[];
  products = products.filter((product) => product.isNew);
  
  if (limit && limit > 0) {
    products = products.slice(0, limit);
  }
  
  return products;
}

// إضافة وظيفة مساعدة لتحويل النص العربي إلى slug صالح للاستخدام في العناوين
export function createSlug(text: string): string {
  // نحتفظ بالنص العربي كما هو، ولكن نستبدل المسافات بشرطات ونزيل أي أحرف خاصة
  return text
    .trim()
    .replace(/\s+/g, '-')        // استبدال المسافات بشرطات
    .replace(/[^\p{L}\p{N}\-]/gu, '') // إزالة الأحرف غير الحرفية أو الرقمية باستثناء الشرطة
    .toLowerCase();             // تحويل إلى أحرف صغيرة (للأحرف اللاتينية)
}

export function getCategories() {
  if (typeof window !== 'undefined') {
    // نحن في جانب العميل، يمكننا استخدام localStorage
    const savedCategories = localStorage.getItem('categories');
    
    if (savedCategories) {
      try {
        const parsedCategories = JSON.parse(savedCategories);
        // تحويل هيكل البيانات من localStorage إلى الهيكل المتوقع في واجهة المستخدم
        return parsedCategories.map((cat: any) => ({
          id: String(cat.id),
          name: cat.name,
          slug: createSlug(cat.name), // استخدام الوظيفة المحسنة لإنشاء slug
          image: cat.imageUrl || cat.image || '',
          description: cat.description || 'وصف القسم'
        }));
      } catch (e) {
        console.error('Error parsing categories from localStorage:', e);
      }
    }
  }
  
  // إذا كنا في جانب الخادم أو لم تكن هناك بيانات في localStorage، استخدم البيانات الثابتة
  return categoriesData as Category[];
}

export function getCategoryBySlug(slug: string) {
  // استخدام دالة getCategories التي تم تعديلها للحصول على قائمة الفئات المحدثة
  const categories = getCategories();
  return categories.find((category) => category.slug === slug);
}

export function getAllCategoryIds() {
  // استخدام دالة getCategories التي تم تعديلها للحصول على قائمة الفئات المحدثة
  const categories = getCategories();
  return categories.map((category) => category.slug);
}

export function getAllProductIds() {
  return (productsData as Product[]).map((product) => product.id);
} 