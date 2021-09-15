<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-09-16 00:28:09
 * @LastEditors: william
 * @LastEditTime: 2021-09-16 01:38:02
 * @For What?: 
-->
<style scoped></style>

<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeMount } from 'vue'
defineProps<{ msg: string; testNumber: string }>()

const count = ref(0)
onBeforeMount(() => {
    console.log('onBeforeMount')
})
</script>

<template>
    <h1>{{ msg }}</h1>
    <h2>{{ testNumber }}</h2>
    <button type="button" @click="count++">count is: {{ count }}</button>
</template>
