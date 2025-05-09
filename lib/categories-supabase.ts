// راجع التعليمات في ملف README.md لإضافة وظائف الفئات

import { supabase, isOnline } from './supabase';
import { saveData } from './localStorage';
import { logSupabaseError, logSuccessfulSync } from './supabase-error-handler';

// دالة مساعدة لتحويل أسماء الحقول من صيغة الشرطة السفلية إلى الحالة الجملية
function mapDatabaseToAppModel(category: any) {
  if (!category) return null;
  
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    description: category.description,
    createdAt: category.created_at
  };
}

// دالة مساعدة لتحويل أسماء الحقول من الحالة الجملية إلى صيغة الشرطة السفلية
function mapAppModelToDatabase(category: any) {
  if (!category) return null;
  
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    description: category.description
  };
}

// وظائف التعامل مع الفئات
export async function saveCategoriestoSupabase(categories: any[]): Promise<boolean | { success: boolean; message: string }> {
  if (!isOnline()) {
    console.error('Not online, cannot save categories to Supabase');
    const errorDetails = logSupabaseError(new Error('غير متصل بالإنترنت، تم حفظ الفئات محلياً فقط'));
    return {
      success: false,
      message: errorDetails.userFriendlyMessage
    };
  }

  try {
    console.log(`Saving ${categories.length} categories to Supabase`);

    // حذف الفئات الموجودة حالياً
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('id', 'placeholder');

    if (deleteError) {
      console.error('Failed to delete existing categories:', deleteError);
      const errorDetails = logSupabaseError(deleteError);
      return {
        success: false,
        message: errorDetails.userFriendlyMessage
      };
    }

    // تصفية الفئات للحصول على فئات فريدة
    const uniqueCategoriesMap = new Map();
    for (const category of categories) {
      uniqueCategoriesMap.set(category.id, category);
    }
    const uniqueCategories = Array.from(uniqueCategoriesMap.values());

    // تحويل الفئات إلى النموذج المناسب للقاعدة
    const dbCategories = uniqueCategories.map(category => mapAppModelToDatabase(category));

    // حفظ الفئات
    const { error: insertError } = await supabase.from('categories').insert(dbCategories);

    if (insertError) {
      console.error('Failed to save categories to Supabase:', insertError);
      const errorDetails = logSupabaseError(insertError);
      return {
        success: false,
        message: errorDetails.userFriendlyMessage
      };
    }

    console.log(`Successfully saved ${uniqueCategories.length} categories to Supabase`);
    
    // تحديث وقت المزامنة الأخير
    localStorage.setItem('lastSyncCategoriesTime', Date.now().toString());
    // تسجيل نجاح المزامنة
    logSuccessfulSync();
    
    // إرسال حدث عند نجاح المزامنة
    window.dispatchEvent(new CustomEvent('supabase-categories-sync-success', {
      detail: { count: uniqueCategories.length }
    }));

    return true;
  } catch (error) {
    console.error('Error in saveCategoriestoSupabase:', error);
    const errorDetails = logSupabaseError(error);
    return {
      success: false,
      message: errorDetails.userFriendlyMessage
    };
  }
}

export async function loadCategoriesFromSupabase() {
  try {
    if (!isOnline()) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('جاري تحميل الفئات من Supabase...');
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('خطأ في تحميل الفئات من Supabase:', error);
      throw error;
    }
    
    // التحقق من وجود بيانات
    if (!data || data.length === 0) {
      console.log('لا توجد فئات في Supabase');
      return null;
    }
    
    console.log('تم تحميل الفئات بنجاح من Supabase:', data.length);
    
    // تحويل البيانات إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    return appModels;
  } catch (error) {
    console.error('خطأ في loadCategoriesFromSupabase:', error);
    throw error;
  }
}

