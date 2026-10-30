'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getAdminConfigs,
  getAdminConfig,
  createAdminConfig,
  updateAdminConfig,
  deleteAdminConfig,
  bulkUpdateAdminConfigs,
  isAuthError,
  readAccessToken,
  isAdmin,
  type AdminSystemConfig,
  type AdminCreateConfigRequest,
  type AdminUpdateConfigRequest,
  type AdminBulkUpdateConfigsRequest,
} from '@/lib/api'

function ConfigCard({ config, onEdit, onDelete }: { 
  config: AdminSystemConfig
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{config.key}</p>
          {config.is_sensitive && (
            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'rgba(220,38,38,0.12)', color: T.red }}>
              SENSITIVE
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: T.slate2, marginBottom: '4px' }}>
          {config.description || 'No description'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: T.slate }}>Category: {config.category}</span>
          <span style={{ fontSize: '12px', color: T.slate2 }}>•</span>
          <span style={{ fontSize: '12px', color: T.slate }}>
            Value: {config.is_sensitive ? '•••••••••' : String(config.value)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => onEdit(config.config_id)}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(4,53,77,0.12)',
            background: '#fff',
            color: T.navy,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(config.config_id)}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: T.red,
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export default function SystemConfigPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<AdminSystemConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<AdminCreateConfigRequest>({
    key: '',
    value: '',
    description: '',
    category: 'general',
    is_sensitive: false,
  })

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/admin/login')
      return
    }

    if (!isAdmin()) {
      router.replace('/auth/admin/login')
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        const data = await getAdminConfigs(categoryFilter, searchQuery)
        if (!cancelled) {
          setConfigs(data.configs)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/admin/login')
          return
        }
        console.error('Failed to load configs', err)
        if (!cancelled) setError('Unable to load system config right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, categoryFilter, searchQuery])

  const handleCreateConfig = async () => {
    try {
      await createAdminConfig(createForm)
      setShowCreateModal(false)
      setCreateForm({ key: '', value: '', description: '', category: 'general', is_sensitive: false })
      const data = await getAdminConfigs(categoryFilter, searchQuery)
      setConfigs(data.configs)
    } catch (err) {
      console.error('Failed to create config', err)
      alert('Failed to create config')
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this config?')) return
    
    try {
      await deleteAdminConfig(configId)
      const data = await getAdminConfigs(categoryFilter, searchQuery)
      setConfigs(data.configs)
    } catch (err) {
      console.error('Failed to delete config', err)
      alert('Failed to delete config')
    }
  }

  const handleEditConfig = (configId: string) => {
    router.push(`/admin/system-config/${configId}`)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading system config...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>
            System Configuration
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
            Manage feature flags and platform settings
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: T.blue,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Add Config
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Ico p={ICONS.search} size={16} sw={1.6} color={T.slate2} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search configs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '10px',
              border: '1px solid rgba(4,53,77,0.12)',
              background: 'rgba(255,255,255,0.9)',
              fontSize: '14px',
              color: T.navy,
              outline: 'none',
            }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(4,53,77,0.12)',
            background: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            color: T.navy,
            cursor: 'pointer',
          }}
        >
          <option value="">All Categories</option>
          <option value="general">General</option>
          <option value="features">Features</option>
          <option value="limits">Limits</option>
          <option value="integrations">Integrations</option>
          <option value="security">Security</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {configs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            No configs found
          </div>
        ) : (
          configs.map((config) => (
            <ConfigCard
              key={config.config_id}
              config={config}
              onEdit={handleEditConfig}
              onDelete={handleDeleteConfig}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(4,53,77,0.32)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '480px',
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.88)',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 24px 64px rgba(4,53,77,0.2)',
            padding: '24px',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: T.navy }}>
              Add System Config
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                  Key
                </label>
                <input
                  type="text"
                  value={createForm.key}
                  onChange={(e) => setCreateForm({ ...createForm, key: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(4,53,77,0.12)',
                    background: 'rgba(255,255,255,0.9)',
                    fontSize: '14px',
                    color: T.navy,
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                  Value
                </label>
                <input
                  type="text"
                  value={String(createForm.value)}
                  onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(4,53,77,0.12)',
                    background: 'rgba(255,255,255,0.9)',
                    fontSize: '14px',
                    color: T.navy,
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                  Description
                </label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(4,53,77,0.12)',
                    background: 'rgba(255,255,255,0.9)',
                    fontSize: '14px',
                    color: T.navy,
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                  Category
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(4,53,77,0.12)',
                    background: 'rgba(255,255,255,0.9)',
                    fontSize: '14px',
                    color: T.navy,
                    cursor: 'pointer',
                  }}
                >
                  <option value="general">General</option>
                  <option value="features">Features</option>
                  <option value="limits">Limits</option>
                  <option value="integrations">Integrations</option>
                  <option value="security">Security</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="sensitive"
                  checked={createForm.is_sensitive}
                  onChange={(e) => setCreateForm({ ...createForm, is_sensitive: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="sensitive" style={{ fontSize: '13px', color: T.navy }}>
                  Mark as sensitive
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateForm({ key: '', value: '', description: '', category: 'general', is_sensitive: false })
                }}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateConfig}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: 'none', background: T.blue, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Create Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
