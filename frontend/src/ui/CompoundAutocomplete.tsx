import { useEffect, useRef, useState } from 'react'
import { search } from '../engine/compounds'
import type { Compound } from '../engine/compounds'
import compoundsData from '../../../compounds.json'

const ALL: Compound[] = (compoundsData as { compounds: Compound[] }).compounds

interface Props {
  value: string
  onChange: (name: string) => void
  onSelect: (compound: Compound) => void
  placeholder?: string
  inputClassName?: string
}

export default function CompoundAutocomplete({ value, onChange, onSelect, placeholder, inputClassName }: Props) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Compound[]>([])
  const [selected, setSelected] = useState<Compound | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    onChange(v)
    setSelected(null)
    const hits = search(v, ALL)
    setResults(hits)
    setOpen(hits.length > 0)
  }

  function handleFocus() {
    if (!selected) {
      const hits = search(value, ALL)
      if (hits.length > 0) { setResults(hits); setOpen(true) }
    }
  }

  function handleSelect(c: Compound) {
    onChange(c.name)
    setSelected(c)
    onSelect(c)
    setOpen(false)
  }

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />

      {open && (
        <ul className="ac-dropdown">
          {results.map((c, i) => (
            <li key={i} onMouseDown={() => handleSelect(c)}>
              <span className="ac-name">{c.name}</span>
              <span className="ac-tag">{c.category} · {c.stock.value} {c.stock.unit}</span>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="ac-info">
          {(selected.cas || selected.mw) && (
            <span className="ac-ref">
              {selected.cas  && <>CAS {selected.cas}</>}
              {selected.cas && selected.mw && ' · '}
              {selected.mw   && <>{selected.mw} g/mol</>}
            </span>
          )}
          {selected.hint && <div className="ac-hint">{selected.hint}</div>}
        </div>
      )}
    </div>
  )
}
