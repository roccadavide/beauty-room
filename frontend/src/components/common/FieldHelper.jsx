const FieldHelper = ({ children, className = "" }) => (
  <small className={`ud-field-helper${className ? ` ${className}` : ""}`}>{children}</small>
);

export default FieldHelper;
