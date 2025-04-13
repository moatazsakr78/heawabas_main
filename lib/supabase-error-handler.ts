// مدير معالجة أخطاء Supabase
// يساعد على تصنيف الأخطاء وتقديم رسائل مناسبة للمستخدم

export enum SupabaseErrorType {
  CONNECTION = 'connection',
  RLS_POLICY = 'rls_policy',
  AUTHENTICATION = 'authentication',
  DATA_STRUCTURE = 'data_structure',
  UNKNOWN = 'unknown'
}

export interface SupabaseErrorDetails {
  type: SupabaseErrorType;
  message: string;
  userFriendlyMessage: string;
  technicalDetails?: string;
  suggestions?: string[];
  timestamp: number;
}

export interface SyncStatus {
  lastSuccessfulSync: number | null;
  lastAttemptedSync: number;
  lastError: SupabaseErrorDetails | null;
  isOnline: boolean;
}

// تاريخ أخطاء المزامنة
const MAX_ERROR_HISTORY = 10;
let syncErrorHistory: SupabaseErrorDetails[] = [];

// حالة المزامنة الحالية
let currentSyncStatus: SyncStatus = {
  lastSuccessfulSync: null,
  lastAttemptedSync: 0,
  lastError: null,
  isOnline: true
};

/**
 * تحليل وتصنيف الخطأ من Supabase
 */
export function classifySupabaseError(error: any): SupabaseErrorDetails {
  const errorMessage = error?.message || error?.toString() || 'خطأ غير معروف';
  const timestamp = Date.now();
  
  // تصنيف الخطأ بناءً على الرسالة
  if (!navigator.onLine || errorMessage.includes('network') || errorMessage.includes('اتصال')) {
    return {
      type: SupabaseErrorType.CONNECTION,
      message: 'فشل الاتصال بالخادم',
      userFriendlyMessage: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.',
      suggestions: ['تحقق من اتصالك بالإنترنت', 'حاول مجدداً بعد بضع دقائق'],
      timestamp
    };
  }
  
  if (errorMessage.includes('row-level security') || errorMessage.includes('permission') || errorMessage.includes('RLS')) {
    return {
      type: SupabaseErrorType.RLS_POLICY,
      message: 'فشل بسبب سياسات الأمان RLS',
      userFriendlyMessage: 'تم حفظ البيانات محلياً، لكن لا يمكن مزامنتها مع الخادم بسبب إعدادات الأمان.',
      suggestions: ['راجع إعدادات RLS في لوحة تحكم Supabase', 'تحقق من حالة تسجيل الدخول'],
      technicalDetails: errorMessage,
      timestamp
    };
  }

  if (errorMessage.includes('auth') || errorMessage.includes('authentication') || errorMessage.includes('token')) {
    return {
      type: SupabaseErrorType.AUTHENTICATION,
      message: 'مشكلة في المصادقة',
      userFriendlyMessage: 'انتهت جلسة التسجيل. يرجى تسجيل الدخول مرة أخرى.',
      suggestions: ['أعد تسجيل الدخول', 'تحقق من صلاحيات الحساب'],
      timestamp
    };
  }

  if (errorMessage.includes('format') || errorMessage.includes('schema') || errorMessage.includes('type') || errorMessage.includes('constraint')) {
    return {
      type: SupabaseErrorType.DATA_STRUCTURE,
      message: 'مشكلة في بنية البيانات',
      userFriendlyMessage: 'هناك مشكلة في بنية البيانات. تم حفظ البيانات محلياً.',
      suggestions: ['تحقق من تنسيق البيانات', 'راجع تعريف الجداول في Supabase'],
      technicalDetails: errorMessage,
      timestamp
    };
  }

  // خطأ غير معروف
  return {
    type: SupabaseErrorType.UNKNOWN,
    message: 'خطأ غير معروف',
    userFriendlyMessage: 'حدث خطأ غير متوقع. تم حفظ البيانات محلياً.',
    technicalDetails: errorMessage,
    timestamp
  };
}

/**
 * تسجيل خطأ من Supabase مع تخزينه في التاريخ
 */
export function logSupabaseError(error: any): SupabaseErrorDetails {
  const errorDetails = classifySupabaseError(error);
  
  // تحديث تاريخ الأخطاء
  syncErrorHistory.unshift(errorDetails);
  if (syncErrorHistory.length > MAX_ERROR_HISTORY) {
    syncErrorHistory = syncErrorHistory.slice(0, MAX_ERROR_HISTORY);
  }
  
  // تحديث حالة المزامنة
  currentSyncStatus.lastAttemptedSync = Date.now();
  currentSyncStatus.lastError = errorDetails;
  currentSyncStatus.isOnline = navigator.onLine;
  
  // تسجيل الخطأ في وحدة التحكم (يمكن تعطيلها في الإنتاج)
  console.error('Supabase error:', errorDetails);
  
  return errorDetails;
}

/**
 * تحديث حالة المزامنة الناجحة
 */
export function logSuccessfulSync() {
  currentSyncStatus.lastSuccessfulSync = Date.now();
  currentSyncStatus.lastAttemptedSync = Date.now();
  currentSyncStatus.lastError = null;
  currentSyncStatus.isOnline = navigator.onLine;
}

/**
 * الحصول على حالة المزامنة الحالية
 */
export function getSyncStatus(): SyncStatus {
  // تحديث حالة الاتصال بالإنترنت
  currentSyncStatus.isOnline = navigator.onLine;
  return { ...currentSyncStatus };
}

/**
 * الحصول على تاريخ أخطاء المزامنة
 */
export function getErrorHistory(): SupabaseErrorDetails[] {
  return [...syncErrorHistory];
}

/**
 * إعادة ضبط تاريخ الأخطاء
 */
export function clearErrorHistory() {
  syncErrorHistory = [];
} 