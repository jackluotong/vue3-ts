/*
 * @Description:
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-19 17:31:55
 * @LastEditors: william
 * @LastEditTime: 2021-10-22 16:43:57
 * @For What?:
 */
import { createRouter, createWebHistory,create } from "vue-router";
import constantRoutes from '../config/routerConfig/constant'
const routerHistory = createWebHistory()

const router = createRouter({
    history: routerHistory,
    routes: constantRoutes
})
export default router