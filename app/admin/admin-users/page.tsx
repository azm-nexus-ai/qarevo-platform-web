'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  updateAdminUserStatus,
  deleteAdminUser,
  isAuthError,
  readAccessToken,
  isAdmin,
  type AdminUser,
  type AdminCreateAdminUserRequest,
  type AdminUpdateAdminUserRequest,
  type AdminUpdateAdminStatusRequest,
} from '@/lib/api'

function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case 'active':
        return { bg: 'rgba(15,158,119,0.12)', color: T.green }
      case 'inactive':
      case 'suspended':
        return { bg: 'rgba(220,38,38,0.12)', color: T.red }
      case 'pending':
        return { bg: 'rgba(217,119,6,0.12)', color: T.amber }
      default:
        return { bg: 'rgba(32,181,223,0.12)', color: T.blue }
    }
  }

  const style = getStatusStyle(status)

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 700,
      background: style.bg,
      color: style.color
    }}>
      {status.toUpperCase()}
    </span>
  )
}

function AdminUserCard({ user, onEdit, onDeactivate, onDelete }: { 
  user: AdminUser
  onEdit: (id: string) => void
  onDeactivate: (id: string) => void
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          borderRadius: '12px', 
          background: 'rgba(165,224,218,0.2)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: T.purple,
          fontSize: '16px',
          fontWeight: 700
        }}>
          {user.full_name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy }}>{user.full_name}</p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.slate2 }}>{user.email}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: T.slate }}>{user.role}</span>
            <span style={{ fontSize: '12px', color: T.slate2 }}>•</span>
            <span style={{ fontSize: '12px', color: T.slate }}>
              {new Date(user.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <StatusBadge status={user.status} />
        <button
          type="button"
          onClick={() => onEdit(user.admin_id)}
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
        {user.status === 'active' ? (
          <button
            type="button"
            onClick={() => onDeactivate(user.admin_id)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: T.amber,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDelete(user.admin_id)}
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
        )}
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<AdminCreateAdminUserRequest>({
    email: '',
    full_name: '',
    role: 'ADMIN',
  })

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    if (!isAdmin()) {
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        const data = await getAdminUsers(roleFilter, statusFilter, searchQuery)
        if (!cancelled) {
          setAdminUsers(data.admin_users)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load admin users', err)
        if (!cancelled) setError('Unable to load admin users right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [router, roleFilter, statusFilter, searchQuery])

  const handleCreateAdmin = async () => {
    try {
      await createAdminUser(createForm)
      setShowCreateModal(false)
      setCreateForm({ email: '', full_name: '', role: 'ADMIN' })
      const data = await getAdminUsers(roleFilter, statusFilter, searchQuery)
      setAdminUsers(data.admin_users)
    } catch (err) {
      console.error('Failed to create admin user', err)
      alert('Failed to create admin user')
    }
  }

  const handleDeactivate = async (adminId: string) => {
    if (!confirm('Are you sure you want to deactivate this admin user?')) return
    
    try {
      await updateAdminUserStatus(adminId, { status: 'inactive', reason: 'Deactivated by admin' })
      const data = await getAdminUsers(roleFilter, statusFilter, searchQuery)
      setAdminUsers(data.admin_users)
    } catch (err) {
      console.error('Failed to deactivate admin user', err)
      alert('Failed to deactivate admin user')
    }
  }

  const handleDelete = async (adminId: string) => {
    if (!confirm('Are you sure you want to delete this admin user? This action cannot be undone.')) return
    
    try {
      await deleteAdminUser(adminId)
      const data = await getAdminUsers(roleFilter, statusFilter, searchQuery)
      setAdminUsers(data.admin_users)
    } catch (err) {
      console.error('Failed to delete admin user', err)
      alert('Failed to delete admin user')
    }
  }

  const handleEdit = (adminId: string) => {
    router.push(`/admin/admin-users/${adminId}`)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading admin users...
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
            Admin Users
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: T.slate2 }}>
            Manage admin accounts and permissions
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
          Add Admin User
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Ico p={ICONS.search} size={16} sw={1.6} color={T.slate2} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search admin users..."
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
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
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
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {adminUsers.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.slate2, fontSize: '14px' }}>
            No admin users found
          </div>
        ) : (
          adminUsers.map((user) => (
            <AdminUserCard
              key={user.admin_id}
              user={user}
              onEdit={handleEdit}
              onDeactivate={handleDeactivate}
              onDelete={handleDelete}
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
              Add Admin User
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: T.navy }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
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
                  Email
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
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
                  Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
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
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateForm({ email: '', full_name: '', role: 'ADMIN' })
                }}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAdmin}
                style={{ minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: 'none', background: T.blue, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Create Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
