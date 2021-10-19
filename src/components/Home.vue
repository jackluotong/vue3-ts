<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-19 17:26:55
 * @LastEditors: william
 * @LastEditTime: 2021-10-19 18:58:33
 * @For What?: 
-->
<style scoped></style>
<template>
    <div>
        <h1>Home.vue</h1>
    </div>
</template>
<script lang="ts">
import { onMounted } from 'vue'
let list: number[] = [1, 2, 3, 4]
onMounted(() => {
    alert(1)
    console.log(list)
})
</script>
