import { useCallback, useEffect, useState } from 'react';
import { listar } from '@/api/clientes.api';
import type { Cliente } from '@/types/cliente.types';

interface UseEntitySearchOptions {
  excludeId?: string;
  minChars?: number;
  limit?: number;
  debounceMs?: number;
}

interface UseEntitySearchReturn {
  entity: Cliente | null;
  setEntity: React.Dispatch<React.SetStateAction<Cliente | null>>;
  searchText: string;
  setSearchText: (text: string) => void;
  sugerencias: Cliente[];
  showSugerencias: boolean;
  setShowSugerencias: (show: boolean) => void;
  seleccionar: (c: Cliente) => boolean;
  limpiar: () => void;
  error: string | null;
  setError: (err: string | null) => void;
  buscando: boolean;
}

export function useEntitySearch({
  excludeId,
  minChars = 2,
  limit = 6,
  debounceMs = 350,
}: UseEntitySearchOptions = {}): UseEntitySearchReturn {
  const [entity, setEntity] = useState<Cliente | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchText.length < minChars) {
      setSugerencias([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await listar({ page: 1, limit, search: searchText });
        let results = res.data.slice(0, limit);
        if (excludeId) {
          results = results.filter((c) => c.id !== excludeId);
        }
        setSugerencias(results.slice(0, limit));
        setShowSugerencias(true);
      } catch {
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchText, excludeId, minChars, limit, debounceMs]);

  const seleccionar = useCallback(
    (c: Cliente) => {
      if (excludeId && c.id === excludeId) {
        setError('El cliente no puede ser su propio garante');
        return false;
      }
      setEntity(c);
      setSearchText(`${c.nombre} ${c.apellido || ''}`);
      setSugerencias([]);
      setShowSugerencias(false);
      setError(null);
      return true;
    },
    [excludeId],
  );

  const limpiar = useCallback(() => {
    setEntity(null);
    setSearchText('');
    setSugerencias([]);
    setError(null);
  }, []);

  return {
    entity,
    setEntity,
    searchText,
    setSearchText,
    sugerencias,
    showSugerencias,
    setShowSugerencias,
    seleccionar,
    limpiar,
    error,
    setError,
    buscando,
  };
}

export function useClienteSearch() {
  return useEntitySearch({ minChars: 2, limit: 6 });
}

export function useGaranteSearch(clienteId: string | null) {
  return useEntitySearch({
    excludeId: clienteId ?? undefined,
    minChars: 2,
    limit: 5,
  });
}
