import 'core-js'

import { attachConsole } from '@tauri-apps/plugin-log'
await attachConsole()

window.$isDev = import.meta.env.DEV
import * as Vue from 'vue'
window.$$lib$$.Vue = Vue
import * as Vant from 'vant'
window.$$lib$$.Vant = Vant
import * as Naive from 'naive-ui'
window.$$lib$$.Naive = Naive

import { CORSFetch } from 'tauri-plugin-cors-fetch-no-aws'
const cors = CORSFetch.init()
cors.config({ request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } } })

import * as Axios from 'axios'
import axios from 'axios'
window.fetch = fetch

axios.defaults.timeout = 7000
axios.defaults.adapter = ['fetch']

window.$$lib$$.Axios = { ...Axios, ...axios, axios }

import * as Dcc from 'delta-comic-core'
window.$$lib$$.Dcc = Dcc
import * as Vr from 'vue-router'
window.$$lib$$.VR = Vr
import * as Pinia from 'pinia'
window.$$lib$$.Pinia = Pinia
window.$api.NImage = Naive.NImage
window.$api.showImagePreview = Vant.showImagePreview