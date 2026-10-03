plugins {
    id("com.android.application")
}

android {
    namespace = "org.mantlelibrary.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.mantlelibrary.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 5
        versionName = "1.0.4"
    }

    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }

    val releaseKeystore = rootProject.file("keystore/mantle-release.jks")
    if (releaseKeystore.exists()) {
        signingConfigs {
            create("release") {
                storeFile = releaseKeystore
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("KEY_ALIAS") ?: "munajaat"
                keyPassword = System.getenv("KEY_PASSWORD") ?: ""
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            vcsInfo.include = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (releaseKeystore.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.0")
}
