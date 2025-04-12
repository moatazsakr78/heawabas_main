'use client';

import { useState, useEffect } from 'react';
import { saveData, loadData } from '@/lib/localStorage';
import { FiSave, FiRefreshCw } from 'react-icons/fi';

export default function ProductSettings() {
  const [newProductDays, setNewProductDays] = useState(14);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Load existing settings when component mounts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const settings = await loadData('productSettings');
        
        if (settings && settings.newProductDays) {
          setNewProductDays(settings.newProductDays);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('حدث خطأ أثناء تحميل الإعدادات', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Save to localStorage
      await saveData('productSettings', { newProductDays });
      
      // Show success message
      showNotification('تم حفظ الإعدادات بنجاح', 'success');
      
      // Dispatch event to notify other components
      window.dispatchEvent(new Event('customStorageChange'));
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const showNotification = (message: string, type: string) => {
    setNotification({ show: true, message, type });
    
    // Hide after 3 seconds
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">إعدادات المنتجات</h1>
      
      {notification.show && (
        <div className={`mb-6 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {notification.message}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">إعدادات المنتجات الجديدة</h2>
        
        <div className="mb-6">
          <label htmlFor="newProductDays" className="block mb-2 font-medium text-gray-700">
            عدد الأيام التي يظهر فيها المنتج كجديد
          </label>
          <input
            type="number"
            id="newProductDays"
            min="1"
            max="365"
            value={newProductDays}
            onChange={(e) => setNewProductDays(parseInt(e.target.value, 10) || 14)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="mt-2 text-sm text-gray-500">
            بعد تحديد هذه المدة، سيتم إخفاء المنتج من قسم "المنتجات الجديدة"
          </p>
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex items-center bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400"
          >
            {isSaving ? (
              <>
                <FiRefreshCw className="animate-spin ml-2" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <FiSave className="ml-2" />
                حفظ الإعدادات
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 