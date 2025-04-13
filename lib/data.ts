'use client';

import productsData from './data/products.json';
import categoriesData from './data/categories.json';
import { Product, Category } from '@/types';

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

export function getProducts({ categoryId = '', newOnly = false, limit = 0 }: { categoryId?: string, newOnly?: boolean, limit?: number } = {}) {
  try {
    // محاولة تحميل البيانات من localStorage إذا كنا في المتصفح
    if (typeof window !== 'undefined') {
      const productsData = localStorage.getItem('products');
      if (productsData) {
        try {
          let products: Product[] = JSON.parse(productsData);
          
          // تطبيق فلاتر التصنيف والمنتجات الجديدة إذا تم تحديدها
          if (categoryId) {
            products = products.filter(product => product.categoryId === categoryId);
          }
          
          if (newOnly) {
            products = products.filter(product => product.isNew);
          }
          
          // تطبيق الحد إذا تم تحديده وكان أكبر من 0
          if (limit > 0 && products.length > limit) {
            products = products.slice(0, limit);
          }
          
          return products;
        } catch (error) {
          console.error('خطأ في تحليل بيانات المنتجات:', error);
        }
      }
    }
    
    // في حالة عدم وجود بيانات في localStorage أو خطأ، نستخدم المنتجات الافتراضية
    const defaultProducts: Product[] = [
      {
        id: '1',
        name: 'لابتوب Asus',
        productCode: 'LP001',
        boxQuantity: 5,
        piecePrice: 1200,
        packPrice: 5500,
        boxPrice: 27000,
        imageUrl: 'https://via.placeholder.com/300',
        isNew: true,
        createdAt: new Date().toISOString(),
        categoryId: '1',
      },
      {
        id: '2',
        name: 'غسالة LG',
        productCode: 'WM002',
        boxQuantity: 2,
        piecePrice: 500,
        packPrice: 950,
        boxPrice: 1800,
        imageUrl: 'https://via.placeholder.com/300',
        isNew: true,
        createdAt: new Date().toISOString(),
        categoryId: '2',
      },
      // يمكن إضافة المزيد من المنتجات هنا...
    ];
    
    // تطبيق نفس الفلاتر على المنتجات الافتراضية
    let filteredProducts = [...defaultProducts];
    
    if (categoryId) {
      filteredProducts = filteredProducts.filter(product => product.categoryId === categoryId);
    }
    
    if (newOnly) {
      filteredProducts = filteredProducts.filter(product => product.isNew);
    }
    
    // تطبيق الحد إذا تم تحديده وكان أكبر من 0
    if (limit > 0 && filteredProducts.length > limit) {
      filteredProducts = filteredProducts.slice(0, limit);
    }
    
    return filteredProducts;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات:', error);
    return [];
  }
}

export function getProductById(id: string) {
  try {
    if (typeof window !== 'undefined') {
      const productsData = localStorage.getItem('products');
      if (productsData) {
        try {
          const products: Product[] = JSON.parse(productsData);
          return products.find(product => product.id === id) || null;
        } catch (error) {
          console.error('خطأ في تحليل بيانات المنتجات:', error);
        }
      }
    }
    
    // بيانات افتراضية إذا لم يتم العثور على المنتج
    const defaultProducts = getProducts();
    return defaultProducts.find(product => product.id === id) || null;
  } catch (error) {
    console.error('خطأ في الحصول على المنتج:', error);
    return null;
  }
}

export function getRelatedProducts(categoryId: string, currentProductId: string, limit = 3) {
  try {
    const products = getProducts({ categoryId });
    const relatedProducts = products.filter(product => product.id !== currentProductId);
    
    // تطبيق الحد إذا تم تحديده وكان أكبر من 0
    if (limit > 0 && relatedProducts.length > limit) {
      return relatedProducts.slice(0, limit);
    }
    
    return relatedProducts;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات ذات الصلة:', error);
    return [];
  }
}

export function getFeaturedProducts(limit = 0) {
  try {
    // يمكن تنفيذ منطق مخصص هنا لتحديد المنتجات المميزة
    // هنا نستخدم المنتجات الافتراضية كمثال
    const products = getProducts();
    
    // تطبيق الحد إذا تم تحديده وكان أكبر من 0
    if (limit > 0 && products.length > limit) {
      return products.slice(0, limit);
    }
    
    return products;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات المميزة:', error);
    return [];
  }
}

