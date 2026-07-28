package cn.ryanmusic.app

import android.content.Context
import android.content.res.AssetManager
import android.util.Log
import java.io.File
import java.io.FileOutputStream

object SiteInstaller {
    private const val TAG = "RyanMusic.Site"
    private const val MARKER = ".site_version"
    private const val VERSION = "1.7.6"

    fun ensureInstalled(context: Context): File {
        val www = File(context.filesDir, "www")
        val marker = File(www, MARKER)
        if (www.exists() && marker.exists() && marker.readText().trim() == VERSION) {
            return www
        }

        if (www.exists()) {
            www.deleteRecursively()
        }
        www.mkdirs()
        copyAssetDir(context.assets, "maicong-music", www)
        // php.ini alongside site for -c
        copyAssetFile(context.assets, "php.ini", File(context.filesDir, "php.ini"))
        marker.writeText(VERSION)
        Log.i(TAG, "site installed -> ${www.absolutePath}")
        return www
    }

    private fun copyAssetDir(assets: AssetManager, assetPath: String, dest: File) {
        val children = assets.list(assetPath)
        if (children.isNullOrEmpty()) {
            // leaf file（部分机型对文件 list 返回 null/空）
            copyAssetFile(assets, assetPath, dest)
            return
        }
        if (!dest.exists()) dest.mkdirs()
        for (name in children) {
            val childAsset = if (assetPath.isEmpty()) name else "$assetPath/$name"
            val childDest = File(dest, name)
            val grand = assets.list(childAsset)
            if (grand != null && grand.isNotEmpty()) {
                copyAssetDir(assets, childAsset, childDest)
            } else {
                copyAssetFile(assets, childAsset, childDest)
            }
        }
    }

    private fun copyAssetFile(assets: AssetManager, assetPath: String, dest: File) {
        dest.parentFile?.mkdirs()
        assets.open(assetPath).use { input ->
            FileOutputStream(dest).use { output ->
                input.copyTo(output)
            }
        }
    }
}
