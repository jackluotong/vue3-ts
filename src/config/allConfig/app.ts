/*
 * @Description: config all need to depend app.vue
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-22 17:32:09
 * @LastEditors: william
 * @LastEditTime: 2021-10-22 17:37:23
 * @For What?: 
 */
import { createApp } from 'vue'
import router from '../../router/index'
import App from '../../App.vue'

 const app = createApp(App).use(router)
export default app