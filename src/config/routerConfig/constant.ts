/*
 * @Description: all routers config in this file
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-19 18:02:59
 * @LastEditors: william
 * @LastEditTime: 2021-10-22 17:38:57
 * @For What?: 
 */
import { Transition } from 'vue'
import Home from '../../components/Home.vue'
const constantRoutes = [
    {
        name: 'home',
        path: '/',
        alias:'/home',
        component: Home,
        meta:{
            Transition:'side-left'
        },
        children: {
            
        }
    }
]
export default constantRoutes