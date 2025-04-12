'use client';

// وظائف حفظ واسترجاع البيانات من التخزين المحلي مع دعم التخزين الدائم عبر فترات إعادة التشغيل

// حفظ البيانات في كل من LocalStorage وSessionStorage لزيادة الثبات
export function saveData(key: string, data: any): void {
  // التحقق من كون التطبيق يعمل في بيئة المتصفح
  if (typeof window === 'undefined') return;
  
  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem(key, serializedData);
    sessionStorage.setItem(key, serializedData);
    
    // تخزين في IndexedDB مع التحقق من دعم المتصفح والتعامل مع الأخطاء
    try {
      if (window.indexedDB) {
        saveToIndexedDB(key, data).catch(err => {
          console.log('IndexedDB save fallback to localStorage only:', err);
        });
      }
    } catch (idbError) {
      console.log('IndexedDB not supported, using localStorage only');
    }
  } catch (error) {
    console.error(`Error saving data for key ${key}:`, error);
  }
}

// استرجاع البيانات مع تفضيل LocalStorage لتبسيط العملية
export async function loadData(key: string): Promise<any> {
  // التحقق من كون التطبيق يعمل في بيئة المتصفح
  if (typeof window === 'undefined') return null;
  
  try {
    // محاولة استرجاع البيانات من LocalStorage أولاً كطريقة أكثر موثوقية
    const serializedData = localStorage.getItem(key);
    if (serializedData) {
      return JSON.parse(serializedData);
    }

    // محاولة استرجاع البيانات من SessionStorage
    const sessionData = sessionStorage.getItem(key);
    if (sessionData) {
      // إعادة تخزينها في LocalStorage إذا وُجدت فقط في SessionStorage
      localStorage.setItem(key, sessionData);
      return JSON.parse(sessionData);
    }

    // محاولة استرجاع البيانات من IndexedDB كملاذ أخير
    try {
      if (window.indexedDB) {
        const dataFromIDB = await loadFromIndexedDB(key);
        if (dataFromIDB !== null) {
          // تحديث LocalStorage بالبيانات من IndexedDB
          localStorage.setItem(key, JSON.stringify(dataFromIDB));
          return dataFromIDB;
        }
      }
    } catch (idbError) {
      console.log('IndexedDB load failed, using localStorage only');
    }

    return null;
  } catch (error) {
    console.error(`Error loading data for key ${key}:`, error);
    return null;
  }
}

// حذف البيانات من جميع آليات التخزين
export function removeData(key: string): void {
  // التحقق من كون التطبيق يعمل في بيئة المتصفح
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    
    try {
      if (window.indexedDB) {
        removeFromIndexedDB(key).catch(err => {
          console.log('IndexedDB remove error:', err);
        });
      }
    } catch (idbError) {
      console.log('IndexedDB not supported, removed from localStorage only');
    }
  } catch (error) {
    console.error(`Error removing data for key ${key}:`, error);
  }
}

// دالة مساعدة للتحقق من وجود البيانات
export function hasData(key: string): boolean {
  // التحقق من كون التطبيق يعمل في بيئة المتصفح
  if (typeof window === 'undefined') return false;
  
  return localStorage.getItem(key) !== null || sessionStorage.getItem(key) !== null;
}

// --------- وظائف IndexedDB ---------

const DB_NAME = 'HeaWaBas_Storage';
const STORE_NAME = 'data_store';
const DB_VERSION = 1;

// فتح قاعدة البيانات IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject('IndexedDB غير مدعوم في هذا المتصفح');
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject('خطأ في فتح قاعدة البيانات IndexedDB');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

// حفظ البيانات في IndexedDB
async function saveToIndexedDB(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.put({ key, value: data });
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject('خطأ في حفظ البيانات في IndexedDB');
    });
  } catch (error) {
    console.error('خطأ في حفظ البيانات في IndexedDB:', error);
  }
}

// استرجاع البيانات من IndexedDB
async function loadFromIndexedDB(key: string): Promise<any> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject('خطأ في استرجاع البيانات من IndexedDB');
    });
  } catch (error) {
    console.error('خطأ في استرجاع البيانات من IndexedDB:', error);
    return null;
  }
}

// حذف البيانات من IndexedDB
async function removeFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.delete(key);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject('خطأ في حذف البيانات من IndexedDB');
    });
  } catch (error) {
    console.error('خطأ في حذف البيانات من IndexedDB:', error);
  }
} 