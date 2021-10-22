<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-19 17:26:55
 * @LastEditors: william
 * @LastEditTime: 2021-10-22 16:50:43
 * @For What?: 
-->
<style scoped></style>
<template>
    <div>
        <h1 style="margin: 0 auto">heelo this is a home page.</h1>
        <h1>Home.vue</h1>
        <button @click="add">++</button>
        <span>{{ state.count }}</span>
        <hr />
        <span>count is:{{ all }}</span>
        <hr />
        <span>{{ first }}</span>
        <input type="text" ref="phone" @keyup="phone" />
    </div>
</template>
<script lang="ts">
import {
    onMounted,
    ref,
    onBeforeMount,
    reactive,
    computed,
    watchEffect,
    defineComponent,
} from 'vue'
const myMinxin = {
    setup(props: any) {
        onMounted(() => {
            console.log('minxin mounted', props)
        })
    },
}
interface person {
    name: string
    age: number
}
export default defineComponent({
    mixins: [myMinxin],
    setup() {
        const pc = new RTCPeerConnection()
        console.log(pc)
        //执行先于beforeCreated
        // const first = ref(0)
        const root = ref(0)
        const state = reactive({
            count: 0,
        })
        const all = computed({
            get: () => root.value + 1,
            set: (val) => {
                root.value - 1
            },
        })
        const phoneNumber = ref(1)
        onMounted(() => {
            console.log(state, root, all, 'phoneNumber', phoneNumber)
        })
        onBeforeMount(() => {
            console.log('before mount')
        })
        watchEffect(() => console.log(state.count))
        // setInterval(() => state.count++, 1000)
        return {
            state,
            root,
            all,
            first: 0,
        }
    },
    // data() {
    //     return {
    //         all: 0,
    //     }
    // },
    methods: {
        add(): void {
            this.state.count++
            this.root++
            console.log(this.state, 'alllllll', this.all, this.root)
        },
        phone() {
            console.log(this.phoneNumber)
        },
        man(ma: person) {
            console.log('name is :' + ma.name)
            console.log('age is :' + ma.age)
        },
    },
})
</script>
