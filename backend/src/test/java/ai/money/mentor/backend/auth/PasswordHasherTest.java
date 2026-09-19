package ai.money.mentor.backend.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import ai.money.mentor.backend.auth.AuthService.AuthException;

/** The parts of sign-in that need no database: hashing, verification and the passphrase rules. */
class PasswordHasherTest {

    private final PasswordHasher hasher = new PasswordHasher();

    @Test
    void acceptsTheRightPassphraseAndRejectsEverythingElse() {
        String stored = hasher.hash("correct horse battery".toCharArray());
        assertTrue(hasher.matches("correct horse battery".toCharArray(), stored));
        assertFalse(hasher.matches("correct horse batterY".toCharArray(), stored));
        assertFalse(hasher.matches("".toCharArray(), stored));
    }

    @Test
    void storesAlgorithmAndCostButNeverThePassphrase() {
        String stored = hasher.hash("correct horse battery".toCharArray());
        String[] parts = stored.split("\\$");
        assertEquals(4, parts.length);
        assertEquals("pbkdf2-sha256", parts[0]);
        assertEquals(String.valueOf(PasswordHasher.ITERATIONS), parts[1]);
        assertFalse(stored.contains("correct"), "the passphrase must not appear in the stored hash");
    }

    @Test
    void saltsEachHashSoTwoUsersWithTheSamePassphraseDiffer() {
        assertNotEquals(hasher.hash("same passphrase here".toCharArray()), hasher.hash("same passphrase here".toCharArray()));
    }

    @Test
    void rejectsMalformedOrUnknownHashes() {
        assertFalse(hasher.matches("anything".toCharArray(), null));
        assertFalse(hasher.matches("anything".toCharArray(), "plaintext"));
        assertFalse(hasher.matches("anything".toCharArray(), "md5$1$a$b"));
        assertTrue(hasher.needsUpgrade("pbkdf2-sha256$1000$c2FsdA$aGFzaA"), "a weaker cost should be re-hashed");
    }

    @Test
    void passphraseRulesFollowLengthNotSymbols() {
        AuthService.validatePassphrase("asha", "a long enough passphrase".toCharArray());
        assertThrows(AuthException.class, () -> AuthService.validatePassphrase("asha", "short".toCharArray()));
        assertThrows(AuthException.class, () -> AuthService.validatePassphrase("asha", "asha12345678".toCharArray()));
        assertThrows(AuthException.class, () -> AuthService.validatePassphrase("asha", "myPassword123".toCharArray()));
    }

    @Test
    void usernamesAreNormalisedAndChecked() {
        assertEquals("asha.r", AuthService.normalise("  Asha.R "));
        AuthService.validateUsername("asha.r");
        assertThrows(AuthException.class, () -> AuthService.validateUsername("ab"));
        assertThrows(AuthException.class, () -> AuthService.validateUsername("asha r"));
        assertThrows(AuthException.class, () -> AuthService.validateUsername("asha@example.com"));
    }

    @Test
    void sessionTokensAreStoredOnlyAsAHash() {
        String token = "wf8Jq2-tokenlike-value";
        String hash = AuthService.sha256(token);
        assertNotEquals(token, hash);
        assertEquals(hash, AuthService.sha256(token), "the same token must always hash the same");
        assertNotEquals(hash, AuthService.sha256(token + "x"));
    }
}
