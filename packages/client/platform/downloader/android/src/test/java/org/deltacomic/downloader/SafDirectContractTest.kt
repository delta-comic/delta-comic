package org.deltacomic.downloader

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SafDirectContractTest {
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
