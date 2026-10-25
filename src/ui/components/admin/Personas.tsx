import { Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRequest, useTwin } from '../../../application/TwinContext';
import type { Persona, TipoPersona } from '../../../domain/model';
import { PERSONA_LABEL, SPACE_TYPE_LABEL } from '../../theme';

const inputClass = 'rounded-lg border border-rule bg-white px-2.5 py-1.5 text-sm';

/**
 * Teachers and students the bookings can name. Only the institutional code, the name and the department or
 * program are kept (Ley 1581 de 2012): no contact data and no biometrics. Each type has its own booking rules.
 */
export function Personas() {
  const { operaciones } = useTwin();
  const { pending, run } = useRequest();
  const [filter, setFilter] = useState<TipoPersona | ''>('');
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [tipo, setTipo] = useState<TipoPersona>('DOCENTE');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [adscripcion, setAdscripcion] = useState('');

  const load = useCallback(async () => {
    const result = await run(() => operaciones.personas(filter || undefined));
    if (result) setPersonas(result);
  }, [operaciones, filter, run]);

  useEffect(() => void load(), [load]);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run(() => operaciones.registrarPersona({ tipo, codigo: codigo.trim(), nombre: nombre.trim(), adscripcion: adscripcion.trim() }),
      `${PERSONA_LABEL[tipo]} ${codigo.trim()} registrado.`);
    if (saved) {
      setCodigo('');
      setNombre('');
      void load();
    }
  };

  const remove = async (persona: Persona) => {
    if (!confirm(`¿Eliminar a ${persona.nombre} (${persona.codigo}) del registro?`)) return;
    await run(() => operaciones.eliminarPersona(persona.codigo), `${persona.codigo} eliminado.`);
    void load();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="personas-title" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="personas-title" className="text-lg font-semibold">Docentes y estudiantes</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value as TipoPersona | '')} aria-label="Filtrar por tipo" className={inputClass}>
            <option value="">Todos</option>
            <option value="DOCENTE">Docentes</option>
            <option value="ESTUDIANTE">Estudiantes</option>
          </select>
        </div>
        {personas === null && <p className="mt-3 text-sm text-ink-soft">Cargando…</p>}
        {personas?.length === 0 && <p className="mt-3 text-sm text-ink-soft">No hay personas registradas.</p>}
        {personas && personas.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-rule bg-sheet">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-ink-soft">
                <tr className="border-b border-rule">
                  <th className="px-3 py-2 font-normal">Código</th>
                  <th className="px-3 py-2 font-normal">Nombre</th>
                  <th className="px-3 py-2 font-normal">Tipo</th>
                  <th className="px-3 py-2 font-normal">Puede reservar</th>
                  <th className="px-3 py-2 font-normal"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {personas.map((p) => (
                  <tr key={p.codigo} className="border-b border-rule/70 align-top">
                    <td className="condensed px-3 py-2 font-medium">{p.codigo}</td>
                    <td className="px-3 py-2">{p.nombre}<span className="block text-xs text-ink-soft">{p.adscripcion}</span></td>
                    <td className="px-3 py-2">{PERSONA_LABEL[p.tipo]}</td>
                    <td className="px-3 py-2 text-ink-soft">{p.puedeReservar.map((t) => SPACE_TYPE_LABEL[t]).join(', ')} · hasta {p.reservaMaximaHoras} h</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" disabled={pending} onClick={() => void remove(p)} aria-label={`Eliminar a ${p.nombre}`}
                        className="rounded-md p-1 text-ink-soft hover:bg-white hover:text-st-sobrecupo-ink"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form onSubmit={(event) => void register(event)} className="flex flex-col gap-2.5 rounded-2xl border border-rule bg-sheet p-4" aria-labelledby="persona-form-title">
        <h3 id="persona-form-title" className="flex items-center gap-1.5 font-semibold"><UserPlus className="h-4 w-4 text-ink-soft" />Registrar o actualizar</h3>
        <div role="radiogroup" aria-label="Tipo" className="flex gap-2 text-sm">
          {(['DOCENTE', 'ESTUDIANTE'] as const).map((t) => (
            <label key={t} className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 py-1.5 ${tipo === t ? 'border-signal bg-white font-medium' : 'border-rule'}`}>
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />{PERSONA_LABEL[t]}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">Código institucional
          <input required maxLength={32} value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">Nombre
          <input required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">{tipo === 'DOCENTE' ? 'Departamento' : 'Programa'}
          <input required maxLength={120} value={adscripcion} onChange={(e) => setAdscripcion(e.target.value)} className={inputClass} />
        </label>
        <p className="text-xs text-ink-soft">Si el código ya existe, se actualizan sus datos. No se piden correos, teléfonos ni fotos.</p>
        <button type="submit" disabled={pending} className="rounded-lg bg-night px-3 py-2 text-sm font-medium text-night-text disabled:opacity-60">{pending ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </div>
  );
}
