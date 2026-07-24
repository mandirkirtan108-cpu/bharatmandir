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
  UserRound,
  UsersRound,
} from 'lucide-react';

import { useVolunteerAuth } from '../../hooks/useVolunteerAuth';

const SAFFRON = '#FF9900';
const SAFFRON_BORDER =
  'rgba(255, 153, 0, 0.20)';
const SAFFRON_FOCUS =
  'rgba(255, 153, 0, 0.50)';
const WHITE_60 =
  'rgba(255, 255, 255, 0.60)';
const WHITE_90 =
  'rgba(255, 255, 255, 0.90)';

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
    location.state?.from?.pathname || '/volunteer';

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [emailError, setEmailError] =
    useState('');

  const [passwordError, setPasswordError] =
    useState('');

  const [submitError, setSubmitError] =
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
      return (
        'Password must be at least 6 characters.'
      );
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

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

    if (typeof login !== 'function') {
      setSubmitError(
        'Volunteer authentication did not load correctly. Refresh the page or redeploy the matching authentication files.'
      );
      return;
    }

    try {
      const loggedIn = await login(
        email.trim(),
        password
      );

      if (loggedIn) {
        navigate(redirectPath, {
          replace: true,
        });
      }
    } catch (submitFailure) {
      setSubmitError(
        submitFailure?.message ||
          'Unable to sign in. Please try again.'
      );
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
          <div style={styles.logo}>
            <Landmark size={30} />
          </div>

          <h1 style={styles.brandName}>
            BharatMandir
          </h1>

          <p style={styles.subtitle}>
            Select your portal and sign in
          </p>
        </header>

        {/* User / Volunteer portal switch */}

        <div style={styles.portalSwitch}>
          <Link
            to="/login"
            style={styles.portalOption}
          >
            <UserRound size={16} />

            <span>
              User Login
            </span>
          </Link>

          <Link
            to="/volunteer/login"
            aria-current="page"
            style={{
              ...styles.portalOption,
              ...styles.activePortalOption,
            }}
          >
            <UsersRound size={16} />

            <span>
              Volunteer Login
            </span>
          </Link>
        </div>
        <div style={styles.portalDescription}>
          <strong style={styles.portalTitle}>
            Volunteer Account
          </strong>

          <span style={styles.portalText}>
            Submit temple information and track
            your submissions.
          </span>
        </div>

        {(error || submitError) && (
          <div
            role="alert"
            style={styles.serverError}
          >
            {error || submitError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
        >
          <div style={styles.fieldGroup}>
            <label
              htmlFor="login-email"
              style={styles.label}
            >
              Email Address
            </label>

            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                const value =
                  event.target.value;

                setEmail(value);

                if (emailError) {
                  setEmailError(
                    getEmailError(value)
                  );
                }
              }}
              onBlur={(event) =>
                setEmailError(
                  getEmailError(
                    event.target.value
                  )
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={Boolean(emailError)}
              style={{
                ...styles.input,
                borderColor: emailError
                  ? 'rgba(255, 80, 80, 0.6)'
                  : SAFFRON_BORDER,
              }}
              onFocus={(event) => {
                event.target.style.borderColor =
                  emailError
                    ? 'rgba(255, 80, 80, 0.8)'
                    : SAFFRON_FOCUS;
              }}
            />

            {emailError && (
              <p style={styles.fieldError}>
                {emailError}
              </p>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.passwordHeader}>
              <label
                htmlFor="login-password"
                style={{
                  ...styles.label,
                  marginBottom: 0,
                }}
              >
                Password
              </label>

              <Link
                to="/volunteer/signup"
                style={styles.forgotLink}
              >
                Create account
              </Link>
            </div>

            <div style={styles.passwordWrapper}>
              <input
                id="login-password"
                name="password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setPassword(value);

                  if (passwordError) {
                    setPasswordError(
                      getPasswordError(value)
                    );
                  }
                }}
                onBlur={(event) =>
                  setPasswordError(
                    getPasswordError(
                      event.target.value
                    )
                  )
                }
                placeholder="Your password"
                autoComplete="current-password"
                aria-invalid={Boolean(
                  passwordError
                )}
                style={{
                  ...styles.input,
                  paddingRight: 48,
                  borderColor: passwordError
                    ? 'rgba(255, 80, 80, 0.6)'
                    : SAFFRON_BORDER,
                }}
                onFocus={(event) => {
                  event.target.style.borderColor =
                    passwordError
                      ? 'rgba(255, 80, 80, 0.8)'
                      : SAFFRON_FOCUS;
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
            Create one
          </Link>
        </p>

        <div style={styles.footerLinks}>
          <Link
            to="/login"
            style={styles.footerLink}
          >
            User Login
          </Link>

          <span style={styles.separator}>
            |
          </span>

          <Link
            to="/admin/login"
            style={styles.footerLink}
          >
            Admin Portal
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
    <div style={styles.background}>
      {circles.map((circle, index) => (
        <div
          key={index}
          style={{
            ...styles.circle,
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
    maxWidth: 440,
    position: 'relative',
    zIndex: 1,
    marginBottom: 12,
  },

  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    background:
      'rgba(255, 255, 255, 0.07)',
    border:
      `1px solid ${SAFFRON_BORDER}`,
    borderRadius: 50,
    color: WHITE_60,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  },

  card: {
    width: '100%',
    maxWidth: 440,
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 1,
    padding: '34px 36px',
    background:
      'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    border:
      `1px solid ${SAFFRON_BORDER}`,
    borderRadius: 20,
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.5)',
  },

  header: {
    marginBottom: 20,
    textAlign: 'center',
  },

  logo: {
    width: 56,
    height: 56,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto 9px',
    background:
      'rgba(255, 153, 0, 0.12)',
    border:
      '1px solid rgba(255, 153, 0, 0.28)',
    borderRadius: '50%',
    color: SAFFRON,
  },

  brandName: {
    margin: 0,
    color: WHITE_90,
    fontFamily: 'Georgia, serif',
    fontSize: 24,
  },

  subtitle: {
    margin: '6px 0 0',
    color: SAFFRON,
    fontSize: 12,
    letterSpacing: '0.05em',
  },

  portalSwitch: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 5,
    marginBottom: 13,
    padding: 5,
    background:
      'rgba(0, 0, 0, 0.22)',
    border:
      `1px solid ${SAFFRON_BORDER}`,
    borderRadius: 12,
  },

  portalOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '10px 8px',
    borderRadius: 8,
    color:
      'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: 700,
    textDecoration: 'none',
  },

  activePortalOption: {
    background:
      'linear-gradient(135deg, #FF9900, #E77700)',
    color: '#1A0A00',
    boxShadow:
      '0 4px 12px rgba(255, 153, 0, 0.2)',
  },

  portalDescription: {
    display: 'grid',
    gap: 3,
    marginBottom: 20,
    padding: '10px 12px',
    background:
      'rgba(255, 153, 0, 0.06)',
    borderLeft: '3px solid #FF9900',
    borderRadius: 5,
  },

  portalTitle: {
    color: '#FFB94E',
    fontSize: 11,
  },

  portalText: {
    color:
      'rgba(255, 255, 255, 0.48)',
    fontSize: 10,
    lineHeight: 1.5,
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
    color: WHITE_90,
    caretColor: SAFFRON,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },

  passwordHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  passwordWrapper: {
    position: 'relative',
  },

  forgotLink: {
    color: SAFFRON,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  },

  eyeButton: {
    position: 'absolute',
    top: '50%',
    right: 12,
    display: 'grid',
    placeItems: 'center',
    padding: 3,
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 0,
    color:
      'rgba(255, 255, 255, 0.55)',
    cursor: 'pointer',
  },

  fieldError: {
    margin: '5px 0 0',
    color: '#FF8888',
    fontSize: 12,
    lineHeight: 1.4,
  },

  serverError: {
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
    background: '#C47700',
    boxShadow: 'none',
    cursor: 'not-allowed',
    opacity: 0.85,
  },

  signupText: {
    marginTop: 22,
    color: WHITE_60,
    textAlign: 'center',
    fontSize: 13,
  },

  primaryLink: {
    color: SAFFRON,
    fontWeight: 700,
    textDecoration: 'none',
  },

  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    paddingTop: 17,
    borderTop:
      '1px solid rgba(255, 153, 0, 0.1)',
  },

  footerLink: {
    color:
      'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    textDecoration: 'none',
  },

  separator: {
    color:
      'rgba(255, 255, 255, 0.15)',
  },

  background: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },

  circle: {
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


