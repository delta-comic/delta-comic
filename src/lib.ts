import "core-js"

window.$isDev = import.meta.env.DEV
import * as Vue from 'vue'
window.$$lib$$.Vue = Vue
import * as Vant from 'vant'
window.$$lib$$.Vant = Vant
import * as Naive from 'naive-ui'
window.$$lib$$.Naive = Naive
import * as Axios from 'axios'


import axios from 'axios'
axios.defaults.timeout = 7000
import axiosTauriApiAdapter from 'axios-tauri-api-adapter'
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
