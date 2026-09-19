package ai.money.mentor.backend.auth;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ai.money.mentor.backend.memory.MemoryService;

/**
 * Accounts and sessions. One account owns one profile; everything else in the app keys off the
 * profile id, so signing in simply decides which profile id a request is allowed to use.
 *
 * <p>Session tokens are random 256-bit values kept server-side as SHA-256 hashes, which means a
 * stolen database still cannot be used to log in, and a session can be revoked the moment the
 * user signs out.
 */
@Service
public class AuthService {

    /** How long a session lives at most, and how long it may sit idle. */
    static final Duration ABSOLUTE_LIFETIME = Duration.ofDays(7);
    static final Duration IDLE_TIMEOUT = Duration.ofHours(12);
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCKOUT = Duration.ofMinutes(15);

    public record Account(String id, String username, String profileId) {
    }

    /** Thrown for every sign-in problem; the message is safe to show a user. */
    public static class AuthException extends RuntimeException {
        public AuthException(String message) {
            super(message);
        }
    }

    private final JdbcClient jdbc;
    private final MemoryService memory;
    private final PasswordHasher hasher;
    private final SecureRandom random = new SecureRandom();

    public AuthService(JdbcClient jdbc, MemoryService memory, PasswordHasher hasher) {
        this.jdbc = jdbc;
        this.memory = memory;
        this.hasher = hasher;
    }

    // ── registration ────────────────────────────────────────────────

    /**
     * Creates an account. If {@code adoptProfileId} names a profile nobody owns (the guest
     * profile from this browser), the account takes it over so nothing entered is lost.
     */
    @Transactional
    public Account register(String rawUsername, char[] passphrase, String adoptProfileId) {
        String username = normalise(rawUsername);
        validateUsername(username);
        validatePassphrase(username, passphrase);
        if (findByUsername(username).isPresent()) throw new AuthException("That username is taken");

        String profileId = adoptable(adoptProfileId) ? adoptProfileId : memory.createProfile(Map.of("name", rawUsername.trim()));
        String id = UUID.randomUUID().toString();
        jdbc.sql("INSERT INTO user_account(id, username, profile_id, password_hash, created_at) VALUES (?,?,?,?,?)")
                .params(id, username, profileId, hasher.hash(passphrase), Instant.now().toString())
                .update();
        return new Account(id, username, profileId);
    }

    // ── sign in / out ───────────────────────────────────────────────

    /**
     * Verifies the passphrase and returns the session token to put in the cookie.
     *
     * <p>{@code noRollbackFor} matters: a wrong passphrase throws, and without this the failed
     * attempt we just recorded would be rolled back with it — the lockout would never trigger.
     */
    @Transactional(noRollbackFor = AuthException.class)
    public String login(String rawUsername, char[] passphrase) {
        String username = normalise(rawUsername);
        var row = jdbc.sql("SELECT id, username, profile_id, password_hash, failed_attempts, locked_until FROM user_account WHERE username = ?")
                .param(username)
                .query((rs, n) -> Map.<String, Object>of(
                        "id", rs.getString("id"),
                        "password_hash", rs.getString("password_hash"),
                        "failed_attempts", rs.getInt("failed_attempts"),
                        "locked_until", Optional.ofNullable(rs.getString("locked_until")).orElse("")))
                .optional();
        if (row.isEmpty()) {
            // Hash anyway so a missing username takes as long as a wrong passphrase.
            hasher.matches(passphrase, hasher.hash("decoy-passphrase".toCharArray()));
            throw new AuthException("Wrong username or passphrase");
        }
        Map<String, Object> a = row.get();
        String lockedUntil = (String) a.get("locked_until");
        if (!lockedUntil.isBlank() && Instant.parse(lockedUntil).isAfter(Instant.now())) {
            throw new AuthException("Too many attempts. Try again in a few minutes.");
        }
        String id = (String) a.get("id");
        String storedHash = (String) a.get("password_hash");
        if (!hasher.matches(passphrase, storedHash)) {
            recordFailure(id, ((Number) a.get("failed_attempts")).intValue() + 1);
            throw new AuthException("Wrong username or passphrase");
        }
        if (hasher.needsUpgrade(storedHash)) {
            jdbc.sql("UPDATE user_account SET password_hash = ? WHERE id = ?").params(hasher.hash(passphrase), id).update();
        }
        jdbc.sql("UPDATE user_account SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?")
                .params(Instant.now().toString(), id).update();
        return startSession(id);
    }

    public void logout(String token) {
        if (token != null) jdbc.sql("DELETE FROM auth_session WHERE token_hash = ?").param(sha256(token)).update();
    }

