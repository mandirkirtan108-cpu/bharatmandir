import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Landmark,
} from 'lucide-react';

import { volunteerApi } from '../../services/volunteerApi';

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  city: '',
  state: '',
};

export default function VolunteerSignupPage() {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const updateField = (field, value) => {
    setError('');

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Password aur confirm password match nahi karte.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password kam se kam 6 characters ka hona chahiye.');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...signupData } = form;

      await volunteerApi.signup(signupData);

      navigate('/volunteer/login', {
        state: {
          message:
            'Volunteer account successfully create ho gaya. Please sign in karein.',
        },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          'Account create nahi ho paya. Please dobara try karein.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <BackgroundDecoration />

      <section style={styles.card}>
        <Link
          to="/"
          style={styles.backLink}
        >
          &larr; Home
        </Link>

        <header style={styles.header}>
          <div style={styles.logoBox}>
            <Landmark size={31} />
          </div>

          <h1 style={styles.brandName}>
            BharatMandir
          </h1>

          <p style={styles.heading}>
            BECOME A VOLUNTEER
          </p>

          <p style={styles.description}>
            Help preserve and share India&apos;s temple heritage
          </p>
        </header>

        {error && (
          <div
            role="alert"
            style={styles.errorBox}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <FormField
              label="Full Name"
              name="name"
              value={form.name}
              onChange={(value) => updateField('name', value)}
              placeholder="Enter your full name"
              autoComplete="name"
              required
            />

            <FormField
              label="Email Address"
              name="email"
              type="email"
              value={form.email}
              onChange={(value) => updateField('email', value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />

            <FormField
              label="Phone Number"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(value) => updateField('phone', value)}
              placeholder="Enter phone number"
              autoComplete="tel"
            />

            <FormField
              label="City"
              name="city"
              value={form.city}
              onChange={(value) => updateField('city', value)}
              placeholder="Enter your city"
              autoComplete="address-level2"
            />

            <FormField
              label="State"
              name="state"
              value={form.state}
              onChange={(value) => updateField('state', value)}
              placeholder="Enter your state"
              autoComplete="address-level1"
            />
          </div>

          <PasswordField
            label="Password"
            name="password"
            value={form.password}
            onChange={(value) => updateField('password', value)}
            visible={showPassword}
            onToggle={() =>
              setShowPassword((current) => !current)
            }
            autoComplete="new-password"
          />

          <PasswordField
            label="Confirm Password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={(value) =>
              updateField('confirmPassword', value)
            }
            visible={showConfirmPassword}
            onToggle={() =>
              setShowConfirmPassword((current) => !current)
            }
            autoComplete="new-password"
          />

          <label style={styles.confirmationLabel}>
            <input
              type="checkbox"
              required
              style={styles.checkbox}
            />

            <span>
              I confirm that temple information submitted by me
              will be accurate and subject to admin verification.
            </span>
          </label>

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
            {loading
              ? 'Creating Account...'
              : 'Create Volunteer Account'}
          </button>
        </form>

        <p style={styles.loginText}>
          Already registered?{' '}
          <Link
            to="/volunteer/login"
            style={styles.loginLink}
          >
            Sign in
          </Link>
        </p>
      </section>

      <style>
        {`
          @media (max-width: 580px) {
            .volunteer-signup-card {
              padding: 45px 22px 30px !important;
            }
          }
        `}
      </style>
    </main>
  );
}

function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
}) {
  return (
    <label style={styles.label}>
      {label}

      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        style={styles.input}
      />
    </label>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}) {
  return (
    <label style={styles.passwordLabel}>
      {label}

      <div style={styles.passwordWrapper}>
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Minimum 6 characters"
          autoComplete={autoComplete}
          minLength={6}
          required
          style={{
            ...styles.input,
            paddingRight: 48,
          }}
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={
            visible ? 'Hide password' : 'Show password'
          }
          style={styles.eyeButton}
        >
          {visible ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </label>
  );
}

function BackgroundDecoration() {
  const circles = [
    { left: '10%', top: '20%' },
    { left: '80%', top: '70%' },
    { left: '50%', top: '90%' },
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
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
    background:
      'linear-gradient(135deg, #1A0A00 0%, #3D1F00 50%, #1A0A00 100%)',
    fontFamily: "'Segoe UI', sans-serif",
  },

  card: {
    width: '100%',
    maxWidth: 540,
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 1,
    padding: '48px 40px 36px',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 153, 0, 0.20)',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },

  backLink: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 153, 0, 0.20)',
    borderRadius: 50,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  },

  header: {
    margin: '8px 0 28px',
    textAlign: 'center',
  },

  logoBox: {
    width: 58,
    height: 58,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto',
    background: 'rgba(255, 153, 0, 0.12)',
    border: '1px solid rgba(255, 153, 0, 0.28)',
    borderRadius: '50%',
    color: '#FF9900',
  },

  brandName: {
    margin: '10px 0 0',
    color: 'rgba(255, 255, 255, 0.92)',
    fontFamily: 'Georgia, serif',
    fontSize: 25,
  },

  heading: {
    margin: '6px 0',
    color: '#FF9900',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
  },

  description: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 14,
  },

  label: {
    display: 'grid',
    gap: 6,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
  },

  passwordLabel: {
    display: 'grid',
    gap: 6,
    marginTop: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 153, 0, 0.2)',
    borderRadius: 10,
    color: 'rgba(255, 255, 255, 0.92)',
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

  confirmationLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 16,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    lineHeight: 1.5,
    cursor: 'pointer',
  },

  checkbox: {
    marginTop: 3,
    accentColor: '#FF9900',
  },

  submitButton: {
    width: '100%',
    marginTop: 22,
    padding: 14,
    background:
      'linear-gradient(135deg, #FF9900, #E68A00)',
    border: 0,
    borderRadius: 12,
    color: '#1A0A00',
    boxShadow: '0 4px 20px rgba(255, 153, 0, 0.22)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },

  disabledButton: {
    background: 'rgba(255, 153, 0, 0.4)',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },

  errorBox: {
    marginBottom: 20,
    padding: '12px 16px',
    background: 'rgba(255, 80, 80, 0.12)',
    border: '1px solid rgba(255, 80, 80, 0.3)',
    borderRadius: 10,
    color: '#FFAAAA',
    fontSize: 13,
  },

  loginText: {
    marginTop: 22,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 13,
  },

  loginLink: {
    color: '#FF9900',
    fontWeight: 700,
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
    background: 'rgba(255, 153, 0, 0.04)',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
  },
};