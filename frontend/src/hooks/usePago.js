import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";

export const usePago = (options = {}) => {
  const {
    prestamoInicial = null,
    onSuccess = () => {},
    showToast = () => {},
    requierePrestamo = false,
    mostrarReciboEnHook = true, // Por defecto muestra el recibo
  } = options;

  // Estados principales
  const [prestamoId, setPrestamoId] = useState(prestamoInicial?.id || "");
  const [prestamoData, setPrestamoData] = useState(prestamoInicial || null);
  const [cuotas, setCuotas] = useState([]);
  const [cuotaId, setCuotaId] = useState("PROXIMA");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [config, setConfig] = useState(null);

  // Estados de recibo
  const [reciboData, setReciboData] = useState(null);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);

  // Cargar configuración de la empresa
  const cargarConfig = useCallback(async () => {
    try {
      const res = await api.get("/configuracion");
      setConfig(res.data);
    } catch (e) {
      console.error("Error cargando config:", e);
    }
  }, []);

  // Cargar cuotas del préstamo
  const cargarCuotas = useCallback(async (pId) => {
    if (!pId) return;
    setLoadingCuotas(true);
    setCuotas([]);
    setMonto("");
    setCuotaId("PROXIMA");
    setErrors({});

    try {
      const res = await api.get(`/prestamos/${pId}`);
      const pend = (res.data.cuotas || [])
        .filter(c => !c.pagada)
        .sort((a, b) => a.numero - b.numero);

      setCuotas(pend);
      setPrestamoData(res.data);

      if (pend.length > 0) {
        setMonto((pend[0].monto + (pend[0].mora || 0)).toFixed(2));
      }
    } catch (e) {
      showToast("Error al cargar las cuotas", "error");
    } finally {
      setLoadingCuotas(false);
    }
  }, [showToast]);

  // === DECLARACIONES ANTES DE USE EFFECTS ===

  // Cuota actual seleccionada
  const cuotaActual = useMemo(() => {
    if (cuotaId === "PROXIMA") return cuotas[0] || null;
    return cuotas.find(c => c.id === cuotaId) || null;
  }, [cuotaId, cuotas]);

  const montoNum = useMemo(() => parseFloat(monto) || 0, [monto]);

  // Calcular monto exacto de la cuota
  const calcularMontoExacto = useCallback((cuota) => {
    if (!cuota) return 0;
    return cuota.monto + (cuota.mora || 0);
  }, []);

  // === USE EFFECTS ===

  // Inicialización
  useEffect(() => {
    cargarConfig();
  }, [cargarConfig]);

  // Validación en tiempo real del monto
  useEffect(() => {
    if (!montoNum || montoNum <= 0) {
      setErrors(prev => ({ ...prev, monto: null }));
      return;
    }

    const newError = [];
    if (prestamoData?.saldoPendiente && montoNum > prestamoData.saldoPendiente) {
      newError.push(`Supera el saldo pendiente (RD$${prestamoData.saldoPendiente.toFixed(2)})`);
    }
    if (cuotaActual) {
      const montoExacto = calcularMontoExacto(cuotaActual);
      if (montoNum < montoExacto) {
        newError.push(`Faltan RD$${(montoExacto - montoNum).toFixed(2)}`);
      }
    }
    if (config?.montoMaximoPago && montoNum > config.montoMaximoPago) {
      newError.push(`Supera máximo de RD$${config.montoMaximoPago.toFixed(2)}`);
    }

    setErrors(prev => ({
      ...prev,
      monto: newError.length > 0 ? newError.join(' • ') : null
    }));
  }, [montoNum, cuotaActual, config, calcularMontoExacto, prestamoData]);

  // Reset cuando cambia el prestamoId
  useEffect(() => {
    if (prestamoId) {
      cargarCuotas(prestamoId);
    } else {
      setCuotas([]);
      setPrestamoData(null);
      setMonto("");
      setCuotaId("PROXIMA");
    }
  }, [prestamoId, cargarCuotas]);

  // Calcular diferencia
  const diferencia = useMemo(() => {
    if (!cuotaActual) return 0;
    const montoExacto = calcularMontoExacto(cuotaActual);
    return Math.round((montoNum - montoExacto) * 100) / 100;
  }, [montoNum, cuotaActual, calcularMontoExacto]);

  // Validar pago
  const validarPago = useCallback(() => {
    const newErrors = {};

    // Validar prestamo si se requiere
    if (requierePrestamo && !prestamoId) {
      newErrors.prestamo = "Selecciona un préstamo.";
    }

    // Validar monto
    if (!montoNum || montoNum <= 0) {
      newErrors.monto = "Monto inválido";
    }

    // Validar método
    if (!metodo) {
      newErrors.metodo = "Seleccione un método";
    }

    // Validar que monto cubra la cuota
    if (cuotaActual) {
      const montoExacto = calcularMontoExacto(cuotaActual);
      if (montoNum < montoExacto) {
        newErrors.monto = "El monto es menor que la cuota";
      }
    }

    // Validar que monto no exceda saldo pendiente
    if (prestamoData?.saldoPendiente && montoNum > prestamoData.saldoPendiente) {
      newErrors.monto = "El monto no puede ser mayor al saldo pendiente del préstamo";
    }

    // Validar monto máximo
    if (config?.montoMaximoPago && montoNum > config.montoMaximoPago) {
      newErrors.monto = `El monto excede el máximo permitido (RD$${config.montoMaximoPago.toLocaleString()})`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [montoNum, metodo, cuotaActual, config, prestamoId, requierePrestamo, calcularMontoExacto, prestamoData]);

  // Cambio de cuota
  const handleCuotaChange = useCallback((id) => {
    setCuotaId(id);
    const c = id === "PROXIMA" ? cuotas[0] : cuotas.find(x => x.id === id);
    if (c) setMonto((c.monto + (c.mora || 0)).toFixed(2));
    setErrors(p => ({ ...p, monto: null }));
  }, [cuotas]);

  // Submit pago
  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    if (!validarPago()) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post("/pagos", {
        prestamoId,
        cuotaId: cuotaId === "PROXIMA" ? undefined : cuotaId,
        montoPagado: montoNum,
        metodo,
        referencia: referencia || undefined,
        observacion: observacion || undefined,
      });

      if (res.data && Object.keys(res.data).length > 0) {
        setReciboData(res.data);
        // Solo mostrar recibo si la opción está habilitada
        if (mostrarReciboEnHook) {
          setMostrarRecibo(true);
        }
        // Siempre ejecutar onSuccess con los datos
        onSuccess(res.data);
      } else {
        onSuccess();
      }
    } catch (e) {
      showToast(e.response?.data?.message ?? "Error al registrar pago", "error");
    } finally {
      setSubmitting(false);
    }
  }, [prestamoId, cuotaId, montoNum, metodo, referencia, observacion, submitting, validarPago, onSuccess, showToast]);

  // Cerrar recibo y ejecutar callback
  const cerrarRecibo = useCallback(() => {
    setMostrarRecibo(false);
    onSuccess();
  }, [onSuccess]);

  // Limpiar error específico
  const limpiarError = useCallback((campo) => {
    setErrors(p => ({ ...p, [campo]: null }));
  }, []);

  // Reset completo
  const reset = useCallback(() => {
    setPrestamoId("");
    setPrestamoData(null);
    setCuotas([]);
    setCuotaId("PROXIMA");
    setMonto("");
    setMetodo("EFECTIVO");
    setReferencia("");
    setObservacion("");
    setErrors({});
    setReciboData(null);
    setMostrarRecibo(false);
  }, []);

  return {
    // Estados
    prestamoId,
    setPrestamoId,
    prestamoData,
    setPrestamoData,
    cuotas,
    cuotaId,
    setCuotaId,
    monto,
    setMonto,
    metodo,
    setMetodo,
    referencia,
    setReferencia,
    observacion,
    setObservacion,
    errors,
    submitting,
    loadingCuotas,
    config,
    cuotaActual,
    montoNum,
    diferencia,
    reciboData,
    mostrarRecibo,

    // Funciones
    cargarConfig,
    cargarCuotas,
    calcularMontoExacto,
    validarPago,
    handleCuotaChange,
    handleSubmit,
    cerrarRecibo,
    limpiarError,
    reset,
  };
};