// دالة فعالة للمزامنة مع قاعدة البيانات
export async function syncCategoriesFromSupabase(force = false) {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن مزامنة الفئات.');
    return null;
  }
  
  try {
    console.log('بدء مزامنة الفئات...');
    
    // تحميل البيانات من السيرفر أولاً
    console.log('محاولة تحميل الفئات من السيرفر...');
    let serverData = null;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log('تم العثور على الفئات في السيرفر:', data.length);
        // تحويل البيانات من صيغة قاعدة البيانات إلى نموذج التطبيق
        serverData = data.map(mapDatabaseToAppModel);
      } else {
        console.log('لم يتم العثور على فئات في السيرفر');
      }
    } catch (error) {
      console.error('خطأ في جلب الفئات من السيرفر:', error);
    }
    
    // تحميل البيانات المحلية
    let localData = [];
    try {
      const storedData = localStorage.getItem('categories');
      if (storedData) {
        localData = JSON.parse(storedData);
        console.log('تم تحميل الفئات المحلية:', localData.length);
      }
    } catch (error) {
      console.error('خطأ في تحميل الفئات المحلية:', error);
    }
    
    // إذا وجدنا بيانات على السيرفر، استخدمها وحدّث البيانات المحلية
    if (serverData) {
      console.log('استخدام فئات السيرفر وتحديث التخزين المحلي');
      
      // تحويل البيانات إلى نموذج التطبيق
      const appModels = serverData;
      
      // تحديث البيانات المحلية
      localStorage.setItem('categories', JSON.stringify(appModels));
      try {
        saveData('categories', appModels);
      } catch (e) {
        console.error('خطأ في حفظ الفئات في التخزين الدائم:', e);
      }
      
      // إعلام التطبيق بالتغييرات
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'categories', timestamp: Date.now(), source: 'server' }
        }));
      }
      
      return appModels;
    } 
    // إذا لم نجد بيانات على السيرفر ولكن لدينا بيانات محلية، ارفعها إلى السيرفر
    else if (localData.length > 0) {
      console.log('لم يتم العثور على فئات في السيرفر. رفع الفئات المحلية...');
      
      try {
        // حذف أي بيانات موجودة في السيرفر
        await supabase.from('categories').delete().not('id', 'is', null);
        
        // تنظيف البيانات
        const uniqueCategories = localData.filter((c: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === c.id)
        );
        
        // تأكد من أن جميع البيانات بالتنسيق الصحيح للقاعدة
        const dbCategories = uniqueCategories.map((category: any) => {
          const dbCategory = mapAppModelToDatabase(category);
          
          if (dbCategory && typeof dbCategory.image === 'object') {
            dbCategory.image = JSON.stringify(dbCategory.image);
          }
          
          return dbCategory || {};
        });
        
        // رفع البيانات المحلية
        const { data, error } = await supabase
          .from('categories')
          .insert(dbCategories)
          .select();
        
        if (error) {
          throw error;
        }
        
        console.log('تم رفع الفئات المحلية بنجاح:', data.length);
        
        // تحويل البيانات المسترجعة إلى نموذج التطبيق 
        const appModels = data.map(mapDatabaseToAppModel);
        return appModels;
      } catch (error) {
        console.error('خطأ في رفع الفئات المحلية إلى السيرفر:', error);
        throw error;
      }
    }
    
    // لا توجد بيانات في أي مكان
    console.log('لا توجد فئات محلية أو على السيرفر');
    return null;
  } catch (error) {
    console.error('خطأ في syncCategoriesFromSupabase:', error);
    throw error;
  }
}

// إجبار تحديث الفئات من السيرفر
export async function forceRefreshCategoriesFromServer() {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن تحديث الفئات.');
    return null;
  }
  
  try {
    console.log('إجبار تحديث الفئات من السيرفر...');
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد فئات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل الفئات بنجاح من السيرفر:', data.length);
    
    // تحويل البيانات إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    
    // تحديث البيانات المحلية
    localStorage.setItem('categories', JSON.stringify(appModels));
    try {
      await saveData('categories', appModels);
    } catch (e) {
      console.error('خطأ في حفظ الفئات في التخزين الدائم:', e);
    }
    
    // إعلام التطبيق بالتغييرات بعد التخزين
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('customStorageChange', { 
            detail: { type: 'categories', timestamp: Date.now(), source: 'server' }
          }));
          console.log('تم إرسال إشعارات تحديث الفئات بنجاح');
        } catch (e) {
          console.error('خطأ أثناء إرسال إشعارات تحديث الفئات:', e);
        }
      }
    }, 100);
    
    return appModels;
  } catch (error) {
    console.error('خطأ في forceRefreshCategoriesFromServer:', error);
    throw error;
  }
}
