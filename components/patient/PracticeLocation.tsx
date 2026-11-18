'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import 'leaflet/dist/leaflet.css'

// Leaflet touches `window`, so it is only loaded in the browser, and only after consent.
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false })

const CONSENT_KEY = 'qarevo.map-consent.openstreetmap.v1'
function readConsent() { try { return window.sessionStorage.getItem(CONSENT_KEY) === 'granted' } catch { return false } }
function rememberConsent() { try { window.sessionStorage.setItem(CONSENT_KEY, 'granted') } catch { /* consent still applies to this view */ } }

export function validCoordinates(latitude?: number | null, longitude?: number | null): [number, number] | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (latitude === 0 && longitude === 0)) return null
  return [latitude, longitude]
}

/**
 * The practice address, with a map only on request. Map tiles come from
 * OpenStreetMap, which receives the visitor's IP address, so nothing is loaded
 * from a third party until the patient chooses to show the map. That choice is
 * remembered for this browser tab only.
 */
export default function PracticeLocation({ name, practice, address, latitude, longitude }: {
  name: string; practice?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null
}) {
  // Coordinates arrive only after the client-side profile fetch, so reading the
  // stored choice up front cannot change the server-rendered markup.
  const [consented, setConsented] = useState(() => typeof window !== 'undefined' && readConsent())
  const coordinates = validCoordinates(latitude, longitude)
  const cleanAddress = (address || '').replace(/^[\s,]+|[\s,]+$/g, '').replace(/(,\s*){2,}/g, ', ')
  const query = [practice, cleanAddress].filter(Boolean).join(', ')
  const externalHref = coordinates
    ? `https://www.openstreetmap.org/?mlat=${coordinates[0]}&mlon=${coordinates[1]}#map=17/${coordinates[0]}/${coordinates[1]}`
    : cleanAddress ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : null

  return <div className='pl'>
    <style>{`
      .pl { display: grid; gap: 12px; }
      .pl address { font-style: normal; font-size: 14px; line-height: 1.6; color: var(--text); }
      .pl address strong { display: block; }
      .pl-map { height: 220px; border-radius: 14px; overflow: hidden; border: 1px solid var(--border); }
      .pl-gate { display: grid; gap: 10px; padding: 14px; border-radius: 14px; border: 1px dashed var(--border); background: var(--surface-subtle); }
      .pl-gate p, .pl-note { margin: 0; font-size: 13px; line-height: 1.55; color: var(--text-secondary); }
      .pl-button { justify-self: start; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
      .pl-button:focus-visible, .pl-link:focus-visible { outline: 3px solid var(--action-primary); outline-offset: 2px; }
      .pl-link { font-size: 13px; font-weight: 700; color: var(--link); justify-self: start; min-height: 24px; }
    `}</style>
    {cleanAddress
      ? <address>{practice && <strong>{practice}</strong>}{cleanAddress}</address>
      : <p className='pl-note'>The practice has not published its address yet. Video consultations do not need a visit.</p>}
    {coordinates && (consented
      ? <div className='pl-map' role='region' aria-label={`Map showing the practice of ${name}`}>
          <MapContainer center={coordinates} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer url='https://tile.openstreetmap.org/{z}/{x}/{y}.png' attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            <CircleMarker center={coordinates} radius={10} pathOptions={{ color: '#348CEA', fillColor: '#348CEA', fillOpacity: 0.85, weight: 2 }} />
          </MapContainer>
        </div>
      : <div className='pl-gate'>
          <p>The map is provided by OpenStreetMap. Showing it sends your IP address to the OpenStreetMap Foundation. Nothing is loaded until you choose to show it.</p>
          <button type='button' className='pl-button' onClick={() => { rememberConsent(); setConsented(true) }}>Show map</button>
        </div>)}
    {!coordinates && cleanAddress && <p className='pl-note'>A map appears here once the practice has confirmed its location.</p>}
    {externalHref && <a className='pl-link' href={externalHref} target='_blank' rel='noopener noreferrer'>Open in OpenStreetMap (new tab)</a>}
  </div>
}
