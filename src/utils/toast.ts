import Toast from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info';

const DEFAULT_DURATION = 4000;

export function show(type: ToastType, title: string, message?: string, duration = DEFAULT_DURATION) {
  Toast.show({
    type,
    text1: title,
    text2: message,
    visibilityTime: duration,
  });
}

export function showSuccess(title: string, message?: string, duration?: number) {
  show('success', title, message, duration);
}

export function showError(title: string, message?: string, duration?: number) {
  show('error', title, message, duration);
}

export function showInfo(title: string, message?: string, duration?: number) {
  show('info', title, message, duration);
}

export default { show, showSuccess, showError, showInfo };
