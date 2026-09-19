package ai.money.mentor.backend.auth;

import java.io.IOException;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import ai.money.mentor.backend.auth.AuthService.Account;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Turns the session cookie into the profile id the rest of the app already works with.
 *
 * <p>Every module reads {@code X-Profile-Id}. When a request is signed in, this filter rewrites
 * that header from the session, so a browser can no longer ask for somebody else's profile by
 * editing the header. Without a session the header is left alone — that is guest mode, which
 * keeps the offline demo working; set {@code mentor.auth.required=true} (as a deployment would)
 * and guest mode is refused instead.
 */
@Component
public class AuthFilter extends OncePerRequestFilter {

    public static final String COOKIE = "fm_session";
    public static final String PROFILE_HEADER = "X-Profile-Id";
    private static final String ACCOUNT_ATTRIBUTE = "mentor.account";

    private final AuthService auth;
    private final boolean authRequired;

    public AuthFilter(AuthService auth, @Value("${mentor.auth.required:false}") boolean authRequired) {
        this.auth = auth;
        this.authRequired = authRequired;
    }

    /** The signed-in account for this request, or empty in guest mode. */
    public static Optional<Account> account(HttpServletRequest request) {
        return Optional.ofNullable((Account) request.getAttribute(ACCOUNT_ATTRIBUTE));
    }

    public boolean isAuthRequired() {
        return authRequired;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<Account> account = auth.authenticate(token(request));
        HttpServletRequest effective = request;
        if (account.isPresent()) {
            request.setAttribute(ACCOUNT_ATTRIBUTE, account.get());
            effective = withProfileHeader(request, account.get().profileId());
        } else if (authRequired && isProtected(request)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Please sign in to continue.\"}");
            return;
        }
        chain.doFilter(effective, response);
    }

    /** Sign-in itself and the status pill stay open; everything else under /api needs a session. */
    private static boolean isProtected(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/") && !path.startsWith("/api/auth/") && !path.equals("/api/system/status");
    }

    private static String token(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private static HttpServletRequest withProfileHeader(HttpServletRequest request, String profileId) {
        return new HttpServletRequestWrapper(request) {
            @Override
            public String getHeader(String name) {
                return PROFILE_HEADER.equalsIgnoreCase(name) ? profileId : super.getHeader(name);
            }

            @Override
            public java.util.Enumeration<String> getHeaders(String name) {
                return PROFILE_HEADER.equalsIgnoreCase(name)
                        ? java.util.Collections.enumeration(java.util.List.of(profileId))
                        : super.getHeaders(name);
            }
        };
    }
}
