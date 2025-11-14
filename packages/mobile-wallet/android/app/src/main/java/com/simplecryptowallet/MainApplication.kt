package com.simplecryptowallet

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {
    override fun getUseDeveloperSupport(): Boolean = true

    override fun getPackages(): List<ReactPackage> {
      return listOf(
        MainReactPackage()
      )
    }

    override fun getJSMainModuleName(): String = "index"
  }

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
  }
}
