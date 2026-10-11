import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import coreEn from '@/core/i18n/en';
import '@/core/styles/main.css';
import AdminApp from './AdminApp.vue';

// the moderation page is English only; the core components still need their texts
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: coreEn } });

createApp(AdminApp).use(i18n).mount('#admin');
