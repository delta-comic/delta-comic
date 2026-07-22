package org.deltacomic.downloader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SafDirectContractTest {
    @Test
    fun parsesTransferAndCommitInstructionsWithoutRendererPaths() {
        val transfer = SafDocuments.parseDirectInstruction(
            """{
                "treeUri":"content://provider/tree/root",
                "relativePath":"Comic/chapter.cbz",
                "expectedLength":1024,
                "temporaryName":".delta-task.part",
                "temporaryDocumentUri":null,
                "readyToCommit":false
            }"""
        )
        requireNotNull(transfer)
        assertEquals("Comic/chapter.cbz", transfer.relativePath)
        assertEquals(1024L, transfer.expectedLength)
        assertEquals(".delta-task.part", transfer.temporaryName)
        assertNull(transfer.temporaryDocumentUri)
        assertFalse(transfer.readyToCommit)

        val commit = SafDocuments.parseDirectInstruction(
            """{
                "treeUri":"content://provider/tree/root",
                "relativePath":"Comic/chapter.cbz",
                "expectedLength":1024,
                "temporaryName":".delta-task.part",
                "temporaryDocumentUri":"content://provider/tree/root/document/partial",
                "readyToCommit":true
            }"""
        )
        requireNotNull(commit)
        assertTrue(commit.readyToCommit)
        assertEquals(
            "content://provider/tree/root/document/partial",
            commit.temporaryDocumentUri
        )
    }

    @Test
    fun rejectsMalformedDirectInstructionsAndCrossTreeDocuments() {
        assertNull(SafDocuments.parseDirectInstruction("not-json"))
        assertTrue(
            validSafDocumentBinding(
                "content://provider/tree/root",
                "content://provider/tree/root/document/root%2Fpartial"
            )
        )
        assertFalse(
            validSafDocumentBinding(
                "content://provider/tree/root",
                "content://provider/tree/other/document/other%2Fpartial"
            )
        )
    }
}
