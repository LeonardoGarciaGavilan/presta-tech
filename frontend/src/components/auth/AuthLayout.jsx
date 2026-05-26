export default function AuthLayout({ children, maxWidth = "max-w-md", showCenterBlur = true }) {
  return (
    <div className="min-h-screen auth-bg-gradient flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full auth-blur-1 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full auth-blur-2 blur-3xl" />
        {showCenterBlur && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full auth-blur-center blur-3xl" />
        )}
      </div>
      <div className={`relative w-full ${maxWidth}`}>
        {children}
      </div>
    </div>
  );
}
