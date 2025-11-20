"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.show = show;
exports.showSuccess = showSuccess;
exports.showError = showError;
exports.showInfo = showInfo;
var react_native_toast_message_1 = require("react-native-toast-message");
var DEFAULT_DURATION = 4000;
function show(type, title, message, duration) {
    if (duration === void 0) { duration = DEFAULT_DURATION; }
    react_native_toast_message_1.default.show({
        type: type,
        text1: title,
        text2: message,
        visibilityTime: duration,
    });
}
function showSuccess(title, message, duration) {
    show('success', title, message, duration);
}
function showError(title, message, duration) {
    show('error', title, message, duration);
}
function showInfo(title, message, duration) {
    show('info', title, message, duration);
}
exports.default = { show: show, showSuccess: showSuccess, showError: showError, showInfo: showInfo };
