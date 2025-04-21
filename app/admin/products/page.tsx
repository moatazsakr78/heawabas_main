'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX, FiImage, FiRefreshCw, FiTool } from 'react-icons/fi';
import { getCategories } from '@/lib/data';
import { forceRefreshFromServer, isOnline, supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { Category as CategoryType } from '@/types';
import { Plus, Trash, Edit, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// تعريف نوع Category هنا بدلاً من استيراده
interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
}

interface Product {
  id: string;
  name: string;
  productCode: string;
  boxQuantity: number;
  piecePrice: number;
  imageUrl: string;
  isNew: boolean;
  createdAt: string;
  created_at?: string;
  updated_at?: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadProductsDataRef = useRef<() => Promise<void>>();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; show?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    productCode: '',
    boxQuantity: '',
    piecePrice: '',
    imageUrl: '',
    isNew: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncCooldown, setSyncCooldown] = useState(false);
  const realtimeSubscription = useRef<{ subscription: any } | null>(null);

  useEffect(() => {
    initializePage();
    
    // Store the loadProductsData function in a ref to use it in the realtime subscription
    loadProductsDataRef.current = loadProductsData;
    
    // إضافة مستمع للاتصال بالإنترنت
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // Add a new useEffect for the Supabase Realtime subscription
  useEffect(() => {
    // Don't set up subscription if offline
    if (!isOnline()) return;

    console.log('تهيئة اشتراك Supabase Realtime لجدول المنتجات');
    
    // Create a channel for postgres_changes on the products table
    const channel = supabase
      .channel('realtime:admin-products')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('تم استلام تحديث Realtime:', payload.eventType, payload);
          
          // Call loadProductsData to refresh the data
          if (loadProductsDataRef.current) {
            console.log(`تم اكتشاف ${payload.eventType} للمنتج. جاري إعادة تحميل البيانات...`);
            loadProductsDataRef.current();
          }
        }
      )
      .subscribe((status) => {
        console.log('حالة اشتراك Supabase Realtime:', status);
      });

    // Cleanup function to remove the channel when the component unmounts
    return () => {
      console.log('تنظيف اشتراك Supabase Realtime');
      supabase.removeChannel(channel);
    };
  }, []); // Run once at component mount
  
  // دالة لتهيئة الصفحة
  const initializePage = async () => {
    try {
      setIsLoading(true);
      
      if (!isOnline()) {
        setNotification({
          message: 'لا يوجد اتصال بالإنترنت. يرجى الاتصال لعرض البيانات.',
          type: 'error'
        });
        setTimeout(() => setNotification(null), 5000);
        return;
      }
      
      // تحميل البيانات
      await loadProductsData();
      await loadCategoriesData();
      
    } catch (error) {
      console.error('خطأ في تهيئة الصفحة:', error);
      setNotification({
        message: 'حدث خطأ أثناء تحميل البيانات',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // دالة للتعامل مع تغييرات الاتصال بالإنترنت
  const handleOnlineStatusChange = () => {
    if (isOnline()) {
      console.log('تم استعادة الاتصال بالإنترنت.');
      setNotification({
        message: 'تم استعادة الاتصال بالإنترنت. جاري تحديث البيانات.',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 5000);
      
      // تحديث البيانات فوراً عند استعادة الاتصال
      loadProductsData();
    } else {
      console.log('تم فقد الاتصال بالإنترنت.');
      setNotification({
        message: 'تم فقد الاتصال بالإنترنت. لن يتم عرض أحدث البيانات حتى يتم إعادة الاتصال.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // تحميل بيانات الفئات
  const loadCategoriesData = async () => {
    try {
      // استخدام دالة getCategories مباشرة
      setCategories(getCategories());
    } catch (error) {
      console.error('Error loading categories:', error);
      // استخدام دالة getCategories كبديل
      setCategories(getCategories());
    }
  };

  // تحميل بيانات المنتجات
  const loadProductsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // استخدام وظيفة forceRefreshFromServer للتأكد من تحميل البيانات مباشرة من السيرفر
      const products = await forceRefreshFromServer();
      
      if (!products) {
        console.log('لم يتم العثور على منتجات');
        setProducts([]);
        return;
      }
      
      console.log('تم تحميل المنتجات من Supabase بنجاح. عدد المنتجات:', products.length);
      setProducts(products);
    } catch (error: any) {
      console.error('خطأ غير متوقع أثناء تحميل المنتجات:', error);
      setNotification({
        message: `حدث خطأ أثناء تحميل البيانات: ${error.message || 'خطأ غير معروف'}`,
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // تحميل المنتجات وإعداد اشتراك Realtime
  useEffect(() => {
    // تحميل بيانات المنتجات مباشرة عند تحميل الصفحة
    loadProductsData();

    // إعداد اشتراك Realtime لمراقبة التغييرات في جدول المنتجات
    const setupRealtimeSubscription = async () => {
      // إلغاء أي اشتراك سابق أولاً
      if (realtimeSubscription.current?.subscription) {
        supabase.removeChannel(realtimeSubscription.current.subscription);
      }

      // إنشاء اشتراك جديد
      const channel = supabase
        .channel('products_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'products' 
          }, 
          async (payload) => {
            console.log('تم استلام تغيير في المنتجات من Realtime:', payload);
            
            // تحميل بيانات المنتجات مباشرة بعد أي تغيير
            loadProductsData();
          }
        )
        .subscribe((status) => {
          console.log('حالة اشتراك Realtime:', status);
          if (status === 'SUBSCRIBED') {
            console.log('تم إنشاء اشتراك Realtime للمنتجات بنجاح');
          }
        });

      // تخزين الاشتراك للاستخدام لاحقاً
      realtimeSubscription.current = { subscription: channel };
    };

    // إعداد اشتراك Realtime
    setupRealtimeSubscription();

    // تنظيف الاشتراك عند إلغاء تحميل المكون
    return () => {
      if (realtimeSubscription.current?.subscription) {
        supabase.removeChannel(realtimeSubscription.current.subscription);
      }
    };
  }, [loadProductsData]);

  // تحميل الفئات من Supabase
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data: categoriesData, error } = await supabase
          .from('categories')
          .select('*');
          
        if (error) {
          console.error('خطأ في تحميل الفئات:', error);
          return;
        }
        
        if (categoriesData) {
          const formattedCategories = categoriesData.map((category: any) => ({
            id: category.id,
            name: category.name,
            slug: category.slug || category.id.toString(),
            description: category.description || '',
            image: category.image || '',
          }));
          
          setCategories(formattedCategories);
        }
      } catch (error) {
        console.error('خطأ في تحميل الفئات:', error);
      }
    };
    
    loadCategories();
  }, []);
  
  // Supabase direct operations
  const saveProductToSupabase = async (product: Product) => {
    if (!isOnline()) {
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. لا يمكن حفظ التغييرات.',
        type: 'error'
      });
      return false;
    }

    try {
      // إعداد المنتج بالتنسيق المناسب للقاعدة
      const dbProduct = {
        id: product.id,
        name: product.name,
        product_code: product.productCode,
        box_quantity: product.boxQuantity,
        piece_price: product.piecePrice,
        image_url: product.imageUrl,
        is_new: product.isNew,
        created_at: product.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category_id: null // إذا كان هناك حاجة لتعيين فئة
      };

      const { data, error } = await supabase
        .from('products')
        .upsert(dbProduct, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('خطأ في حفظ المنتج:', error);
        setNotification({
          message: `خطأ في حفظ المنتج: ${error.message}`,
          type: 'error'
        });
        setTimeout(() => setNotification(null), 5000);
        return false;
      }
      
      console.log('تم حفظ المنتج بنجاح:', product.name);
      return true;
    } catch (error: any) {
      console.error('خطأ غير متوقع:', error);
      setNotification({
        message: `خطأ غير متوقع: ${error.message || 'خطأ غير معروف'}`,
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
      return false;
    }
  };

  const deleteProductFromSupabase = async (id: string) => {
    if (!isOnline()) {
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. لا يمكن حذف المنتج.',
        type: 'error'
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('خطأ في حذف المنتج:', error);
        setNotification({
          message: `خطأ في حذف المنتج: ${error.message}`,
          type: 'error'
        });
        setTimeout(() => setNotification(null), 5000);
        return false;
      }
      
      console.log('تم حذف المنتج بنجاح، معرف:', id);
      return true;
    } catch (error: any) {
      console.error('خطأ غير متوقع:', error);
      setNotification({
        message: `خطأ غير متوقع: ${error.message || 'خطأ غير معروف'}`,
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
      return false;
    }
  };

  const refreshProductsFromSupabase = async () => {
    if (!isOnline()) {
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. لا يمكن تحديث البيانات.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setIsSyncing(true);
    try {
      await loadProductsData();
      setNotification({
        message: 'تم تحديث البيانات من السيرفر بنجاح',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('خطأ في تحديث البيانات:', error);
      setNotification({
        message: 'حدث خطأ أثناء تحديث البيانات',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddProduct = () => {
    setCurrentProduct(null);
    setFormData({
      name: '',
      productCode: '',
      boxQuantity: '',
      piecePrice: '',
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
      imageUrl: product.imageUrl,
      isNew: product.isNew,
    });
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    // العثور على اسم المنتج لعرضه في رسالة التأكيد
    const productToDelete = products.find(p => p.id === id);
    const productName = productToDelete ? productToDelete.name : 'هذا المنتج';
    
    // تأكد من وجود window قبل استخدام confirm
    if (typeof window !== 'undefined' && window.confirm(`هل أنت متأكد من حذف المنتج: ${productName}؟`)) {
      setIsLoading(true);
      setNotification({
        message: `جاري حذف المنتج: ${productName}...`,
        type: 'info'
      });
      
      try {
        // حذف المنتج من Supabase
        const success = await deleteProductFromSupabase(id);
        
        if (success) {
          // تحديث القائمة المحلية فقط بعد نجاح الحذف من Supabase
          // (الاستجابة من الـ Realtime ستقوم بتحديث البيانات تلقائياً)
          setNotification({
            message: `تم حذف المنتج "${productName}" بنجاح`,
            type: 'success'
          });
        }
      } catch (error: any) {
        console.error('خطأ أثناء حذف المنتج:', error);
        setNotification({
          message: `فشل في حذف المنتج: ${error.message || 'خطأ غير معروف'}`,
          type: 'error'
        });
      } finally {
        setIsLoading(false);
        setTimeout(() => setNotification(null), 5000);
      }
    }
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

  const handleUpdateProduct = async () => {
    setIsLoading(true);
    
    try {
      // التحقق من صحة الإدخالات
      if (!formData.name || formData.name.trim() === '') {
        setNotification({
          message: 'خطأ: اسم المنتج مطلوب',
          type: 'error'
        });
        setIsLoading(false);
        return;
      }
      
      // التحقق من صحة الأرقام
      const boxQuantity = parseInt(formData.boxQuantity.toString()) || 0;
      const piecePrice = parseFloat(formData.piecePrice.toString()) || 0;
      
      if (boxQuantity < 0 || piecePrice < 0) {
        setNotification({
          message: 'خطأ: لا يمكن أن تكون الأسعار أو الكميات بقيم سالبة',
          type: 'error'
        });
        setIsLoading(false);
        return;
      }
      
      // الحفاظ على تاريخ الإنشاء الأصلي إذا كان موجودًا، وإلا تعيين تاريخ حالي
      const currentDate = new Date().toISOString();
      const updatedProduct = {
        ...formData,
        id: currentProduct?.id || Date.now().toString(),
        createdAt: currentProduct?.createdAt || currentDate,
        created_at: currentProduct?.created_at || currentDate,
        updated_at: currentDate,
        boxQuantity: boxQuantity,
        piecePrice: piecePrice,
      };

      // أولاً نغلق النافذة لتحسين تجربة المستخدم
      setIsModalOpen(false);
      
      // حفظ المنتج مباشرة إلى Supabase
      const success = await saveProductToSupabase(updatedProduct);
      
      if (success) {
        // سيتم تحديث الواجهة تلقائياً من خلال اشتراك Realtime
        setNotification({
          message: `تم ${currentProduct ? 'تحديث' : 'إضافة'} المنتج بنجاح`,
          type: 'success'
        });
        setTimeout(() => setNotification(null), 3000);
      }
      
      setIsLoading(false);
    } catch (error: any) {
      console.error('خطأ في تحديث المنتج:', error);
      setNotification({
        message: `حدثت مشكلة أثناء ${currentProduct ? 'تحديث' : 'إضافة'} المنتج: ${error.message || 'خطأ غير معروف'}`,
        type: 'error'
      });
      setIsLoading(false);
      setTimeout(() => setNotification(null), 8000);
    }
  };

  const handleSyncWithServer = async () => {
    if (!isOnline()) {
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. يرجى الاتصال أولاً.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    if (isSyncing) {
      setNotification({
        message: 'هناك عملية تحديث جارية بالفعل...',
        type: 'info'
      });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    
    console.log('بدء تحديث يدوي للمنتجات من السيرفر');
    refreshProductsFromSupabase();
  };

  return (
    <div className="p-4 md:p-5 rtl">
      {notification && (
        <div className={`${
          notification.type === 'error' ? 'bg-red-100 text-red-700' : 
          notification.type === 'success' ? 'bg-green-100 text-green-700' : 
          notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
          'bg-blue-100 text-blue-700'
        } p-4 mb-4 rounded-md shadow-sm`}>
          {notification.message}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
        <h1 className="text-2xl font-bold mb-2 md:mb-0">إدارة المنتجات</h1>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleSyncWithServer} 
            className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
            disabled={isSyncing || isLoading || !isOnline()}
          >
            {isSyncing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري المزامنة...
              </span>
            ) : (
              <span className="flex items-center">
                <FiRefreshCw className="ml-2" />
                مزامنة مع السيرفر
              </span>
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
            <form className="space-y-4">
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
                  type="button"
                  onClick={handleUpdateProduct}
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