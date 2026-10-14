package org.delta_comic.utils

import android.app.Activity
import android.webkit.CookieManager
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class CookieHeaderOptions {
    lateinit var url: String
}

@TauriPlugin
class UtilsPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun getCookieHeader(invoke: Invoke) {
        val args = invoke.parseArgs(CookieHeaderOptions::class.java)
        if (!args.url.startsWith("http://") && !args.url.startsWith("https://")) {
            invoke.reject("CookieManager only supports http and https URLs")
            return
        }

        val manager = CookieManager.getInstance()
        manager.flush()

        val ret = JSObject()
        ret.put("cookieHeader", manager.getCookie(args.url) ?: "")
        invoke.resolve(ret)
    }
}
