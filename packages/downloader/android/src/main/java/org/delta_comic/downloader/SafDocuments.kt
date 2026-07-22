package org.delta_comic.downloader

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
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

internal data class SafDirectInstruction(
    val treeUri: String = "",
    val relativePath: String = "",
    val expectedLength: Long? = null,
    val temporaryName: String = "",
    val temporaryDocumentUri: String? = null,
    val readyToCommit: Boolean = false,
)

internal sealed interface SafDirectOpenResult {
    data class Ready(val fileDescriptor: Int, val documentUri: String) : SafDirectOpenResult
    data class Fallback(val documentUri: String?) : SafDirectOpenResult
}

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

    fun parseDirectInstruction(instructionJson: String): SafDirectInstruction? = try {
        mapper.readValue(instructionJson, SafDirectInstruction::class.java)
    } catch (_: Exception) {
        null
    }

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

    fun openDirect(context: Context, instructionJson: String): SafDirectOpenResult {
        var openedDocumentUri: String? = null
        return try {
            val instruction = mapper.readValue(instructionJson, SafDirectInstruction::class.java)
            require(!instruction.readyToCommit) { "A completed SAF transfer must be committed" }
            require(validSafRelativePath(instruction.relativePath)) {
                "The persisted SAF relative path is invalid"
            }
            require(
                instruction.temporaryName.isNotBlank() &&
                    '/' !in instruction.temporaryName && '\\' !in instruction.temporaryName &&
                    instruction.temporaryName != "." && instruction.temporaryName != ".."
            ) { "The SAF temporary file name is invalid" }
            val treeUri = requireWritableTree(context, instruction.treeUri)
            val tree = requireTree(context, treeUri)
            val components = instruction.relativePath.split('/')
            val parent = components.dropLast(1).fold(tree) { directory, component ->
                requireDirectory(directory, component)
            }
            val document = instruction.temporaryDocumentUri?.let { value ->
                require(validSafDocumentBinding(instruction.treeUri, value)) {
                    "The SAF temporary document is outside its registered tree"
                }
                DocumentFile.fromSingleUri(context, Uri.parse(value))
                    ?.takeIf { it.exists() && it.isFile }
                    ?: error("The SAF temporary document no longer exists")
            } ?: run {
                val mimeType = URLConnection.guessContentTypeFromName(components.last())
                    ?: "application/octet-stream"
                parent.createFile(mimeType, instruction.temporaryName)
                    ?: error("Could not create a seekable SAF temporary file")
            }
            openedDocumentUri = document.uri.toString()
            val descriptor = context.contentResolver.openFileDescriptor(document.uri, "rw")
                ?: return SafDirectOpenResult.Fallback(openedDocumentUri)
            descriptor.use {
                try {
                    Os.lseek(it.fileDescriptor, 0, OsConstants.SEEK_CUR)
                } catch (_: ErrnoException) {
                    return SafDirectOpenResult.Fallback(openedDocumentUri)
                }
                SafDirectOpenResult.Ready(it.detachFd(), openedDocumentUri)
            }
        } catch (_: Exception) {
            SafDirectOpenResult.Fallback(openedDocumentUri)
        }
    }

    fun commitDirect(context: Context, instructionJson: String): SafOperationResult = try {
        val instruction = mapper.readValue(instructionJson, SafDirectInstruction::class.java)
        require(instruction.readyToCommit) { "The direct SAF transfer is not ready to commit" }
        require(validSafRelativePath(instruction.relativePath)) {
            "The persisted SAF relative path is invalid"
        }
        val temporaryUriValue = instruction.temporaryDocumentUri
            ?: error("The direct SAF temporary document is missing")
        require(validSafDocumentBinding(instruction.treeUri, temporaryUriValue)) {
            "The SAF temporary document is outside its registered tree"
        }
        val treeUri = requireWritableTree(context, instruction.treeUri)
        val tree = requireTree(context, treeUri)
        val temporaryUri = Uri.parse(temporaryUriValue)
        val components = instruction.relativePath.split('/')
        val parent = components.dropLast(1).fold(tree) { directory, component ->
            requireDirectory(directory, component)
        }
        val finalName = components.last()
        val temporary = DocumentFile.fromSingleUri(context, temporaryUri)
            ?.takeIf { it.exists() && it.isFile }
        if (temporary == null) {
            // The provider commit can succeed immediately before the process is
            // reclaimed. A ready marker makes discovering the final relative
            // path an idempotent recovery, not a reason to redownload.
            val committed = parent.findFile(finalName)
                ?.takeIf { it.exists() && it.isFile }
                ?: error("Neither the direct SAF temporary nor final document exists")
            requireExpectedLength(context, committed, instruction.expectedLength)
            SafOperationResult(value = committed.uri.toString())
        } else {
            requireExpectedLength(context, temporary, instruction.expectedLength)
            val existing = parent.findFile(finalName)
            require(existing?.isDirectory != true) {
                "A directory blocks the SAF file path: $finalName"
            }
            if (existing != null && existing.uri != temporaryUri && !existing.delete()) {
                error("The existing SAF destination could not be replaced")
            }

            val renamed = try {
                DocumentsContract.renameDocument(context.contentResolver, temporaryUri, finalName)
            } catch (_: UnsupportedOperationException) {
                null
            }
            if (renamed != null) {
                require(validSafDocumentBinding(instruction.treeUri, renamed.toString())) {
                    "The renamed SAF document escaped its registered tree"
                }
                SafOperationResult(value = renamed.toString())
            } else {
                val destination = parent.findFile(finalName)
                    ?: parent.createFile(
                        URLConnection.guessContentTypeFromName(finalName)
                            ?: "application/octet-stream",
                        finalName,
                    )
                    ?: error("Could not create the final SAF document")
                if (destination.uri == temporary.uri) {
                    SafOperationResult(value = destination.uri.toString())
                } else {
                    copyDocument(context, temporary.uri, destination.uri)
                    if (!temporary.delete()) {
                        error("The committed SAF temporary document could not be removed")
                    }
                    SafOperationResult(value = destination.uri.toString())
                }
            }
        }
    } catch (error: Exception) {
        SafOperationResult(error = error.message ?: error.javaClass.simpleName)
    }

    fun discardDirect(
        context: Context,
        instructionJson: String,
        documentUriValue: String,
    ): SafOperationResult = try {
        val instruction = mapper.readValue(instructionJson, SafDirectInstruction::class.java)
        require(validSafDocumentBinding(instruction.treeUri, documentUriValue)) {
            "The SAF temporary document is outside its registered tree"
        }
        requireWritableTree(context, instruction.treeUri)
        val document = DocumentFile.fromSingleUri(context, Uri.parse(documentUriValue))
            ?: error("The SAF temporary document URI is invalid")
        if (document.exists() && !document.delete()) {
            error("The SAF temporary document could not be removed")
        }
        SafOperationResult(value = documentUriValue)
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

    private fun requireWritableTree(context: Context, treeUriValue: String): Uri {
        val treeUri = Uri.parse(treeUriValue)
        require(treeUri.scheme == "content") { "The SAF destination is not a content URI" }
        require(hasPersistedWritePermission(context, treeUri)) {
            "Write permission for the SAF destination is no longer available"
        }
        return treeUri
    }

    private fun requireTree(context: Context, treeUri: Uri): DocumentFile {
        val tree = DocumentFile.fromTreeUri(context, treeUri)
            ?: error("The SAF document tree is unavailable")
        require(tree.exists() && tree.isDirectory) { "The SAF destination no longer exists" }
        return tree
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

    private fun copyDocument(context: Context, source: Uri, destination: Uri) {
        val input = context.contentResolver.openInputStream(source)
            ?: error("Could not read the direct SAF temporary document")
        val output = context.contentResolver.openOutputStream(destination, "wt")
            ?: error("Could not write the final SAF document")
        input.buffered().use { from ->
            output.buffered().use { target -> from.copyTo(target, DEFAULT_BUFFER_SIZE * 16) }
        }
    }

    private fun requireExpectedLength(
        context: Context,
        document: DocumentFile,
        expectedLength: Long?,
    ) {
        if (expectedLength != null) {
            val actualLength = context.contentResolver
                .openFileDescriptor(document.uri, "r")
                ?.use { it.statSize }
                ?: -1L
            require(expectedLength >= 0 && actualLength == expectedLength) {
                "The direct SAF document length no longer matches the completed download"
            }
        }
    }
}
