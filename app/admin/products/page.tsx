'use client';

import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX, FiImage, FiRefreshCw } from 'react-icons/fi';
import { saveData, loadData, hasData } from '@/lib/localStorage';
import { getCategories } from '@/lib/data';
import { Category } from '@/lib/data';
import { saveProductsToSupabase, loadProductsFromSupabase, syncProductsFromSupabase, isOnline } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  productCode: string;
  boxQuantity: number;
  piecePrice: number;
  packPrice: number;
  boxPrice: number;
  imageUrl: string;
  isNew: boolean;
  createdAt: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    productCode: '',
    boxQuantity: '',
    piecePrice: '',
    packPrice: '',
    boxPrice: '',
    imageUrl: '',
    isNew: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadProductsData();
    loadCategoriesData();
    
    // إضافة مستمع للاتصال بالإنترنت
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // دالة للتعامل مع تغييرات الاتصال بالإنترنت
  const handleOnlineStatusChange = () => {
    if (isOnline()) {
      console.log('Connection restored. Reloading admin data...');
      // محاولة مزامنة البيانات عند عودة الاتصال
      loadProductsData();
    } else {
      console.log('Connection lost. Using local data only.');
      setNotification({
        message: 'تم فقد الاتصال بالإنترنت. سيتم حفظ التغييرات محلياً فقط.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // تحميل بيانات الفئات
  const loadCategoriesData = async () => {
    try {
      // محاولة استرجاع الفئات من التخزين الدائم
      const savedCategories = await loadData('categories');
      
      if (savedCategories && Array.isArray(savedCategories)) {
        // تنسيق البيانات
        const formattedCategories = savedCategories.map((cat: any) => ({
          id: String(cat.id),
          name: cat.name,
          slug: cat.slug || '',
          image: cat.imageUrl || cat.image || '',
          description: cat.description || 'وصف القسم'
        }));
        setCategories(formattedCategories);
      } else {
        // استخدام دالة getCategories كبديل
        setCategories(getCategories());
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // استخدام دالة getCategories كبديل
      setCategories(getCategories());
    }
  };

  // تحميل بيانات المنتجات بطريقة تضمن الثبات
  const loadProductsData = async () => {
    try {
      setIsLoading(true);
      
      // محاولة تحميل المنتجات من Supabase أولاً إذا كان متصلاً بالإنترنت
      if (isOnline()) {
        try {
          console.log('Loading products from server...');
          const onlineProducts = await loadProductsFromSupabase();
          if (onlineProducts && onlineProducts.length > 0) {
            console.log('Successfully loaded products from server:', onlineProducts.length);
            setProducts(onlineProducts);
            // تحديث التخزين المحلي
            saveData('products', onlineProducts);
            localStorage.setItem('products', JSON.stringify(onlineProducts));
            setIsLoading(false);
            
            setNotification({
              message: 'تم تحميل البيانات من السيرفر بنجاح',
              type: 'success'
            });
            setTimeout(() => setNotification(null), 3000);
            
            return;
          } else {
            console.log('No products found on server, checking local data');
          }
        } catch (error) {
          console.error('Error loading products from Supabase:', error);
          // استمر في استخدام التخزين المحلي
        }
      } else {
        console.log('Device is offline. Using local data only.');
      }
      
      // محاولة استرجاع البيانات باستخدام وظيفة التخزين المحلي الدائم
      const savedProducts = await loadData('products');
      
      if (savedProducts && Array.isArray(savedProducts)) {
        console.log('Using data from persistent storage:', savedProducts.length);
        setProducts(savedProducts);
        
        // إظهار رسالة توضح أن البيانات من التخزين المحلي
        if (isOnline()) {
          setNotification({
            message: 'لم يتم العثور على بيانات في السيرفر. سيتم استخدام البيانات المحلية.',
            type: 'error'
          });
          setTimeout(() => setNotification(null), 3000);
        }
      } else {
        // التحقق من وجود البيانات في localStorage التقليدي
        const localStorageProducts = localStorage.getItem('products');
        if (localStorageProducts) {
          console.log('Using data from localStorage');
          const parsedProducts = JSON.parse(localStorageProducts);
          // حفظ البيانات في التخزين الدائم للمرات القادمة
          saveData('products', parsedProducts);
          setProducts(parsedProducts);
          
          // إظهار رسالة إضافية
          if (isOnline()) {
            setNotification({
              message: 'لم يتم العثور على بيانات في السيرفر. سيتم استخدام البيانات المحلية.',
              type: 'error'
            });
            setTimeout(() => setNotification(null), 3000);
          }
        } else {
          // بيانات افتراضية إذا لم يتم العثور على أي بيانات
          console.log('Using default product data');
          const defaultProducts = [
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
            },
          ];
          // حفظ البيانات الافتراضية في نظام التخزين الدائم
          saveData('products', defaultProducts);
          setProducts(defaultProducts);
          
          // مزامنة البيانات الافتراضية مع السيرفر إذا كان متصلاً
          if (isOnline()) {
            try {
              await saveProductsToSupabase(defaultProducts);
              setNotification({
                message: 'تم تهيئة قاعدة البيانات بمنتجات افتراضية',
                type: 'success'
              });
              setTimeout(() => setNotification(null), 3000);
            } catch (error) {
              console.error('Error initializing Supabase with default products:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setNotification({
        message: 'حدث خطأ أثناء تحميل المنتجات',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // تعديل وظيفة حفظ المنتجات لاستخدام التخزين الدائم والمزامنة مع Supabase
  const saveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    setIsLoading(true);
    
    // حفظ البيانات في نظام التخزين الدائم
    saveData('products', newProducts);
    
    // أيضًا حفظ في localStorage التقليدي للتوافق مع بقية التطبيق
    localStorage.setItem('products', JSON.stringify(newProducts));
    
    // مزامنة مع Supabase إذا كان متصلاً بالإنترنت
    let syncSuccess = false;
    if (isOnline()) {
      try {
        console.log('Syncing products to server...');
        await saveProductsToSupabase(newProducts);
        syncSuccess = true;
        console.log('Successfully synced products to server');
      } catch (error) {
        console.error('Error saving to Supabase:', error);
        setNotification({
          message: 'تم حفظ البيانات محليًا فقط. فشلت المزامنة مع السيرفر.',
          type: 'error'
        });
        setTimeout(() => setNotification(null), 3000);
      }
    }
    
    // إرسال أحداث التخزين لإعلام بقية التطبيق بالتغييرات
    try {
      // تأكد من وجود window قبل استخدام dispatchEvent
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'products', timestamp: Date.now() }
        }));
      }
      
      setNotification({
        message: isOnline() && syncSuccess 
          ? 'تم حفظ التغييرات بنجاح! التغييرات ستظهر في جميع الأجهزة.' 
          : 'تم حفظ التغييرات محليًا فقط. ستتم المزامنة عند اتصالك بالإنترنت.',
        type: 'success'
      });
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error('Error dispatching storage event:', error);
      
      setNotification({
        message: 'حدثت مشكلة أثناء حفظ التغييرات',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = () => {
    setCurrentProduct(null);
    setFormData({
      name: '',
      productCode: '',
      boxQuantity: '',
      piecePrice: '',
      packPrice: '',
      boxPrice: '',
      imageUrl: '',
      isNew: false,
    });
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      productCode: product.productCode,
      boxQuantity: product.boxQuantity.toString(),
      piecePrice: product.piecePrice.toString(),
      packPrice: product.packPrice.toString(),
      boxPrice: product.boxPrice.toString(),
      imageUrl: product.imageUrl,
      isNew: product.isNew,
    });
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    // تأكد من وجود window قبل استخدام confirm
    if (typeof window !== 'undefined' && window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      const newProducts = products.filter((product) => product.id !== id);
      saveProducts(newProducts);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentProduct) {
      // تحديث منتج موجود
      const updatedProducts = products.map((prod) =>
        prod.id === currentProduct.id
          ? {
              ...prod,
              name: formData.name,
              productCode: formData.productCode,
              boxQuantity: parseInt(formData.boxQuantity),
              piecePrice: parseFloat(formData.piecePrice),
              packPrice: parseFloat(formData.packPrice),
              boxPrice: parseFloat(formData.boxPrice),
              imageUrl: formData.imageUrl,
              isNew: formData.isNew,
            }
          : prod
      );
      saveProducts(updatedProducts);
    } else {
      // إضافة منتج جديد
      const newProduct = {
        id: Date.now().toString(),
        name: formData.name,
        productCode: formData.productCode,
        boxQuantity: parseInt(formData.boxQuantity),
        piecePrice: parseFloat(formData.piecePrice),
        packPrice: parseFloat(formData.packPrice),
        boxPrice: parseFloat(formData.boxPrice),
        imageUrl: formData.imageUrl,
        isNew: formData.isNew,
        createdAt: new Date().toISOString(),
      };
      saveProducts([...products, newProduct]);
    }
    setIsModalOpen(false);
  };

  // نظام وهمي لرفع الصور - في مشروع حقيقي سيتم استخدام خدمة تخزين سحابي
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // تحويل الصورة إلى تنسيق base64 لتخزينها بشكل دائم
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData({ ...formData, imageUrl: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProduct = () => {
    setIsLoading(true);
    
    try {
      // الحفاظ على تاريخ الإنشاء الأصلي إذا كان موجودًا، وإلا تعيين تاريخ حالي
      const updatedProduct = {
        ...formData,
        id: currentProduct?.id || Date.now().toString(),
        createdAt: currentProduct?.createdAt || new Date().toISOString(),
        boxQuantity: parseInt(formData.boxQuantity.toString()) || 0,
        piecePrice: parseFloat(formData.piecePrice.toString()) || 0,
        packPrice: parseFloat(formData.packPrice.toString()) || 0,
        boxPrice: parseFloat(formData.boxPrice.toString()) || 0,
      };

      if (currentProduct) {
        // تحديث منتج موجود
        const updatedProducts = products.map((prod) =>
          prod.id === currentProduct.id
            ? updatedProduct
            : prod
        );
        saveProducts(updatedProducts);
      } else {
        // إضافة منتج جديد
        saveProducts([...products, updatedProduct]);
      }
      setIsModalOpen(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error updating product:', error);
      setNotification({
        message: 'حدثت مشكلة أثناء تحديث المنتج',
        type: 'error'
      });
      setIsLoading(false);
    }
  };

  // دالة لمزامنة البيانات مع السيرفر
  const handleSyncWithServer = async () => {
    if (!isOnline()) {
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. يرجى الاتصال أولاً.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    setIsSyncing(true);
    
    try {
      console.log('Starting sync with server...');
      
      // جلب البيانات من السيرفر
      const serverProducts = await loadProductsFromSupabase();
      
      if (serverProducts && serverProducts.length > 0) {
        console.log('Found data on server. Updating local data...');
        
        // تحديث واجهة المستخدم
        setProducts(serverProducts);
        // تحديث التخزين المحلي
        saveData('products', serverProducts);
        localStorage.setItem('products', JSON.stringify(serverProducts));
        
        setNotification({
          message: 'تمت المزامنة بنجاح مع السيرفر!',
          type: 'success'
        });
      } else {
        console.log('No data found on server. Uploading local data...');
        
        // إذا لم تكن هناك بيانات على السيرفر، قم برفع البيانات المحلية
        await saveProductsToSupabase(products);
        
        setNotification({
          message: 'تم رفع البيانات المحلية إلى السيرفر بنجاح!',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error syncing with server:', error);
      setNotification({
        message: 'حدثت مشكلة أثناء المزامنة مع السيرفر',
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div>
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-md ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">إدارة المنتجات</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSyncWithServer}
            disabled={isSyncing || !isOnline()}
            className={`px-4 py-2 rounded-md flex items-center text-sm ${
              isOnline() 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            {isSyncing ? (
              <>
                <FiRefreshCw className="ml-2 animate-spin" />
                جارِ المزامنة...
              </>
            ) : (
              <>
                <FiRefreshCw className="ml-2" />
                مزامنة مع السيرفر
              </>
            )}
          </button>
          <button
            onClick={handleAddProduct}
            className="bg-primary text-white px-4 py-2 rounded-md flex items-center self-end md:self-auto"
          >
            <FiPlus className="ml-2" />
            إضافة منتج جديد
          </button>
        </div>
      </div>

      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الصورة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الاسم
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                كود المنتج
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                سعر القطعة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-10 w-10 rounded-full"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.productCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.piecePrice} جنيه
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="text-indigo-600 hover:text-indigo-900 ml-3"
                  >
                    <FiEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Product Cards - Shown only on Mobile */}
      <div className="md:hidden space-y-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-4 mb-3">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-16 w-16 rounded-md object-cover"
              />
              <div className="flex-1">
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-gray-600 text-sm">كود: {product.productCode}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <span className="font-bold">سعر القطعة:</span> {product.piecePrice} جنيه
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="font-bold">سعر الدستة:</span> {product.packPrice} جنيه
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="font-bold">سعر الكرتونة:</span> {product.boxPrice} جنيه
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="font-bold">الكمية:</span> {product.boxQuantity} قطعة
              </div>
            </div>
            
            <div className="flex justify-end gap-4 mt-2">
              <button
                onClick={() => handleEditProduct(product)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md flex items-center text-sm"
              >
                <FiEdit className="ml-1" /> تعديل
              </button>
              <button
                onClick={() => handleDeleteProduct(product.id)}
                className="bg-red-500 text-white px-4 py-2 rounded-md flex items-center text-sm"
              >
                <FiTrash2 className="ml-1" /> حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold">
                {currentProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <FiX size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  اسم المنتج
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label
                  htmlFor="productCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  كود المنتج
                </label>
                <input
                  type="text"
                  id="productCode"
                  value={formData.productCode}
                  onChange={(e) =>
                    setFormData({ ...formData, productCode: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isNew"
                  checked={formData.isNew || false}
                  onChange={(e) =>
                    setFormData({ ...formData, isNew: e.target.checked })
                  }
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label
                  htmlFor="isNew"
                  className="mr-2 block text-sm font-medium text-gray-700"
                >
                  منتج جديد
                </label>
              </div>
              
              <div>
                <label
                  htmlFor="boxQuantity"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  الكمية داخل الكرتونة
                </label>
                <input
                  type="number"
                  id="boxQuantity"
                  value={formData.boxQuantity}
                  onChange={(e) =>
                    setFormData({ ...formData, boxQuantity: e.target.value })
                  }
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="piecePrice"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    سعر القطعة
                  </label>
                  <input
                    type="number"
                    id="piecePrice"
                    value={formData.piecePrice}
                    onChange={(e) =>
                      setFormData({ ...formData, piecePrice: e.target.value })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label
                    htmlFor="packPrice"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    سعر الدستة
                  </label>
                  <input
                    type="number"
                    id="packPrice"
                    value={formData.packPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, packPrice: e.target.value })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label
                    htmlFor="boxPrice"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    سعر الكرتونة
                  </label>
                  <input
                    type="number"
                    id="boxPrice"
                    value={formData.boxPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, boxPrice: e.target.value })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  صورة المنتج
                </label>
                <div className="mt-1 flex flex-col sm:flex-row items-center gap-4">
                  {formData.imageUrl ? (
                    <div className="relative">
                      <img 
                        src={formData.imageUrl} 
                        alt="صورة المنتج" 
                        className="h-32 w-32 object-cover rounded-md" 
                      />
                      <button
                        type="button"
                        onClick={handleImageClick}
                        className="absolute bottom-0 left-0 bg-primary text-white p-1 rounded-md"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleImageClick}
                      className="bg-gray-200 hover:bg-gray-300 p-6 sm:p-8 rounded-md flex flex-col items-center w-full sm:w-auto"
                    >
                      <FiImage className="h-8 w-8 text-gray-500" />
                      <span className="mt-2 text-gray-600 text-sm">اضغط لإضافة صورة</span>
                    </button>
                  )}
                  <div className="flex-1 w-full">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, imageUrl: e.target.value })
                      }
                      placeholder="أو أدخل رابط الصورة مباشرة"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  {currentProduct ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 