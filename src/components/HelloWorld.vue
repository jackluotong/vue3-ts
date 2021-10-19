<!--
 * @Description: 
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-09-16 00:28:09
 * @LastEditors: william
 * @LastEditTime: 2021-10-19 19:03:19
 * @For What?: 
-->
<style scoped></style>
<template>
    <h1>{{ msg }}</h1>
    <h2>{{ testNumber }}</h2>
    <button type="button" @click="count++">count is: {{ count }}</button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeMount, onMounted } from 'vue'
defineProps<{ msg: string; testNumber: string }>()
const count = ref(0)
onBeforeMount(() => {
    class A {
        name: string
        constructor(name: string) {
            this.name = name
        }
        get() {
            return new Date()
        }
    }
    let a = new A('jack')
    console.log(a, a.get())
})
onMounted(() => {
    const hello: string = 'hello ts'
    class A {
        name(age: number, sex?: string) {
            if (sex) {
                return age + sex
            } else {
                return age
            }
        }

        add(...num: number[]) {
            return num.reduce((p, c) => {
                return p + c
            })
            // let sum: number = 0
            // for (let i = 0; i < num.length; i++) {
            //     sum = sum + num[i]
            // }
            // return sum
        }
    }
    interface type {
        name: string
    }
    let a = new A()
    console.log(a.add(123, 312, 312, 312, 3))
    let arr = [1, 212, 1321]
    let c = arr.forEach((item) => {
        console.log(++item)
    })
    let m = arr.map((item) => {
        return item * 2
    })
    let add = arr.reduce((p, c) => {
        return p + c
    })
    console.log(hello, m, add, '--------------')
    let _map = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
    ])
    console.log(_map)
    interface Person {
        idCard: string
        name: string
        age: number
        sex: string
        say: () => any
    }
    const customer: Person = {
        idCard: '62052319950929141X',
        name: 'william',
        age: 26,
        sex: 'boy',
        say: (): any => {
            return `i am ${name},`
        },
    }
    class C {
        constructor(name: any) {
            name
        }
    }
    interface SecondPerson extends C {
        sex: string
    }
    const student: SecondPerson = {
        sex: 'string',
    }

    /**
     * @name: 单一继承
     * @test:
     * @msg:
     * @param {*}
     * @return {*}
     */
    interface Musician extends Person {
        music: string
    }
    const drame = <Musician>{}
    drame.age = 28
    drame.music = 'the sound of silence'
    /**
     * @name: 多继承
     * @test:
     * @msg:
     * @param {*}
     * @return {*}
     */
    interface My extends Person, Musician {}
    const i = <My>{}
    const s: My = {
        name: 'william',
        idCard: '1212',
        age: 26,
        sex: 'boy',
        say: () => {
            console.log(1)
        },
        music: 'oo',
    }
    /**
     * @name: create class
     * @test:
     * @msg:
     * @param {*}
     * @return {*}
     */
    class Car {
        engine: string
        constructor(engine: string) {
            this.engine = engine
        }
        disp(): void {
            console.log(`engine is ${this.engine}`)
        }
    }
    const bnez = new Car('BENZ')
    class Home extends Car {
        static name1: string
        // constructor(engine: any) {
        //     super(engine)
        // }
    }
    const home = new Home('AUDIO')
    Home.name1 = 'jack'
    /**
     * @name:private public
     * @test:
     * @msg:
     * @param {*}
     * @return {*}
     */
    class Auth {
        public str1: string = 'hello'
        private str2: string = 'world'
    }
    const auth = new Auth()
    /**
     * @name:implements 类实现接口
     * @test:
     * @msg:
     * @param {*}
     * @return {*}
     */
    interface Slogan {
        word: string
    }
    class TodayWord implements Slogan {
        time: string
        word: string
        constructor(word: string, time: string) {
            this.time = time
            this.word = word
        }
    }
    console.log(
        customer.say(),
        student,
        drame,
        i.idCard,
        bnez,
        home.disp(),
        auth.str1
    )
    let list: string[] = []
    list.push('s')
    let list1: Array<number> = [1, 2, 31, 1, 11]
    let list2: [string, number]
    console.log(list, '=======', list1[1], list2)
})
</script>
