import { createApp } from 'vue';
import App from './App.vue';
import vAutosize from './core/directives/autosize';
import { i18n } from './core/i18n';
import './core/styles/main.css';

createApp(App)
  .use(i18n)
  .directive('autosize', vAutosize)
  .mount('#app');
