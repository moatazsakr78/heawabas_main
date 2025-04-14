'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX, FiImage, FiRefreshCw, FiTool } from 'react-icons/fi';
import { saveData, loadData, hasData } from '@/lib/localStorage';
import { getCategories } from '@/lib/data';
import { saveProductsToSupabase, loadProductsFromSupabase, syncProductsFromSupabase, forceRefreshFromServer, isOnline, createOrUpdateProductsTable, resetAndSyncProducts } from '@/lib/supabase';
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

  useEffect(() => {
    initializePage();
    
    // إضافة مستمع للاتصال بالإنترنت
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // إضافة مستمع لأحداث التخزين
    window.addEventListener('customStorageChange', handleStorageChange);
    
    // تعطيل المزامنة التلقائية الدورية لأنها تسبب مشاكل في المزامنة المتكررة
    // const intervalId = setInterval(() => {
    //   checkAndSyncIfNeeded();
    // }, 60000 * 5); // كل 5 دقائق
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      window.removeEventListener('customStorageChange', handleStorageChange);
      // clearInterval(intervalId);
    };
  }, []);
  
  // دالة للتحقق والمزامنة عند الحاجة
  const checkAndSyncIfNeeded = () => {
    // لا نزامن إذا كان هناك عملية مزامنة حالية
    if (isSyncing || syncCooldown) {
      return;
    }
    
    // لا نزامن إذا لم يكن هناك اتصال بالإنترنت
    if (!isOnline()) {
      return;
    }
    
    // التحقق من وقت آخر مزامنة
    const now = Date.now();
    const minSyncInterval = 60000 * 5; // 5 دقائق
    
    // إذا كان آخر مزامنة منذ أقل من 5 دقائق، نتخطى المزامنة
    if (lastSyncTime && (now - lastSyncTime < minSyncInterval)) {
      return;
    }
    
    console.log('محاولة مزامنة تلقائية...');
    forceRefreshFromServer()
      .then(serverProducts => {
        if (serverProducts && Array.isArray(serverProducts) && serverProducts.length > 0) {
          // تحديث وقت آخر مزامنة
          setLastSyncTime(Date.now());
          
          // مقارنة عدد المنتجات
          const storedCount = products.length;
          const serverCount = serverProducts.length;
          
          // إذا كان هناك اختلاف في العدد أو آخر مزامنة منذ أكثر من 15 دقيقة
          if (storedCount !== serverCount || !lastSyncTime || (now - lastSyncTime) > 60000 * 15) {
            console.log(`تم اكتشاف تغيير في البيانات (محلياً: ${storedCount}، السيرفر: ${serverCount})`);
            
            // تحديث واجهة المستخدم والتخزين المحلي
            setProducts(serverProducts as Product[]);
            saveData('products', serverProducts);
            localStorage.setItem('products', JSON.stringify(serverProducts));
            
            setNotification({
              message: 'تم تحديث البيانات من السيرفر تلقائياً',
              type: 'info'
            });
            setTimeout(() => setNotification(null), 3000);
          }
        }
      })
      .catch(error => {
        console.error('خطأ في المزامنة التلقائية:', error);
      });
  };

  // دالة لتهيئة الصفحة وإعداد جداول قاعدة البيانات
  const initializePage = async () => {
    try {
      setIsLoading(true);
      
      // التحقق من الاتصال بالإنترنت
      if (isOnline()) {
        console.log('جاري التحقق من هيكل قاعدة البيانات...');
        try {
          // إنشاء أو تحديث هيكل جدول المنتجات
          await createOrUpdateProductsTable();
          console.log('تم التحقق من هيكل قاعدة البيانات بنجاح');
        } catch (error) {
          console.error('خطأ أثناء تهيئة قاعدة البيانات:', error);
          setNotification({
            message: 'حدث خطأ أثناء التحقق من هيكل قاعدة البيانات. سيتم استخدام الوضع المحلي فقط.',
            type: 'error'
          });
          setTimeout(() => setNotification(null), 5000);
        }
      }
      
      // تحميل البيانات
      await loadProductsData();
      await loadCategoriesData();
      
      // تعيين وقت آخر مزامنة
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('خطأ في تهيئة الصفحة:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // دالة للتعامل مع تغييرات الاتصال بالإنترنت
  const handleOnlineStatusChange = () => {
    if (isOnline()) {
      console.log('تم استعادة الاتصال بالإنترنت.');
      setNotification({
        message: 'تم استعادة الاتصال بالإنترنت. اضغط على زر المزامنة لتحديث البيانات.',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 5000);
      
      // تعطيل المزامنة التلقائية عند استعادة الاتصال لمنع المزامنة المتكررة
      // التعليق التالي يمنع المزامنة التلقائية عند استعادة الاتصال
      // if (!isSyncing && !syncCooldown) {
      //   setTimeout(() => {
      //     syncProductsAndUpdate(false);
      //   }, 1500);
      // }
    } else {
      console.log('تم فقد الاتصال بالإنترنت. سيتم استخدام البيانات المحلية فقط.');
      setNotification({
        message: 'تم فقد الاتصال بالإنترنت. سيتم حفظ التغييرات محلياً فقط.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
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

  // تحميل بيانات المنتجات
  const loadProductsData = async () => {
    try {
      console.log('جاري تحميل بيانات المنتجات...');
      
      // محاولة مزامنة المنتجات من Supabase أولاً إذا كان متصلاً بالإنترنت
      if (isOnline()) {
        try {
          console.log('جاري محاولة تحميل المنتجات مباشرة من السيرفر...');
          
          // استخدام طريقة forceRefreshFromServer بدلاً من loadProductsFromSupabase
          // هذا يضمن الحصول على أحدث البيانات من السيرفر
          const serverProducts = await forceRefreshFromServer();
          
          if (serverProducts && Array.isArray(serverProducts)) {
            console.log('تم تحميل المنتجات من السيرفر بنجاح:', serverProducts.length);
            
            // تحديث حالة المنتجات بالبيانات المستلمة من السيرفر
            setProducts(prevProducts => {
              // استبدال البيانات القديمة تماماً
              return [...serverProducts] as Product[];
            });
            
            // تحديث التخزين المحلي بالبيانات
            saveData('products', serverProducts);
            localStorage.setItem('products', JSON.stringify(serverProducts));
            
            // تحديث وقت آخر مزامنة
            setLastSyncTime(Date.now());
            
            // إطلاق حدث التحديث
            window.dispatchEvent(new CustomEvent('customStorageChange', {
              detail: { type: 'products', source: 'server' }
            }));
            
            setNotification({
              message: 'تم تحميل البيانات من السيرفر بنجاح',
              type: 'success'
            });
            setTimeout(() => setNotification(null), 3000);
            setIsLoading(false);
            return;
          } else {
            console.log('لم يتم العثور على منتجات في السيرفر، جاري التحقق من البيانات المحلية');
          }
        } catch (error) {
          console.error('خطأ في تحميل المنتجات من السيرفر:', error);
        }
      } else {
        console.log('الجهاز غير متصل بالإنترنت. سيتم استخدام البيانات المحلية فقط.');
      }
      
      // محاولة استرجاع البيانات من التخزين المحلي الدائم
      const savedProducts = await loadData('products');
      
      if (savedProducts && Array.isArray(savedProducts) && savedProducts.length > 0) {
        console.log('جاري استخدام البيانات من التخزين الدائم:', savedProducts.length);
        
        // تحديد المنتجات في الحالة
        setProducts(prevProducts => [...savedProducts] as Product[]);
        
        // نسخة احتياطية في localStorage العادي
        localStorage.setItem('products', JSON.stringify(savedProducts));
        
        // إظهار رسالة توضح أن البيانات من التخزين المحلي
        if (isOnline()) {
          setNotification({
            message: 'تم تحميل البيانات من التخزين المحلي.',
            type: 'info'
          });
          setTimeout(() => setNotification(null), 5000);
        }
      } else {
        // التحقق من وجود البيانات في localStorage التقليدي
        const localStorageProducts = localStorage.getItem('products');
        if (localStorageProducts) {
          try {
            const parsedProducts = JSON.parse(localStorageProducts);
            if (parsedProducts && Array.isArray(parsedProducts) && parsedProducts.length > 0) {
              console.log('تم تحميل البيانات من localStorage:', parsedProducts.length);
              setProducts(parsedProducts);
            }
          } catch (error) {
            console.error('خطأ في تحليل البيانات من localStorage:', error);
          }
        }
      }
    } catch (error) {
      console.error('خطأ في تحميل المنتجات:', error);
      setNotification({
        message: 'حدث خطأ أثناء تحميل المنتجات',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // دالة المزامنة مع السيرفر وتحديث الواجهة
  const syncProductsAndUpdate = async (showNotification = false) => {
    // وقت النتظار بين عمليات المزامنة (10 ثوان)
    const SYNC_COOLDOWN_TIME = 10000; // 10 ثوان
    
    // التحقق إذا كان هناك عملية مزامنة حالية
    if (isSyncing) {
      console.log('هناك عملية مزامنة جارية بالفعل، يرجى الانتظار...');
      setNotification({
        message: 'هناك عملية مزامنة جارية بالفعل، يرجى الانتظار...',
        type: 'info'
      });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    
    // التحقق من وقت الانتظار بين عمليات المزامنة
    if (syncCooldown) {
      console.log('تم طلب المزامنة مؤخراً، يرجى الانتظار...');
      setNotification({
        message: 'يرجى الانتظار قليلاً بين عمليات المزامنة',
        type: 'info'
      });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    
    if (!isOnline()) {
      console.log('لا يوجد اتصال بالإنترنت. تم تخطي المزامنة.');
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. تم تخطي المزامنة.',
        type: 'warning'
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }
    
    // تعيين حالة المزامنة والوقت الفاصل
    setIsSyncing(true);
    setSyncCooldown(true);
    
    try {
      // بدلاً من استخدام syncProductsFromSupabase، نستخدم resetAndSyncProducts
      // هذا سيضمن تطابق هيكل الجدول مع البيانات
      console.log('استخدام إعادة ضبط ومزامنة المنتجات...');
      
      const serverProducts = await resetAndSyncProducts(products);
      
      // تحديث وقت آخر مزامنة
      setLastSyncTime(Date.now());
      
      if (serverProducts) {
        // فحص نوع البيانات المرجعة - إما مصفوفة أو كائن
        if (Array.isArray(serverProducts)) {
          // تحديث واجهة المستخدم بالمنتجات المزامنة
          setProducts(serverProducts as Product[]);
          console.log("تم تحديث المنتجات من السيرفر:", serverProducts.length);
          
          // التأكد من تحديث البيانات المحلية أيضاً
          localStorage.setItem('products', JSON.stringify(serverProducts));
          try {
            await saveData('products', serverProducts);
          } catch (e) {
            console.error('خطأ في حفظ البيانات محلياً:', e);
          }
          
          if (showNotification) {
            setNotification({
              message: `تم تحديث المنتجات من السيرفر: ${serverProducts.length} منتج`,
              type: "success"
            });
            setTimeout(() => setNotification(null), 5000);
          }
        } else {
          // التعامل مع حالة الكائن (success, message)
          console.log("نتيجة المزامنة:", serverProducts.message);
          
          if (showNotification) {
            setNotification({
              message: serverProducts.message,
              type: serverProducts.success ? "success" : "warning"
            });
            setTimeout(() => setNotification(null), 5000);
          }
        }
      } else {
        console.log("لم يتم العثور على منتجات في السيرفر");
        
        if (showNotification) {
          setNotification({
            message: "لم يتم العثور على منتجات في السيرفر",
            type: "warning"
          });
          setTimeout(() => setNotification(null), 5000);
        }
      }
    } catch (error: any) {
      console.error("خطأ أثناء المزامنة:", error);
      
      setNotification({
        message: `حدث خطأ أثناء المزامنة: ${error.message || "خطأ غير معروف"}`,
        type: "error"
      });
      setTimeout(() => setNotification(null), 8000);
    } finally {
      setIsSyncing(false);
      
      // إعادة تعيين حالة المزامنة بعد وقت الانتظار (10 ثوان)
      setTimeout(() => {
        console.log('تم إعادة تعيين وقت الانتظار للمزامنة');
        setSyncCooldown(false);
      }, SYNC_COOLDOWN_TIME);
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
    let errorMessage = '';
    
    if (isOnline()) {
      try {
        console.log('جاري مزامنة المنتجات مع السيرفر...');
        
        // استخدام resetAndSyncProducts بدلاً من saveProductsToSupabase للمزامنة الكاملة
        const result = await resetAndSyncProducts(newProducts);
        
        if (Array.isArray(result)) {
          syncSuccess = true;
          console.log('تمت مزامنة المنتجات مع السيرفر بنجاح، عدد المنتجات:', result.length);
          // تحديث البيانات المحلية بالبيانات المُرجعة من السيرفر
          setProducts(result as Product[]);
          saveData('products', result);
          localStorage.setItem('products', JSON.stringify(result));
        } else if (typeof result === 'object') {
          if (result.success) {
            syncSuccess = true;
            console.log('تمت مزامنة المنتجات مع السيرفر بنجاح:', result.message);
          } else {
            errorMessage = result.message || 'خطأ غير معروف في المزامنة';
            console.error('خطأ في الحفظ إلى السيرفر:', errorMessage);
            setNotification({
              message: `تم حفظ البيانات محلياً فقط. ${errorMessage}`,
              type: 'warning'  // تغيير النوع إلى تحذير بدلاً من خطأ لأن البيانات نُفذت محلياً
            });
            setTimeout(() => setNotification(null), 8000);
          }
        }
      } catch (error: any) {
        console.error('خطأ في الحفظ إلى السيرفر:', error);
        
        // استخدام الرسالة الودية للمستخدم إذا كانت متاحة
        errorMessage = error.userFriendlyMessage || error.message || 'خطأ غير معروف في المزامنة';
        
        setNotification({
          message: `تم حفظ البيانات محلياً فقط. ${errorMessage}`,
          type: 'warning'  // تغيير النوع إلى تحذير بدلاً من خطأ لأن البيانات نُفذت محلياً
        });
        setTimeout(() => setNotification(null), 8000);
      }
    }
    
    // إرسال أحداث التخزين لإعلام بقية التطبيق بالتغييرات
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'products', timestamp: Date.now() }
        }));
      }
      
      // عرض إشعار نجاح فقط إذا لم يكن هناك خطأ بالفعل
      if (!errorMessage) {
        setNotification({
          message: isOnline() && syncSuccess 
            ? 'تم حفظ التغييرات بنجاح ومزامنتها مع السيرفر. التغييرات ستظهر في جميع الأجهزة.' 
            : 'تم حفظ التغييرات محلياً فقط. ستتم المزامنة عند اتصالك بالإنترنت.',
          type: 'success'
        });
      }
      
    } catch (error) {
      console.error('خطأ في إرسال حدث التخزين:', error);
      setNotification({
        message: 'حدثت مشكلة أثناء حفظ التغييرات',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
      // إعطاء وقت أطول لعرض رسائل الخطأ
      if (!errorMessage) {
        setTimeout(() => setNotification(null), 5000);
      }
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

  // وظيفة مساعدة للمزامنة مع السيرفر
  const syncWithServerAfterChanges = async (productsToSync: Product[]) => {
    if (isOnline()) {
      setIsSyncing(true);
      try {
        console.log('جاري مزامنة التغييرات مع السيرفر...');
        
        // استخدام resetAndSyncProducts بدلاً من saveProductsToSupabase
        // هذه الوظيفة تقوم بمزامنة كاملة وتضمن أن البيانات في السيرفر مطابقة تماماً للبيانات المحلية
        const result = await resetAndSyncProducts(productsToSync);
        
        if (Array.isArray(result)) {
          console.log('تم مزامنة التغييرات مع السيرفر بنجاح، عدد المنتجات:', result.length);
          
          // تأكد من تحديث الواجهة تحديثاً مباشراً بالبيانات الجديدة
          setProducts(prevProducts => {
            // تجاهل البيانات القديمة تماماً واستخدام البيانات الجديدة فقط
            const newProducts = [...result] as Product[];
            return newProducts;
          });
          
          // التأكد من تحديث البيانات المحلية أيضاً
          saveData('products', result);
          localStorage.setItem('products', JSON.stringify(result));
          
          // إطلاق حدث لإخبار جميع أجزاء التطبيق بالتغيير
          window.dispatchEvent(new CustomEvent('customStorageChange', {
            detail: { type: 'products', source: 'server' }
          }));
          
          setNotification({
            message: 'تم مزامنة التغييرات مع السيرفر بنجاح',
            type: 'success'
          });
        } else if (typeof result === 'object') {
          console.log('نتيجة المزامنة:', result.message);
          if (!result.success) {
            setNotification({
              message: `تم الحفظ محلياً فقط: ${result.message}`,
              type: 'warning'
            });
          } else {
            setNotification({
              message: result.message,
              type: 'success'
            });
          }
        }
      } catch (error: any) {
        console.error('خطأ في مزامنة التغييرات مع السيرفر:', error);
        setNotification({
          message: `فشل في مزامنة التغييرات: ${error.message || 'خطأ غير معروف'}`,
          type: 'error'
        });
      } finally {
        setIsSyncing(false);
        setTimeout(() => setNotification(null), 5000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedProducts: Product[] = [];
    
    if (currentProduct) {
      // تحديث منتج موجود
      updatedProducts = products.map((prod) =>
        prod.id === currentProduct.id
          ? {
              ...prod,
              name: formData.name,
              productCode: formData.productCode,
              boxQuantity: parseInt(formData.boxQuantity),
              piecePrice: parseFloat(formData.piecePrice),
              imageUrl: formData.imageUrl,
              isNew: formData.isNew,
              updated_at: new Date().toISOString(),
            }
          : prod
      );
    } else {
      // إضافة منتج جديد
      const newProduct = {
        id: Date.now().toString(),
        name: formData.name,
        productCode: formData.productCode,
        boxQuantity: parseInt(formData.boxQuantity),
        piecePrice: parseFloat(formData.piecePrice),
        imageUrl: formData.imageUrl,
        isNew: formData.isNew,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updatedProducts = [...products, newProduct];
    }
    
    await saveProducts(updatedProducts);
    
    // مزامنة التغييرات مع السيرفر
    await syncWithServerAfterChanges(updatedProducts);
    
    setIsModalOpen(false);
  };

  const handleDeleteProduct = async (id: string) => {
    // العثور على اسم المنتج لعرضه في رسالة التأكيد
    const productToDelete = products.find(p => p.id === id);
    const productName = productToDelete ? productToDelete.name : 'هذا المنتج';
    
    // تأكد من وجود window قبل استخدام confirm
    if (typeof window !== 'undefined' && window.confirm(`هل أنت متأكد من حذف المنتج: ${productName}؟`)) {
      // عرض رسالة تحميل
      setIsLoading(true);
      setNotification({
        message: `جاري حذف المنتج: ${productName}...`,
        type: 'info'
      });
      
      try {
        // حذف المنتج من القائمة المحلية
        const newProducts = products.filter((product) => product.id !== id);
        console.log(`تم حذف المنتج ${id}، عدد المنتجات الجديد:`, newProducts.length);
        
        // تحديث واجهة المستخدم أولاً لتحسين تجربة المستخدم
        setProducts(newProducts);
        
        // حفظ التغييرات محلياً
        saveData('products', newProducts);
        localStorage.setItem('products', JSON.stringify(newProducts));
        
        // المزامنة مع السيرفر لحذف المنتج نهائياً
        const syncResult = await resetAndSyncProducts(newProducts);
        
        if (syncResult && Array.isArray(syncResult)) {
          console.log('تم مزامنة الحذف مع السيرفر بنجاح، عدد المنتجات الحالي:', syncResult.length);
          
          // تحديث المنتجات في الحالة بالبيانات المرجعة من السيرفر
          setProducts(syncResult);
          // تحديث التخزين المحلي أيضاً
          saveData('products', syncResult);
          localStorage.setItem('products', JSON.stringify(syncResult));
          
          // إشعار نجاح العملية
          setNotification({
            message: `تم حذف المنتج "${productName}" ومزامنة التغييرات بنجاح`,
            type: 'success'
          });
        } else if (typeof syncResult === 'object' && !syncResult.success) {
          console.warn('تم الحذف محلياً ولكن حدثت مشكلة في المزامنة:', syncResult.message);
          setNotification({
            message: `تم حذف المنتج محلياً فقط: ${syncResult.message}`,
            type: 'warning'
          });
        }
      } catch (error: any) {
        console.error('خطأ أثناء حذف المنتج:', error);
        setNotification({
          message: `فشل في حذف المنتج: ${error.message || 'خطأ غير معروف'}`,
          type: 'error'
        });
        
        // إعادة تحميل البيانات من التخزين المحلي فقط لتجنب إعادة ظهور المنتجات المحذوفة
        loadLocalProductsOnly();
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

      let updatedProducts: Product[] = [];
      
      if (currentProduct) {
        // تحديث منتج موجود
        updatedProducts = products.map((prod) =>
          prod.id === currentProduct.id
            ? updatedProduct
            : prod
        );
      } else {
        // إضافة منتج جديد
        updatedProducts = [...products, updatedProduct];
      }
      
      await saveProducts(updatedProducts);
      
      // مزامنة التغييرات مع السيرفر
      await syncWithServerAfterChanges(updatedProducts);
      
      setIsModalOpen(false);
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

  // دالة للتعامل مع تغييرات التخزين
  const handleStorageChange = (event: any) => {
    // تجنب إعادة التحميل إذا كان مصدر التغيير هو هذه الصفحة
    if (event.detail?.source === 'server' || event.detail?.type !== 'products') {
      return;
    }
    
    if (event.detail?.type === 'products') {
      console.log('تم اكتشاف تغيير في بيانات المنتجات من مصدر خارجي، جاري تحديث الواجهة...');
      // تحميل البيانات من التخزين المحلي فقط دون مزامنة مع السيرفر
      loadLocalProductsOnly();
    }
  };
  
  // دالة لتحميل المنتجات من التخزين المحلي فقط دون مزامنة
  const loadLocalProductsOnly = () => {
    try {
      // محاولة استرداد المنتجات من التخزين المحلي
      const localProducts = localStorage.getItem('products');
      if (localProducts) {
        const parsedProducts = JSON.parse(localProducts);
        console.log('تم تحميل المنتجات من التخزين المحلي فقط. عدد المنتجات:', parsedProducts.length);
        setProducts(parsedProducts);
      } else {
        console.log('لم يتم العثور على منتجات في التخزين المحلي');
        setProducts([]);
      }
    } catch (error) {
      console.error('خطأ في تحميل المنتجات من التخزين المحلي:', error);
      setProducts([]);
    }
  };

  // دالة لمزامنة البيانات مع السيرفر
  const handleSyncWithServer = async () => {
    // التحقق من وقت الانتظار بين عمليات المزامنة
    if (syncCooldown) {
      setNotification({
        message: 'يرجى الانتظار قليلاً قبل إجراء مزامنة جديدة',
        type: 'info'
      });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    
    // التحقق إذا كان هناك عملية مزامنة حالية
    if (isSyncing) {
      setNotification({
        message: 'هناك عملية مزامنة جارية بالفعل...',
        type: 'info'
      });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    
    if (!isOnline()) {
      setNotification({
        message: 'لا يوجد اتصال بالإنترنت. يرجى الاتصال أولاً.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    console.log('بدء مزامنة يدوية للمنتجات مع السيرفر');
    syncProductsAndUpdate(true);
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