import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  ArrowRight,
  Eye,
  EyeOff,
  Landmark,
} from 'lucide-react';

import { useVolunteerAuth } from '../../hooks/useVolunteerAuth';

export default function VolunteerLoginPage() {
  const {
    login,
    isLoggedIn,
    loading,
    error,
  } = useVolunteerAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath =
    location.state?.from?.pathname ||
    '/volunteer';

  const successMessage =
    location.state?.message || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');
  const [showPassword, setShowPassword] =
    useState(false);

  const [emailError, setEmailError] =
    useState('');
  const [passwordError, setPasswordError] =
    useState('');

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectPath, {
        replace: true,
      });
    }
  }, [
    isLoggedIn,
    navigate,
    redirectPath,
  ]);

  const getEmailError = (value) => {
    const cleanEmail = value.trim();

    if (!cleanEmail) {
      return 'Email is required.';
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      return 'Enter a valid email address.';
    }

    return '';
  };

  const getPasswordError = (value) => {
    if (!value) {
      return 'Password is required.';
    }

    if (value.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return '';
  };

  const handleEmailChange = (event) => {
    const value = event.target.value;

    setEmail(value);

    if (emailError) {
      setEmailError(getEmailError(value));
    }
  };

  const handlePasswordChange = (event) => {
    const value = event.target.value;

    setPassword(value);

    if (passwordError) {
      setPasswordError(
        getPasswordError(value)
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextEmailError =
      getEmailError(email);

    const nextPasswordError =
      getPasswordError(password);

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (
      nextEmailError ||
      nextPasswordError
    ) {
      return;
    }

    const loggedIn = await login(
      email.trim(),
      password
    );

    if (loggedIn) {
      navigate(redirectPath, {
        replace: true,
      });
    }
  };

  return (
    <main style={styles.page}>
      <BackgroundDecoration />

      <div style={styles.backWrapper}>
        <Link
          to="/"
          style={styles.backLink}
        >
          &larr; Back to Home
        </Link>
      </div>

      <section style={styles.card}>
        <header style={styles.header}>
          <div style={styles.logoBox}>
            <Landmark size={31} />
          </div>

          <h1 style={styles.brandName}>
            BharatMandir
          </h1>

          <p style={styles.portalLabel}>
            VOLUNTEER PORTAL
          </p>

          <p style={styles.description}>
            Sign in and help document sacred temples
          </p>
        </header>

        {successMessage && (
          <div
            role="status"
            style={styles.successBox}
          >
            {successMessage}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={styles.errorBox}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
        >
          <div style={styles.fieldGroup}>
            <label
              htmlFor="volunteer-email"
              style={styles.label}
            >
              Email Address
            </label>

            <input
              id="volunteer-email"
              name="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={(event) =>
                setEmailError(
                  getEmailError(
                    event.target.value
                  )
                )
              }
              placeholder="volunteer@example.com"
              autoComplete="email"
              aria-invalid={Boolean(emailError)}
              style={{
                ...styles.input,
                borderColor: emailError
                  ? 'rgba(255, 80, 80, 0.65)'
                  : 'rgba(255, 153, 0, 0.2)',
              }}
            />

            {emailError && (
              <p style={styles.fieldError}>
                {emailError}
              </p>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <label
              htmlFor="volunteer-password"
              style={styles.label}
            >
              Password
            </label>

            <div style={styles.passwordWrapper}>
              <input
                id="volunteer-password"
                name="password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={handlePasswordChange}
                onBlur={(event) =>
                  setPasswordError(
                    getPasswordError(
                      event.target.value
                    )
                  )
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-invalid={Boolean(
                  passwordError
                )}
                style={{
                  ...styles.input,
                  paddingRight: 50,
                  borderColor: passwordError
                    ? 'rgba(255, 80, 80, 0.65)'
                    : 'rgba(255, 153, 0, 0.2)',
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            {passwordError && (
              <p style={styles.fieldError}>
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              ...(loading
                ? styles.disabledButton
                : {}),
            }}
          >
            {loading ? (
              'Signing In...'
            ) : (
              <>
                Volunteer Sign In
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <p style={styles.signupText}>
          New volunteer?{' '}
          <Link
            to="/volunteer/signup"
            style={styles.primaryLink}
          >
            Create account
          </Link>
        </p>

        <div style={styles.userPortalSection}>
          <Link
            to="/login"
            style={styles.userPortalLink}
          >
            Go to User Portal &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}

function BackgroundDecoration() {
  const circles = [
    {
      left: '10%',
      top: '20%',
    },
    {
      left: '80%',
      top: '70%',
    },
    {
      left: '50%',
      top: '90%',
    },
  ];

  return (
    <div style={styles.backgroundDecoration}>
      {circles.map((circle, index) => (
        <div
          key={index}
          style={{
            ...styles.backgroundCircle,
            left: circle.left,
            top: circle.top,
          }}
        />
      ))}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
    background:
      'linear-gradient(135deg, #1A0A00 0%, #3D1F00 50%, #1A0A00 100%)',
    fontFamily: "'Segoe UI', sans-serif",
  },

  backWrapper: {
    width: '100%',
    maxWidth: 420,
    position: 'relative',
    zIndex: 1,
    marginBottom: 12,
  },

  backLink: {
    display: 'inline-flex',
    padding: '7px 14px',
    background:
      'rgba(255, 255, 255, 0.07)',
    border:
      '1px solid rgba(255, 153, 0, 0.2)',
    borderRadius: 50,
    color:
      'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 1,
    padding: '40px 36px',
    background:
      'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    border:
      '1px solid rgba(255, 153, 0, 0.2)',
    borderRadius: 20,
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.5)',
  },

  header: {
    marginBottom: 28,
    textAlign: 'center',
  },

  logoBox: {
    width: 58,
    height: 58,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto',
    background:
      'rgba(255, 153, 0, 0.12)',
    border:
      '1px solid rgba(255, 153, 0, 0.28)',
    borderRadius: '50%',
    color: '#FF9900',
  },

  brandName: {
    margin: '10px 0 0',
    color:
      'rgba(255, 255, 255, 0.92)',
    fontFamily: 'Georgia, serif',
    fontSize: 25,
  },

  portalLabel: {
    margin: '6px 0 0',
    color: '#FF9900',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
  },

  description: {
    margin: '7px 0 0',
    color:
      'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },

  fieldGroup: {
    marginBottom: 16,
  },

  label: {
    display: 'block',
    marginBottom: 6,
    color:
      'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    background:
      'rgba(255, 255, 255, 0.06)',
    border: '1px solid',
    borderRadius: 10,
    color:
      'rgba(255, 255, 255, 0.92)',
    caretColor: '#FF9900',
    fontSize: 14,
    outlineColor: '#FF9900',
  },

  passwordWrapper: {
    position: 'relative',
  },

  eyeButton: {
    position: 'absolute',
    top: '50%',
    right: 12,
    display: 'grid',
    placeItems: 'center',
    padding: 2,
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 0,
    color: '#FFB84D',
    cursor: 'pointer',
  },

  fieldError: {
    margin: '6px 0 0',
    color: '#FF9090',
    fontSize: 12,
  },

  submitButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    padding: 14,
    background:
      'linear-gradient(135deg, #FF9900, #E68A00)',
    border: 0,
    borderRadius: 12,
    color: '#1A0A00',
    boxShadow:
      '0 4px 20px rgba(255, 153, 0, 0.25)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },

  disabledButton: {
    background:
      'rgba(255, 153, 0, 0.45)',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },

  successBox: {
    marginBottom: 20,
    padding: '12px 16px',
    background:
      'rgba(85, 190, 110, 0.12)',
    border:
      '1px solid rgba(85, 190, 110, 0.3)',
    borderRadius: 10,
    color: '#AEF0BC',
    fontSize: 13,
  },

  errorBox: {
    marginBottom: 20,
    padding: '12px 16px',
    background:
      'rgba(255, 80, 80, 0.12)',
    border:
      '1px solid rgba(255, 80, 80, 0.3)',
    borderRadius: 10,
    color: '#FFAAAA',
    fontSize: 13,
  },

  signupText: {
    marginTop: 22,
    color:
      'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 13,
  },

  primaryLink: {
    color: '#FF9900',
    fontWeight: 700,
    textDecoration: 'none',
  },

  userPortalSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTop:
      '1px solid rgba(255, 153, 0, 0.1)',
    textAlign: 'center',
  },

  userPortalLink: {
    color:
      'rgba(255, 255, 255, 0.38)',
    fontSize: 11,
    textDecoration: 'none',
  },

  backgroundDecoration: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },

  backgroundCircle: {
    width: 300,
    height: 300,
    position: 'absolute',
    background:
      'rgba(255, 153, 0, 0.04)',
    borderRadius: '50%',
    transform:
      'translate(-50%, -50%)',
  },
};