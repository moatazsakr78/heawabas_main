'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // التحقق من دعم المتصفح لـ Service Workers
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // تسجيل Service Worker
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    } else {
      console.log('Service Workers not supported in this browser');
    }
  }, []);

  // هذا المكون لا يعرض أي عناصر واجهة مستخدم
  return null;
} 