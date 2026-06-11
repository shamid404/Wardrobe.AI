export type Lang = "en" | "ru";

const translations = {
  en: {
    // Nav tabs
    nav_studio: "Studio",
    nav_plan: "Plan",
    nav_history: "History",
    nav_outfits: "Outfits",
    nav_laundry: "Laundry",
    nav_shopping: "Shopping",
    // Settings
    settings_profile: "Profile",
    settings_appearance: "Appearance",
    settings_ai: "AI Settings",
    settings_data: "Data",
    settings_danger: "Danger Zone",
    settings_display_name: "Display Name",
    settings_change_photo: "Change photo",
    settings_save: "Save",
    settings_theme: "Theme",
    settings_theme_dark: "Dark",
    settings_theme_light: "Light",
    settings_language: "Language",
    settings_gemini_vision: "Gemini Vision Analysis",
    settings_gemini_wardrobe: "Wardrobe",
    settings_gemini_wishlist: "Wishlist",
    settings_tryon_defaults: "Try-On Defaults",
    settings_default_model: "Default model",
    settings_default_mode: "Default background",
    settings_change_password: "Change Password",
    settings_change_password_desc: "Send a verification code to your email",
    settings_send_code: "Send Code",
    settings_enter_code: "Enter 6-digit code",
    settings_new_password: "New password",
    settings_confirm_change: "Confirm",
    settings_delete_account: "Delete Account",
    settings_delete_desc: "Permanently remove your account and all data",
    settings_delete_btn: "Delete",
    settings_clear: "Clear",
    settings_replay: "Replay",
    settings_tryon_history: "Try-on history",
    settings_wardrobe: "Wardrobe",
    settings_onboarding: "Onboarding tour",
    // Common
    save: "Save",
    cancel: "Cancel",
    generate: "Generate Try-On",
    generating: "Generating…",
    upload_body: "Upload body photo",
    upload_clothing: "Photo from store",
    wishlist: "Wishlist",
    saved: "Saved ♥",
    compare: "Compare selected",
    plan_free: "Free Plan",
  },
  ru: {
    // Nav tabs
    nav_studio: "Студия",
    nav_plan: "План",
    nav_history: "История",
    nav_outfits: "Образы",
    nav_laundry: "Стирка",
    nav_shopping: "Шопинг",
    // Settings
    settings_profile: "Профиль",
    settings_appearance: "Внешний вид",
    settings_ai: "Настройки ИИ",
    settings_data: "Данные",
    settings_danger: "Опасная зона",
    settings_display_name: "Имя",
    settings_change_photo: "Сменить фото",
    settings_save: "Сохранить",
    settings_theme: "Тема",
    settings_theme_dark: "Тёмная",
    settings_theme_light: "Светлая",
    settings_language: "Язык",
    settings_gemini_vision: "Анализ Gemini Vision",
    settings_gemini_wardrobe: "Гардероб",
    settings_gemini_wishlist: "Вишлист",
    settings_tryon_defaults: "Настройки примерки",
    settings_default_model: "Модель по умолчанию",
    settings_default_mode: "Фон по умолчанию",
    settings_change_password: "Сменить пароль",
    settings_change_password_desc: "Отправим код подтверждения на email",
    settings_send_code: "Отправить код",
    settings_enter_code: "Введите 6-значный код",
    settings_new_password: "Новый пароль",
    settings_confirm_change: "Подтвердить",
    settings_delete_account: "Удалить аккаунт",
    settings_delete_desc: "Безвозвратно удалить аккаунт и все данные",
    settings_delete_btn: "Удалить",
    settings_clear: "Очистить",
    settings_replay: "Повторить",
    settings_tryon_history: "История примерок",
    settings_wardrobe: "Гардероб",
    settings_onboarding: "Обучение",
    // Common
    save: "Сохранить",
    cancel: "Отмена",
    generate: "Примерить",
    generating: "Генерация…",
    upload_body: "Загрузить фото",
    upload_clothing: "Фото из магазина",
    wishlist: "Вишлист",
    saved: "Сохранено ♥",
    compare: "Сравнить выбранные",
    plan_free: "Бесплатный план",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, lang: Lang): string {
  return (translations[lang] as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
}

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem("wardrobe_lang") as Lang) ?? "en";
}

export function saveLang(lang: Lang) {
  localStorage.setItem("wardrobe_lang", lang);
}
