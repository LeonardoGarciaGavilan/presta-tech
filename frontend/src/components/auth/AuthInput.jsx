import { forwardRef } from "react";

const AuthInput = forwardRef(function AuthInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  onKeyDown,
  icon,
  showPasswordToggle = false,
  showPassword = false,
  onTogglePassword,
  labelClassName = "block text-xs font-medium auth-label uppercase tracking-wider mb-2",
  inputClassName = "",
  iconClassName = "text-gray-400",
  eyeClassName = "text-gray-400 hover:text-gray-600",
  rightSlot,
  wrapperClassName = "",
  autoComplete,
}, ref) {
  const hasIcon = !!icon;
  const hasEye = showPasswordToggle;
  const hasRightSlot = !!rightSlot;

  let paddingRight = "";
  if (hasEye) paddingRight = "pr-11";
  else if (hasRightSlot) paddingRight = "pr-10";
  else paddingRight = "pr-4";

  const LabelTag = id ? "label" : "span";

  return (
    <div className={wrapperClassName}>
      {label && (
        <LabelTag {...(id ? { htmlFor: id } : {})} className={labelClassName}>
          {label}
        </LabelTag>
      )}
      <div className="relative">
        {hasIcon && (
          <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${iconClassName}`}>
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          autoComplete={autoComplete}
          className={`w-full auth-input-base rounded-xl py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-4 focus:outline-none focus:ring-2 ${hasIcon ? "pl-10" : ""} ${paddingRight} ${inputClassName}`}
        />
        {hasRightSlot && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            {rightSlot}
          </div>
        )}
        {hasEye && (
          <button
            type="button"
            onClick={onTogglePassword}
            disabled={disabled}
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors disabled:opacity-50 ${eyeClassName}`}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
});

export default AuthInput;
