plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val repoRoot = rootProject.projectDir.parentFile

android {
    namespace = "cn.ryanmusic.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "cn.ryanmusic.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 2007
        versionName = "2.0.7"
        val cloudOriginFile = File(repoRoot, "shared/cloud-origin.txt")
        val cloudOrigin = cloudOriginFile
            .takeIf { it.exists() }
            ?.readText()
            ?.trim()
            ?.trimEnd('/')
            ?.plus("/")
            ?: "https://ryanmusic.vercel.app/"
        buildConfigField("String", "CLOUD_ORIGIN", "\"$cloudOrigin\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
