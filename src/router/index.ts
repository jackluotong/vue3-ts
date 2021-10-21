/*
 * @Description:
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-19 17:31:55
 * @LastEditors: william
 * @LastEditTime: 2021-10-19 18:03:32
 * @For What?:
 */
import Vue from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import {constantRoutes} from '../config/routerConfig/constant'
const routerHistory = createWebHistory()

const router = createRouter({
    history: routerHistory,
    routes: constantRoutes
})
export default router({})