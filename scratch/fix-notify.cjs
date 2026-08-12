const fs = require('fs');
const file = 'standalone-scripts/marco-sdk/src/notify.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add resolveColors if not exists
if (!content.includes('function resolveColors()')) {
  const resolveColorsCode = `
function resolveColors(): Record<ToastLevelType, { text: string; bg: string; border: string; icon: string }> {
  return {
    [ToastLevelType.Info]: { text: "#00529B", bg: "#BDE5F8", border: "#00529B", icon: "ℹ️" },
    [ToastLevelType.Success]: { text: "#4F8A10", bg: "#DFF2BF", border: "#4F8A10", icon: "✅" },
    [ToastLevelType.Warn]: { text: "#9F6000", bg: "#FEEFB3", border: "#9F6000", icon: "⚠️" },
    [ToastLevelType.Error]: { text: "#D8000C", bg: "#FFD2D2", border: "#D8000C", icon: "❌" },
  };
}
`;
  content = content.replace('// eslint-disable-next-line max-lines-per-function', resolveColorsCode + '\n// eslint-disable-next-line max-lines-per-function');
}

// 2. Fix enum values
content = content.replace(/= "error"/g, '= ToastLevelType.Error');
content = content.replace(/level === "error"/g, 'level === ToastLevelType.Error');
content = content.replace(/level === "warn"/g, 'level === ToastLevelType.Warn');
content = content.replace(/level === "info"/g, 'level === ToastLevelType.Info');
content = content.replace(/level === "success"/g, 'level === ToastLevelType.Success');

content = content.replace(/showToast\(message, "info", opts\)/g, 'showToast(message, ToastLevelType.Info, opts)');
content = content.replace(/showToast\(message, "success", opts\)/g, 'showToast(message, ToastLevelType.Success, opts)');
content = content.replace(/showToast\(message, "warn", opts\)/g, 'showToast(message, ToastLevelType.Warn, opts)');
content = content.replace(/showToast\(message, "error", opts\)/g, 'showToast(message, ToastLevelType.Error, opts)');

fs.writeFileSync(file, content);
