'use client';

import productsData from './data/products.json';
import categoriesData from './data/categories.json';
import { Product } from '@/types';

// وظيفة مساعدة لتنسيق المنتجات وفقًا للواجهة الحالية
function formatProduct(product: any): any {
  // إذا كان المنتج يحتوي على images استخدمها، وإلا استخدم imageUrl
  const imageUrl = product.imageUrl || (product.images && product.images.length > 0 ? product.images[0] : '');
  
  return {
    ...product,
    imageUrl,
    // إذا كان هناك category كائن، قم بالاحتفاظ بمعرف الفئة في categoryId
    categoryId: product.categoryId || (product.category ? product.category.id : undefined)
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
}

export function getProducts({ categoryId, newOnly, limit }: { categoryId?: string; newOnly?: boolean; limit?: number }) {
  let products = productsData as any[];

  // تنسيق كل المنتجات حسب الواجهة الحالية
  products = products.map(formatProduct);

  if (categoryId) {
    products = products.filter((product) => 
      (product.category && product.category.id === categoryId) || 
      (product.categoryId && product.categoryId === categoryId)
    );
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
  const product = (productsData as any[]).find((product) => product.id === id);
  return product ? formatProduct(product) : undefined;
}

export function getRelatedProducts(categoryId: string, currentProductId: string, limit: number) {
  let products = (productsData as any[])
    .filter((product) => 
      ((product.category && product.category.id === categoryId) || 
       (product.categoryId && product.categoryId === categoryId)) && 
      product.id !== currentProductId
    );
  
  products = products.map(formatProduct);
  
  return products.slice(0, limit);
}

export function getFeaturedProducts(limit: number) {
  let products = (productsData as any[]).filter((product) => product.isNew);
  products = products.map(formatProduct);
  return products.slice(0, limit);
}

export function getNewProducts(limit?: number) {
  // تحقق من وجود بيانات في localStorage
  if (typeof window === 'undefined') {
    // في حالة الخادم، نعود بالبيانات الثابتة فقط
    let products = productsData as any[];
    products = products.filter((product) => product.isNew);
    products = products.map(formatProduct);
    
    if (limit && limit > 0) {
      products = products.slice(0, limit);
    }
    
    return products;
  }
  
  try {
    const savedProducts = localStorage.getItem('products');
    const savedSettings = localStorage.getItem('productSettings');
    
    if (savedProducts) {
      let products = JSON.parse(savedProducts);
      
      // تنسيق المنتجات من localStorage حسب الواجهة الحالية
      products = products.map(formatProduct);
      
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
  
  // في حالة عدم وجود بيانات في localStorage أو وجود خطأ
  let products = productsData as any[];
  products = products.filter((product) => product.isNew);
  
  // تنسيق المنتجات حسب الواجهة الحالية
  products = products.map(formatProduct);
  
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
  // تحقق أولاً مما إذا كنا في بيئة المتصفح أم الخادم
  if (typeof window === 'undefined') {
    // نحن في جانب الخادم، نعيد البيانات الثابتة فقط
    return categoriesData as Category[];
  }
  
  // نحن في جانب العميل، يمكننا استخدام localStorage
  try {
    const savedCategories = localStorage.getItem('categories');
    
    if (savedCategories) {
      const parsedCategories = JSON.parse(savedCategories);
      // تحويل هيكل البيانات من localStorage إلى الهيكل المتوقع في واجهة المستخدم
      return parsedCategories.map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        slug: createSlug(cat.name), // استخدام الوظيفة المحسنة لإنشاء slug
        image: cat.imageUrl || cat.image || '',
        description: cat.description || 'وصف القسم'
      }));
    }
  } catch (e) {
    console.error('Error parsing categories from localStorage:', e);
  }
  
  // إذا لم تكن هناك بيانات في localStorage أو حدث خطأ، استخدم البيانات الثابتة
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
  return (productsData as any[]).map((product) => product.id);
} 