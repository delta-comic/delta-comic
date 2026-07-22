package org.delta_comic.downloader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CredentialBootstrapTest {
    @Test
    fun initializesCredentialContextBeforeBootstrappingEngine() {
        val calls = mutableListOf<String>()

        val initialized = initializeNativeEngine(
            initializeCredentialContext = {
                calls += "credentials"
                0
            },
            bootstrap = {
                calls += "engine"
                0
            },
        )

        assertTrue(initialized)
        assertEquals(listOf("credentials", "engine"), calls)
    }

    @Test
    fun doesNotBootstrapWhenCredentialContextFails() {
        var bootstrapCalls = 0

        val initialized = initializeNativeEngine(
            initializeCredentialContext = { 1 },
            bootstrap = {
                bootstrapCalls += 1
                0
            },
        )

        assertFalse(initialized)
        assertEquals(0, bootstrapCalls)
    }

    @Test
    fun reportsEngineBootstrapFailure() {
        assertFalse(initializeNativeEngine({ 0 }, { 1 }))
    }
}
