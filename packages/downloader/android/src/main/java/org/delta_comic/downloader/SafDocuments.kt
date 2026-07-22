package org.delta_comic.downloader

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import com.fasterxml.jackson.databind.ObjectMapper
import java.io.File
import java.net.URLConnection
import java.net.URI
import java.nio.file.Files
import java.security.MessageDigest

internal data class SafExportInstruction(
    val treeUri: String = "",
    val relativePath: String = "",
    val stagingPath: String = "",
    val isDirectory: Boolean = false,
)

internal data class SafOperationResult(
    val value: String? = null,
    val error: String? = null,
) {
    val succeeded: Boolean get() = error == null
}

internal fun safDestinationId(treeUri: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(treeUri.toByteArray(Charsets.UTF_8))
    return "saf-" + digest.take(16).joinToString("") { "%02x".format(it.toInt() and 0xff) }
}

internal fun validSafRelativePath(relativePath: String): Boolean {
    if (relativePath.isBlank() || relativePath.startsWith('/') || relativePath.contains('\\')) {
        return false
    }
    return relativePath.split('/').all { component ->
        component.isNotBlank() && component != "." && component != ".." &&
            component.none { it == '\u0000' || it == '/' || it == '\\' }
    }
}

internal fun validSafDocumentBinding(treeUri: String, documentUri: String): Boolean = try {
    val tree = URI(treeUri)
    val document = URI(documentUri)
    if (
        tree.scheme != "content" || document.scheme != "content" ||
        tree.authority != document.authority || tree == document
    ) {
        false
    } else {
        val treeSegments = tree.rawPath.split('/').filter(String::isNotBlank)
        val documentSegments = document.rawPath.split('/').filter(String::isNotBlank)
        val treeIndex = treeSegments.indexOf("tree")
        treeIndex >= 0 && treeSegments.getOrNull(treeIndex + 1) != null &&
            documentSegments.getOrNull(treeIndex) == "tree" &&
            documentSegments.getOrNull(treeIndex + 1) == treeSegments[treeIndex + 1] &&
            "document" in documentSegments
    }
} catch (_: Exception) {
    false
}

internal object SafDocuments {
    private val mapper = ObjectMapper()

    fun export(context: Context, instructionJson: String): SafOperationResult = try {
        val instruction = mapper.readValue(instructionJson, SafExportInstruction::class.java)
        require(validSafRelativePath(instruction.relativePath)) {
            "The persisted SAF relative path is invalid"
        }
        val treeUri = Uri.parse(instruction.treeUri)
        require(treeUri.scheme == "content") { "The SAF destination is not a content URI" }
        require(hasPersistedWritePermission(context, treeUri)) {
            "Write permission for the SAF destination is no longer available"
        }
        val tree = DocumentFile.fromTreeUri(context, treeUri)
            ?: error("The SAF document tree is unavailable")
        require(tree.exists() && tree.isDirectory) { "The SAF destination no longer exists" }

        val staging = File(instruction.stagingPath)
        require(staging.exists()) { "The completed staging file no longer exists" }
        require(staging.isDirectory == instruction.isDirectory) {
            "The staging file type does not match the download task"
        }
        require(!Files.isSymbolicLink(staging.toPath())) { "Symbolic links cannot be exported" }

        val components = instruction.relativePath.split('/')
        val parent = components.dropLast(1).fold(tree) { directory, component ->
            requireDirectory(directory, component)
        }
        val exported = if (instruction.isDirectory) {
            val destination = requireDirectory(parent, components.last())
            copyDirectory(context, staging, destination)
            destination
        } else {
            copyFile(context, staging, parent, components.last())
        }
        SafOperationResult(value = exported.uri.toString())
    } catch (error: Exception) {
        SafOperationResult(error = error.message ?: error.javaClass.simpleName)
    }

    fun deleteExported(
        context: Context,
        treeUriValue: String,
        documentUriValue: String,
    ): SafOperationResult = try {
        val treeUri = Uri.parse(treeUriValue)
        val documentUri = Uri.parse(documentUriValue)
        require(treeUri.scheme == "content" && documentUri.scheme == "content") {
            "SAF deletion requires content URIs"
        }
        require(validSafDocumentBinding(treeUriValue, documentUriValue)) {
            "The exported document is outside its registered tree"
        }
        require(hasPersistedWritePermission(context, treeUri)) {
            "Write permission for the SAF destination is no longer available"
        }
        val rootDocumentUri = DocumentsContract.buildDocumentUriUsingTree(
            treeUri,
            DocumentsContract.getTreeDocumentId(treeUri),
        )
        require(documentUri != treeUri && documentUri != rootDocumentUri) {
            "The registered document tree cannot be deleted"
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            require(
                DocumentsContract.isChildDocument(
                    context.contentResolver,
                    rootDocumentUri,
                    documentUri,
                )
            ) {
                "The document provider reports that the export is outside its registered tree"
            }
        }
        val document = DocumentFile.fromSingleUri(context, documentUri)
            ?: error("The exported document URI is invalid")
        if (document.exists() && !document.delete()) {
            error("The document provider refused to delete the exported download")
        }
        SafOperationResult(value = documentUriValue)
    } catch (error: Exception) {
        SafOperationResult(error = error.message ?: error.javaClass.simpleName)
    }

    private fun hasPersistedWritePermission(context: Context, treeUri: Uri): Boolean =
        context.contentResolver.persistedUriPermissions.any { permission ->
            permission.uri == treeUri && permission.isWritePermission
        }

    private fun requireDirectory(parent: DocumentFile, name: String): DocumentFile {
        val existing = parent.findFile(name)
        if (existing != null) {
            require(existing.isDirectory) { "A file blocks the SAF directory path: $name" }
            return existing
        }
        return parent.createDirectory(name) ?: error("Could not create SAF directory: $name")
    }

    private fun copyDirectory(context: Context, source: File, destination: DocumentFile) {
        source.listFiles()?.forEach { child ->
            require(!Files.isSymbolicLink(child.toPath())) { "Symbolic links cannot be exported" }
            require(child.name.isNotBlank() && child.name != "." && child.name != "..") {
                "The staging directory contains an invalid name"
            }
            if (child.isDirectory) {
                copyDirectory(context, child, requireDirectory(destination, child.name))
            } else {
                copyFile(context, child, destination, child.name)
            }
        } ?: error("Could not enumerate the staging directory")
    }

    private fun copyFile(
        context: Context,
        source: File,
        parent: DocumentFile,
        name: String,
    ): DocumentFile {
        val existing = parent.findFile(name)
        require(existing?.isDirectory != true) { "A directory blocks the SAF file path: $name" }
        val mimeType = URLConnection.guessContentTypeFromName(name) ?: "application/octet-stream"
        val destination = existing ?: parent.createFile(mimeType, name)
            ?: error("Could not create SAF file: $name")
        val output = context.contentResolver.openOutputStream(destination.uri, "wt")
            ?: error("Could not open the SAF file for writing: $name")
        source.inputStream().buffered().use { input ->
            output.buffered().use { target -> input.copyTo(target, DEFAULT_BUFFER_SIZE * 16) }
        }
        return destination
    }
}
