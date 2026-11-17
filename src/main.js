import { createRouter } from './router.js';
import { routes } from './routes.js';

const router = createRouter(routes, document.getElementById('app'), { appName: 'CodeRecord' });
router.start();
