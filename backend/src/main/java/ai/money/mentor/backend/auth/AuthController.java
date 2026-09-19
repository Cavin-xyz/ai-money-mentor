package ai.money.mentor.backend.auth;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ai.money.mentor.backend.auth.AuthService.Account;
import ai.money.mentor.backend.engine.Inputs;
import jakarta.servlet.http.HttpServletRequest;

/** Register, sign in, sign out, and "who am I". The session token only ever travels in a cookie. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final AuthFilter filter;
    private final boolean secureCookie;

    public AuthController(AuthService auth, AuthFilter filter,
            @org.springframework.beans.factory.annotation.Value("${mentor.auth.secure-cookie:false}") boolean secureCookie) {
        this.auth = auth;
        this.filter = filter;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body,
            @RequestHeader(value = AuthFilter.PROFILE_HEADER, required = false) String guestProfileId) {
        char[] passphrase = chars(body);
        try {
            Account account = auth.register(Inputs.str(body, "username", ""), passphrase, guestProfileId);
            String token = auth.login(account.username(), passphrase);
            return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(token, AuthService.ABSOLUTE_LIFETIME.toSeconds()).toString())
                    .body(me(account));
        } finally {
            java.util.Arrays.fill(passphrase, '\0');
        }
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, Object> body) {
        char[] passphrase = chars(body);
        try {
            String username = Inputs.str(body, "username", "");
            String token = auth.login(username, passphrase);
            Account account = auth.findByUsername(username).orElseThrow();
            return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(token, AuthService.ABSOLUTE_LIFETIME.toSeconds()).toString())
                    .body(me(account));
        } finally {
            java.util.Arrays.fill(passphrase, '\0');
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
        auth.logout(cookieValue(request));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie("", 0).toString())
                .body(Map.of("authenticated", false, "authRequired", filter.isAuthRequired()));
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        return AuthFilter.account(request).map(this::me)
                .orElseGet(() -> Map.of("authenticated", false, "authRequired", filter.isAuthRequired()));
    }

    private Map<String, Object> me(Account account) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("authenticated", true);
        out.put("username", account.username());
        out.put("profileId", account.profileId());
        out.put("authRequired", filter.isAuthRequired());
        return out;
    }

    private static char[] chars(Map<String, Object> body) {
        Object value = body.get("passphrase");
        return value == null ? new char[0] : value.toString().toCharArray();
    }

    private static String cookieValue(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var c : request.getCookies()) {
            if (AuthFilter.COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    /**
     * HttpOnly so a script cannot read it, SameSite=Lax so another site cannot ride on it,
     * Secure once the app is served over HTTPS (it stays off for the local http demo).
     */
    private ResponseCookie cookie(String token, long maxAgeSeconds) {
        return ResponseCookie.from(AuthFilter.COOKIE, token)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAgeSeconds)
                .build();
    }
}
