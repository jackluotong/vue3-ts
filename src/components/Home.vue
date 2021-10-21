<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-19 17:26:55
 * @LastEditors: william
 * @LastEditTime: 2021-10-21 16:34:49
 * @For What?: 
-->
<style scoped></style>
<template>
    <div>
        <h1>Home.vue</h1>
    </div>
</template>
<script lang="ts">
import { onMounted, ref, onBeforeMount } from 'vue'
const myMinxin = {
    setup(props: any) {
        onMounted(() => {
            console.log('minxin mounted', props)
        })
    },
}
export default {
    mixins: [myMinxin],
    setup() {
        const root = ref(null)
        onMounted(() => {
            console.log(root)
        })
        onBeforeMount(() => {
            console.log('before mount')
        })
        return {
            root,
        }
    },
    data() {
        return {}
    },
    methods: {},
}
</script>
