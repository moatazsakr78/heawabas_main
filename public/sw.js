// Service Worker لتخزين الصور في cache بشكل فعال
// يساعد في تقليل Egress من Supabase عن طريق تخزين الصور محليًا

const CACHE_NAME = 'product-images-cache-v1';
const PRODUCT_IMAGES_REGEX = /.*\.supabase\.co\/storage\/v1\/object\/public\/product-images\/.*/;

// عند تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  // تفعيل Service Worker الجديد فورًا
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Cache opened');
      // لا نقوم بتخزين شيء مبدئيًا، سيتم تخزين الصور عند طلبها
    })
  );
});

// عند تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  // التحكم في الصفحات فورًا دون الانتظار للتحديث
  event.waitUntil(clients.claim());
  
  // حذف ذاكرة التخزين المؤقت القديمة
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// التقاط طلبات الشبكة
self.addEventListener('fetch', (event) => {
  // التحقق مما إذا كان الطلب لصورة منتج
  if (PRODUCT_IMAGES_REGEX.test(event.request.url)) {
    console.log('Service Worker: Fetching product image', event.request.url);
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // إذا كانت الصورة موجودة في cache، نعيدها مباشرة
        if (cachedResponse) {
          console.log('Service Worker: Using cached image', event.request.url);
          return cachedResponse;
        }
        
        // إذا لم تكن الصورة في cache، نقوم بطلبها من الشبكة
        return fetch(event.request).then((networkResponse) => {
          // نتحقق من نجاح الاستجابة
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            console.log('Service Worker: Network response not valid', event.request.url);
            return networkResponse;
          }
          
          // نقوم بنسخ الاستجابة لأن الجسم يمكن استخدامه مرة واحدة فقط
          const responseToCache = networkResponse.clone();
          
          // نضيف الاستجابة إلى cache
          caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching new image', event.request.url);
            cache.put(event.request, responseToCache);
          });
          
          return networkResponse;
        }).catch((error) => {
          console.error('Service Worker: Fetch failed:', error);
          
          // محاولة إرجاع نسخة قديمة من الصورة إذا كانت موجودة
          return caches.match(event.request);
        });
      })
    );
  } else {
    // بالنسبة لجميع الطلبات الأخرى، نتركها تعمل بشكل طبيعي
    return;
  }
}); 