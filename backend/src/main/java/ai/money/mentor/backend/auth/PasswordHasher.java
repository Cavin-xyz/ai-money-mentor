package ai.money.mentor.backend.auth;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.springframework.stereotype.Component;

/**
 * Passphrase hashing with PBKDF2-HMAC-SHA256 — part of the JDK, so the app needs no extra
 * dependency and still works on a laptop that has never been online.
 *
 * <p>Stored form: {@code pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>}. The algorithm and
 * cost live in the string, so the cost can be raised later and old hashes still verify
 * (and can be re-hashed on the next successful login).
 */
@Component
public class PasswordHasher {

    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final String PREFIX = "pbkdf2-sha256";
    /** OWASP's current floor for PBKDF2-HMAC-SHA256 (~0.3 s on this laptop). */
    static final int ITERATIONS = 310_000;
    private static final int SALT_BYTES = 16;
    private static final int KEY_BITS = 256;
    /** NIST SP 800-63B: length is what matters; no forced symbol/case rules. */
    public static final int MIN_LENGTH = 10;

    private final SecureRandom random = new SecureRandom();

    public String hash(char[] passphrase) {
        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        byte[] key = derive(passphrase, salt, ITERATIONS);
        var b64 = Base64.getEncoder().withoutPadding();
        return PREFIX + "$" + ITERATIONS + "$" + b64.encodeToString(salt) + "$" + b64.encodeToString(key);
    }

    /** Constant-time comparison; false for any malformed or unknown-algorithm hash. */
    public boolean matches(char[] passphrase, String stored) {
        if (stored == null) return false;
        String[] parts = stored.split("\\$");
        if (parts.length != 4 || !PREFIX.equals(parts[0])) return false;
        try {
            int iterations = Integer.parseInt(parts[1]);
            var b64 = Base64.getDecoder();
            byte[] salt = b64.decode(parts[2]);
            byte[] expected = b64.decode(parts[3]);
            byte[] actual = derive(passphrase, salt, iterations);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /** True when the hash was made with a weaker cost than we use now, so it should be re-hashed. */
    public boolean needsUpgrade(String stored) {
        String[] parts = stored == null ? new String[0] : stored.split("\\$");
        if (parts.length != 4 || !PREFIX.equals(parts[0])) return true;
        try {
            return Integer.parseInt(parts[1]) < ITERATIONS;
        } catch (NumberFormatException e) {
            return true;
        }
    }

    private static byte[] derive(char[] passphrase, byte[] salt, int iterations) {
        var spec = new PBEKeySpec(passphrase, salt, iterations, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            throw new IllegalStateException("PBKDF2 unavailable", e);
        } finally {
            spec.clearPassword();
        }
    }
}
