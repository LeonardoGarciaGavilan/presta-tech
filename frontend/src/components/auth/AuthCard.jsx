export default function AuthCard({ children, className = "" }) {
  return (
    <div className={`auth-card-surface rounded-2xl p-8 auth-card-enter ${className}`}>
      {children}
    </div>
  );
}
