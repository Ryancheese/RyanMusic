plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val repoRoot = rootProject.projectDir.parentFile
val siteSrc = File(repoRoot, "maicong-music")
val siteAssets = File(projectDir, "src/main/assets/maicong-music")

android {
    namespace = "cn.ryanmusic.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "cn.ryanmusic.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1855
        versionName = "1.8.55"
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
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

    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.11.0")
}

tasks.register<Sync>("syncSiteAssets") {
    from(siteSrc) {
        exclude("**/core/cache/**")
        exclude("**/.git/**")
        exclude("**/node_modules/**")
        exclude("**/.DS_Store")
        exclude("**/docker-compose.yml")
        exclude("**/Dockerfile")
    }
    into(siteAssets)
}

tasks.register("ensurePhpBinary") {
    doLast {
        val php = File(projectDir, "src/main/jniLibs/arm64-v8a/libphp.so")
        if (!php.exists() || php.length() < 1_000_000) {
            throw GradleException(
                "缺少 PHP 二进制：$php\n请先运行：bash android/scripts/fetch-php.sh"
            )
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn("syncSiteAssets", "ensurePhpBinary")
}