    /** Signs every device out — used before the account itself is deleted. */
    public void logoutEverywhere(String accountId) {
        jdbc.sql("DELETE FROM auth_session WHERE account_id = ?").param(accountId).update();
    }

    // ── session lookup (called on every request) ────────────────────

    /** The account behind a cookie, or empty when the token is unknown, idle or expired. */
    public Optional<Account> authenticate(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        var row = jdbc.sql("""
                SELECT s.token_hash, s.last_seen_at, s.expires_at, a.id, a.username, a.profile_id
                FROM auth_session s JOIN user_account a ON a.id = s.account_id WHERE s.token_hash = ?""")
                .param(sha256(token))
                .query((rs, n) -> Map.<String, Object>of(
                        "token_hash", rs.getString("token_hash"),
                        "last_seen_at", rs.getString("last_seen_at"),
                        "expires_at", rs.getString("expires_at"),
                        "id", rs.getString("id"),
                        "username", rs.getString("username"),
                        "profile_id", rs.getString("profile_id")))
                .optional();
        if (row.isEmpty()) return Optional.empty();
        Map<String, Object> s = row.get();
        Instant now = Instant.now();
        boolean expired = Instant.parse((String) s.get("expires_at")).isBefore(now);
        boolean idle = Instant.parse((String) s.get("last_seen_at")).plus(IDLE_TIMEOUT).isBefore(now);
        if (expired || idle) {
            jdbc.sql("DELETE FROM auth_session WHERE token_hash = ?").param((String) s.get("token_hash")).update();
            return Optional.empty();
        }
        jdbc.sql("UPDATE auth_session SET last_seen_at = ? WHERE token_hash = ?")
                .params(now.toString(), (String) s.get("token_hash")).update();
        return Optional.of(new Account((String) s.get("id"), (String) s.get("username"), (String) s.get("profile_id")));
    }

    public Optional<Account> findByProfile(String profileId) {
        return jdbc.sql("SELECT id, username, profile_id FROM user_account WHERE profile_id = ?")
                .param(profileId).query(ACCOUNT_MAPPER).optional();
    }

    public Optional<Account> findByUsername(String username) {
        return jdbc.sql("SELECT id, username, profile_id FROM user_account WHERE username = ?")
                .param(normalise(username)).query(ACCOUNT_MAPPER).optional();
    }

    public int accountCount() {
        return jdbc.sql("SELECT COUNT(*) FROM user_account").query(Integer.class).single();
    }

    /** Drops sessions that are past their absolute lifetime; called on startup. */
    public int purgeExpiredSessions() {
        return jdbc.sql("DELETE FROM auth_session WHERE expires_at < ?").param(Instant.now().toString()).update();
    }

    // ── internals ───────────────────────────────────────────────────

    private String startSession(String accountId) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant now = Instant.now();
        jdbc.sql("INSERT INTO auth_session(token_hash, account_id, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?)")
                .params(sha256(token), accountId, now.toString(), now.toString(), now.plus(ABSOLUTE_LIFETIME).toString())
                .update();
        return token;
    }

    private void recordFailure(String accountId, int attempts) {
        String lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? Instant.now().plus(LOCKOUT).toString() : null;
        int reset = attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts;
        jdbc.sql("UPDATE user_account SET failed_attempts = ?, locked_until = ? WHERE id = ?")
                .params(reset, lockedUntil, accountId).update();
    }

    private boolean adoptable(String profileId) {
        return profileId != null && !profileId.isBlank()
                && memory.profile(profileId).isPresent()
                && findByProfile(profileId).isEmpty();
    }

    private static final org.springframework.jdbc.core.RowMapper<Account> ACCOUNT_MAPPER =
            (rs, n) -> new Account(rs.getString("id"), rs.getString("username"), rs.getString("profile_id"));

    static String normalise(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    static void validateUsername(String username) {
        if (!username.matches("[a-z0-9._-]{3,32}")) {
            throw new AuthException("Username: 3–32 characters, letters, digits, dot, dash or underscore");
        }
    }

    static void validatePassphrase(String username, char[] passphrase) {
        if (passphrase == null || passphrase.length < PasswordHasher.MIN_LENGTH) {
            throw new AuthException("Passphrase must be at least " + PasswordHasher.MIN_LENGTH + " characters");
        }
        String value = new String(passphrase).toLowerCase(Locale.ROOT);
        if (value.contains(username) || value.contains("password") || value.contains("finmind")) {
            throw new AuthException("Pick a passphrase that isn't based on your username or the app's name");
        }
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
