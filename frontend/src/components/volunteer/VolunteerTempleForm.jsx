import {
  useEffect,
  useState,
} from 'react';

import {
  Image,
  Landmark,
  MapPin,
  Save,
} from 'lucide-react';

const emptyForm = {
  temple_name: '',
  deity: '',
  temple_type: '',
  address: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  description: '',
  history: '',
  timings: '',
  contact_phone: '',
  image_url: '',
  latitude: '',
  longitude: '',
};

export default function VolunteerTempleForm({
  initialValue,
  onSubmit,
  onSaveDraft,
  onCancel,
  submitting = false,
}) {
  const [form, setForm] = useState({
    ...emptyForm,
    ...initialValue,
  });

  const [validationError, setValidationError] =
    useState('');
  const [step, setStep] = useState(0);
  const stepNames = ['Basic Details', 'Location', 'Contact & Media'];

  const completed = ['temple_name', 'address', 'city', 'state', 'deity', 'description', 'timings', 'image_url']
    .filter((key) => String(form[key] ?? '').trim()).length;
  const completion = Math.round((completed / 8) * 100);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('bm_volunteer_temple_autosave', JSON.stringify(form));
    }, 500);
    return () => clearTimeout(timer);
  }, [form]);

  useEffect(() => {
    if (initialValue) {
      setForm({
        ...emptyForm,
        ...initialValue,
      });
    }
  }, [initialValue]);

  const updateField = (field, value) => {
    setValidationError('');

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError('');

    if (
      !form.temple_name.trim() ||
      !form.address.trim() ||
      !form.city.trim() ||
      !form.state.trim()
    ) {
      setValidationError(
        'Temple name, address, city aur state required hain.'
      );

      return;
    }

    const payload = {
      ...form,
      temple_name: form.temple_name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),

      latitude:
        form.latitude === ''
          ? null
          : Number(form.latitude),

      longitude:
        form.longitude === ''
          ? null
          : Number(form.longitude),
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 18 }}>
          {stepNames.map((name, index) => (
            <button key={name} type="button" onClick={() => setStep(index)} style={{ padding: '9px 5px', border: `1px solid ${index <= step ? '#D65B08' : '#E5D8C6'}`, borderRadius: 8, background: index === step ? '#D65B08' : index < step ? '#FFF0E5' : '#fff', color: index === step ? '#fff' : '#6A3C20', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {index + 1}. {name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7A5538', marginBottom: 7 }}>
          <strong>Form completion</strong><span>{completion}%</span>
        </div>
        <div style={{ height: 7, background: '#F1E5D5', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#D65B08,#FF9900)', transition: 'width .25s' }} />
        </div>
        <p style={{ margin: '6px 0 0', color: '#9A7559', fontSize: 10 }}>Changes are preserved locally while you edit.</p>
      </div>
      {step === 0 && <FormSection
        icon={<Landmark size={19} />}
        title="Basic Temple Information"
        description="Mandir ki primary details enter karein."
      >
        <div
          className="volunteer-form-grid"
          style={styles.twoColumnGrid}
        >
          <FormField
            label="Temple Name"
            name="temple_name"
            value={form.temple_name}
            onChange={updateField}
            placeholder="Example: Mahakaleshwar Temple"
            required
          />

          <FormField
            label="Main Deity"
            name="deity"
            value={form.deity}
            onChange={updateField}
            placeholder="Example: Lord Shiva"
          />

          <FormField
            label="Temple Type"
            name="temple_type"
            value={form.temple_type}
            onChange={updateField}
            placeholder="Jyotirlinga, Shaktipeeth..."
          />

          <FormField
            label="Contact Phone"
            name="contact_phone"
            type="tel"
            value={form.contact_phone}
            onChange={updateField}
            placeholder="Temple contact number"
          />
        </div>
      </FormSection>}

      {step === 1 && <FormSection
        icon={<MapPin size={19} />}
        title="Temple Location"
        description="Accurate address devotees ko temple find karne mein help karega."
      >
        <FormField
          label="Full Address"
          name="address"
          value={form.address}
          onChange={updateField}
          placeholder="Street, landmark aur locality"
          required
        />

        <div
          className="volunteer-form-grid"
          style={styles.twoColumnGrid}
        >
          <FormField
            label="City"
            name="city"
            value={form.city}
            onChange={updateField}
            placeholder="City"
            required
          />

          <FormField
            label="District"
            name="district"
            value={form.district}
            onChange={updateField}
            placeholder="District"
          />

          <FormField
            label="State"
            name="state"
            value={form.state}
            onChange={updateField}
            placeholder="State"
            required
          />

          <FormField
            label="Pincode"
            name="pincode"
            value={form.pincode}
            onChange={updateField}
            placeholder="6-digit pincode"
            inputMode="numeric"
            maxLength={6}
          />

          <FormField
            label="Latitude"
            name="latitude"
            type="number"
            value={form.latitude}
            onChange={updateField}
            placeholder="Example: 23.1765"
            step="any"
          />

          <FormField
            label="Longitude"
            name="longitude"
            type="number"
            value={form.longitude}
            onChange={updateField}
            placeholder="Example: 75.7885"
            step="any"
          />
        </div>
      </FormSection>}

      {step === 2 && <FormSection
        icon={<Image size={19} />}
        title="Description and Media"
        description="Original aur verified information provide karein."
      >
        <TextAreaField
          label="Temple Description"
          name="description"
          value={form.description}
          onChange={updateField}
          placeholder="Temple, deity aur religious importance ke baare mein likhein..."
          rows={4}
        />

        <TextAreaField
          label="Temple History"
          name="history"
          value={form.history}
          onChange={updateField}
          placeholder="Temple ki history aur important events..."
          rows={4}
        />

        <div
          className="volunteer-form-grid"
          style={styles.twoColumnGrid}
        >
          <FormField
            label="Temple Timings"
            name="timings"
            value={form.timings}
            onChange={updateField}
            placeholder="Example: 5:00 AM - 10:00 PM"
          />

          <FormField
            label="Temple Image URL"
            name="image_url"
            type="url"
            value={form.image_url}
            onChange={updateField}
            placeholder="https://example.com/temple.jpg"
          />
        </div>
      </FormSection>}

      {validationError && (
        <div
          role="alert"
          style={styles.errorBox}
        >
          {validationError}
        </div>
      )}

      <div style={styles.submitArea}>
        <p style={styles.submitNote}>
          Submit karne ke baad temple details admin
          verification mein jayengi.
        </p>

        <button type="button" onClick={onCancel} style={{ ...styles.submitButton, background: '#F5EBDD', color: '#6A3C20', boxShadow: 'none' }}>
          Cancel
        </button>
        {step > 0 && <button type="button" onClick={() => setStep((value) => value - 1)} style={{ ...styles.submitButton, background: '#FFF0E5', color: '#9A3C05', boxShadow: 'none' }}>Previous</button>}
        <button type="button" disabled={submitting} onClick={() => onSaveDraft?.(form)} style={{ ...styles.submitButton, background: '#7A5538' }}>
          <Save size={17} /> Save Draft
        </button>
        {step < 2 ? <button type="button" onClick={() => setStep((value) => value + 1)} style={styles.submitButton}>Next</button> : <button
          type="submit"
          disabled={submitting}
          style={{
            ...styles.submitButton,
            ...(submitting
              ? styles.disabledButton
              : {}),
          }}
        >
          <Save size={17} />

          {submitting
            ? 'Submitting...'
            : 'Submit Temple for Review'}
        </button>}
      </div>

      <style>
        {`
          @media (max-width: 620px) {
            .volunteer-form-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </form>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}) {
  return (
    <section style={styles.formSection}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionIcon}>
          {icon}
        </div>

        <div>
          <h3 style={styles.sectionTitle}>
            {title}
          </h3>

          <p style={styles.sectionDescription}>
            {description}
          </p>
        </div>
      </div>

      <div style={styles.sectionContent}>
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  ...inputProps
}) {
  return (
    <label style={styles.label}>
      <span>
        {label}

        {required && (
          <span style={styles.required}>
            {' '}*
          </span>
        )}
      </span>

      <input
        name={name}
        type={type}
        value={value ?? ''}
        onChange={(event) =>
          onChange(name, event.target.value)
        }
        placeholder={placeholder}
        required={required}
        style={styles.input}
        {...inputProps}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows,
}) {
  return (
    <label style={styles.label}>
      {label}

      <textarea
        name={name}
        value={value ?? ''}
        onChange={(event) =>
          onChange(name, event.target.value)
        }
        placeholder={placeholder}
        rows={rows}
        style={{
          ...styles.input,
          ...styles.textarea,
        }}
      />
    </label>
  );
}

const styles = {
  formSection: {
    marginBottom: 25,
    paddingBottom: 25,
    borderBottom: '1px solid #EEE1D0',
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 18,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    borderRadius: 10,
    color: '#C8520A',
  },

  sectionTitle: {
    margin: 0,
    color: '#3B1B08',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 19,
  },

  sectionDescription: {
    margin: '4px 0 0',
    color: '#8B6A54',
    fontSize: 11,
    lineHeight: 1.5,
  },

  sectionContent: {
    display: 'grid',
    gap: 16,
  },

  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: 16,
  },

  label: {
    display: 'grid',
    gap: 7,
    color: '#653416',
    fontSize: 12,
    fontWeight: 700,
  },

  required: {
    color: '#C54210',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 13px',
    background: '#FFFEFC',
    border: '1px solid #DDCDB8',
    borderRadius: 9,
    color: '#301508',
    fontFamily: 'inherit',
    fontSize: 13,
    outlineColor: '#D1580B',
  },

  textarea: {
    minHeight: 95,
    lineHeight: 1.6,
    resize: 'vertical',
  },

  errorBox: {
    marginBottom: 18,
    padding: 12,
    background: '#FDEAEA',
    border: '1px solid #F0CACA',
    borderRadius: 9,
    color: '#A52222',
    fontSize: 12,
  },

  submitArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },

  submitNote: {
    flex: '1 1 240px',
    margin: 0,
    color: '#8B6A54',
    fontSize: 11,
    lineHeight: 1.5,
  },

  submitButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '13px 19px',
    background:
      'linear-gradient(135deg, #D65B08, #B33E04)',
    border: 0,
    borderRadius: 10,
    color: '#FFFFFF',
    boxShadow:
      '0 6px 16px rgba(200, 82, 10, 0.22)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },

  disabledButton: {
    background: '#C89A7B',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
};
