plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "br.com.erpimpar.centralobras"
    compileSdk = 35
    defaultConfig {
        applicationId = "br.com.erpimpar.centralobras"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0-review"
    }
    buildTypes { release { isMinifyEnabled = false } }
    kotlinOptions { jvmTarget = "17" }
}
