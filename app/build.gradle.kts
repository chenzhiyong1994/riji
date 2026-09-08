plugins { id("com.android.application") }
android {
 namespace = "local.jilian.app"
 compileSdk = 36
 defaultConfig { applicationId = "local.jilian.app"; minSdk = 26; targetSdk = 36; versionCode = 7; versionName = "1.0.6" }
 buildTypes { release { isMinifyEnabled = false } }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
