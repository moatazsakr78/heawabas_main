'use client';

import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX, FiImage } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import { saveData, loadData, hasData } from '@/lib/localStorage';

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

  useEffect(() => {
    loadProductsData();
  }, []);

  // تحميل بيانات المنتجات بطريقة تضمن الثبات
  const loadProductsData = async () => {
    try {
      // محاولة استرجاع البيانات باستخدام وظيفة التخزين المحلي الدائم
      const savedProducts = await loadData('products');
      
      if (savedProducts && Array.isArray(savedProducts)) {
        setProducts(savedProducts);
      } else {
        // التحقق من وجود البيانات في localStorage التقليدي
        const localStorageProducts = localStorage.getItem('products');
        if (localStorageProducts) {
          const parsedProducts = JSON.parse(localStorageProducts);
          // حفظ البيانات في التخزين الدائم للمرات القادمة
          saveData('products', parsedProducts);
          setProducts(parsedProducts);
        } else {
          // بيانات افتراضية إذا لم يتم العثور على أي بيانات
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
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // تعديل وظيفة حفظ المنتجات لاستخدام التخزين الدائم
  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    
    // حفظ البيانات في نظام التخزين الدائم
    saveData('products', newProducts);
    
    // أيضًا حفظ في localStorage التقليدي للتوافق مع بقية التطبيق
    localStorage.setItem('products', JSON.stringify(newProducts));
    
    // إرسال أحداث التخزين لإعلام بقية التطبيق بالتغييرات
    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('customStorageChange', { 
        detail: { type: 'products', timestamp: Date.now() }
      }));
      
      setNotification({
        message: 'تم حفظ التغييرات بنجاح! التغييرات ستظهر في صفحة العملاء',
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
    if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
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

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">إدارة المنتجات</h1>
        <button
          onClick={handleAddProduct}
          className="bg-primary text-white px-4 py-2 rounded-md flex items-center"
        >
          <FiPlus className="ml-2" />
          إضافة منتج جديد
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
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

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {currentProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX />
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
                <div className="mt-1 flex items-center">
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
                      className="bg-gray-200 hover:bg-gray-300 p-8 rounded-md flex flex-col items-center"
                    >
                      <FiImage className="h-10 w-10 text-gray-500" />
                      <span className="mt-2 text-gray-600 text-sm">اضغط لإضافة صورة</span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                  placeholder="أو أدخل رابط الصورة مباشرة"
                  className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mr-2 px-4 py-2 text-gray-600 hover:text-gray-800"
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