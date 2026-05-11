export default function RadioRow({ name, value, onChange, options }) {
  return (
    <div className="radio-row">
      {options.map(opt => (
        <label key={opt.value} className={value === opt.value ? "selected" : ""}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
