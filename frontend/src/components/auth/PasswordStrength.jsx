export default function PasswordStrength({ password }) {
  const fortaleza = (() => {
    if (!password) return null;
    if (password.length < 6)  return { label: "Muy corta", color: "bg-red-500",    w: "w-1/4" };
    if (password.length < 8)  return { label: "Débil",     color: "bg-orange-400", w: "w-2/4" };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
                              return { label: "Regular",   color: "bg-amber-400",  w: "w-3/4" };
    return                           { label: "Fuerte",    color: "bg-emerald-500",w: "w-full" };
  })();

  if (!fortaleza) return null;

  const labelColor = fortaleza.label === "Fuerte" ? "text-emerald-600"
    : fortaleza.label === "Regular" ? "text-amber-600"
    : "text-red-600";

  return (
    <div className="mt-2">
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${fortaleza.color} ${fortaleza.w}`} />
      </div>
      <p className={`text-xs mt-1 font-medium ${labelColor}`}>{fortaleza.label}</p>
    </div>
  );
}
