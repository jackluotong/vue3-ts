<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-21 14:30:02
 * @LastEditors: william
 * @LastEditTime: 2021-10-21 14:40:19
 * @For What?: 
-->
#   vue3
##  生命周期
-       unmounted
-       mounted
##  slot
        承载内容分发的出口
-       具名
-       作用域插槽
##  组件传值
-       Provide/Inject
            父组件有一个 provide 选项来提供数据，子组件有一个 inject 选项来开始使用这些数据
##       过渡动画
            1.基于class的动画和过渡
                <div :class="{ shake: noActivated }">
                    <button @click="noActivated = true">Click me</button>
                 </div>
            2.过渡与style绑定
                <div
                    @mousemove="xCoordinate"
                    :style="{ backgroundColor: `hsl(${x}, 80%, 50%)` }"
                    class="movearea"
                  >
                 </div>
            3.性能
                transform opacity perspective  
            4.过渡
                class 
                    v-enter-from
                    v-enter-active
                    v-enter-to
                    v-leave-from        
                    v-leave-active
                    v-leave-to 
                css
                    transition
                

    [查看css是否发生重绘](https://csstriggers.com/display)
### 组合式API
#### 为什么会出现

碎片化使得理解和维护复杂组件变得困难。选项的分离掩盖了潜在的逻辑问题。此外，在处理单个逻辑关注点时，我们必须不断地“跳转”相关代码的选项块。

如果能够将同一个逻辑关注点相关代码收集在一起会更好。而这正是组合式 API 使我们能够做到的。
####    setup
        新的 setup 选项在组件创建之前执行，一旦 props 被解析，就将作为组合式 API 的入口。
        在setup中不要使用this
-   ref        
        

-       额外
            $forceUpdate--强制更新
            v-once--只渲染一次缓存
            