export function getNewProducts(limit = 0) {
  try {
    let newProducts: Product[] = [];
    
    // محاولة تحميل المنتجات من localStorage
    if (typeof window !== 'undefined') {
      try {
        // تحميل إعدادات المنتجات لمعرفة كم يوم يعتبر المنتج جديداً
        const settingsData = localStorage.getItem('productSettings');
        let newProductsDays = 14; // القيمة الافتراضية هي 14 يوم
        
        if (settingsData) {
          const settings = JSON.parse(settingsData);
          newProductsDays = settings.newProductsDays || 14;
        }
        
        const productsData = localStorage.getItem('products');
        if (productsData) {
          const products = JSON.parse(productsData) as Product[];
          const now = new Date();
          
          newProducts = products.filter(product => {
            // إذا كان المنتج موسوم كجديد، قم بإضافته
            if (product.isNew === true) {
              return true;
            }
            
            // التحقق من تاريخ الإنشاء إذا كان موجوداً
            if (product.createdAt) {
              const creationDate = new Date(product.createdAt);
              const timeDiff = now.getTime() - creationDate.getTime();
              const daysSinceCreation = Math.floor(timeDiff / (1000 * 3600 * 24));
              
              return daysSinceCreation <= newProductsDays;
            }
            
            return false;
          });
        }
      } catch (error) {
        console.error('خطأ في تحميل بيانات المنتجات الجديدة:', error);
      }
    }
    
    // إذا لم يتم العثور على منتجات جديدة، استخدم الطريقة الأصلية
    if (newProducts.length === 0) {
      newProducts = getProducts({ newOnly: true });
    }
    
    // تطبيق الحد إذا تم تحديده
    if (limit > 0 && newProducts.length > limit) {
      return newProducts.slice(0, limit);
    }
    
    return newProducts;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات الجديدة:', error);
    return [];
  }
}

// إضافة وظيفة مساعدة لتحويل النص العربي إلى slug صالح للاستخدام في العناوين
export function createSlug(text: string): string {
  // نحتفظ بالنص العربي كما هو، ولكن نستبدل المسافات بشرطات ونزيل أي أحرف خاصة
  return text
    .trim()
    .replace(/\s+/g, '-')        // استبدال المسافات بشرطات
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\-]/g, '') // إزالة الأحرف غير العربية أو الإنجليزية أو الرقمية باستثناء الشرطة
    .toLowerCase();             // تحويل إلى أحرف صغيرة (للأحرف اللاتينية)
}

export function getCategories() {
  try {
    // محاولة تحميل البيانات من localStorage إذا كنا في المتصفح
    if (typeof window !== 'undefined') {
      const categoriesData = localStorage.getItem('categories');
      if (categoriesData) {
        try {
          return JSON.parse(categoriesData) as Category[];
        } catch (error) {
          console.error('خطأ في تحليل بيانات الفئات:', error);
        }
      }
    }
    
    // بيانات افتراضية في حالة عدم وجود بيانات في localStorage
    return [
      {
        id: '1',
        name: 'إلكترونيات',
        slug: 'electronics',
        image: 'https://via.placeholder.com/300',
        description: 'أجهزة إلكترونية متنوعة',
      },
      {
        id: '2',
        name: 'أجهزة منزلية',
        slug: 'appliances',
        image: 'https://via.placeholder.com/300',
        description: 'أجهزة المنزل الأساسية',
      },
      // يمكن إضافة المزيد من الفئات هنا...
    ] as Category[];
  } catch (error) {
    console.error('خطأ في الحصول على الفئات:', error);
    return [];
  }
}

export function getCategoryBySlug(slug: string) {
  try {
    const categories = getCategories();
    return categories.find(category => category.slug === slug) || null;
  } catch (error) {
    console.error('خطأ في الحصول على الفئة بالاسم المستعار:', error);
    return null;
  }
}

export function getAllCategoryIds() {
  try {
    const categories = getCategories();
    return categories.map(category => ({
      params: {
        slug: category.slug,
      },
    }));
  } catch (error) {
    console.error('خطأ في الحصول على معرفات الفئات:', error);
    return [];
  }
}

export function getAllProductIds() {
  try {
    const products = getProducts();
    return products.map(product => ({
      params: {
        id: product.id,
      },
    }));
  } catch (error) {
    console.error('خطأ في الحصول على معرفات المنتجات:', error);
    return [];
  }
} 