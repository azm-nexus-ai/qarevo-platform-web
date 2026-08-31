"use client"

import { useState, useEffect } from "react"
import { getHealthMetrics, createHealthMetric, updateHealthMetric, deleteHealthMetric, type HealthMetric, type HealthMetricCreate } from "@/lib/api"
import { ICONS } from "@/constants/icons"

const T = {
  blue: "#348CEA",
  green: "#10B981",
  red: "#EF4444",
  gray: "#6B7280",
  lightGray: "#F3F4F6",
}

export default function HealthMetricsPage() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMetric, setEditingMetric] = useState<HealthMetric | null>(null)
  const [formData, setFormData] = useState<HealthMetricCreate>({
    metric_type: "blood_pressure",
    value: "",
    unit: "mmHg",
    recorded_at: new Date().toISOString(),
    notes: "",
  })

  async function loadMetrics() {
    try {
      const data = await getHealthMetrics()
      setMetrics(data)
    } catch (error) {
      console.error("Failed to load health metrics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMetrics()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMetric) {
        await updateHealthMetric(editingMetric.id, formData)
      } else {
        await createHealthMetric(formData)
      }
      setShowAddModal(false)
      setEditingMetric(null)
      setFormData({
        metric_type: "blood_pressure",
        value: "",
        unit: "mmHg",
        recorded_at: new Date().toISOString(),
        notes: "",
      })
      loadMetrics()
    } catch (error) {
      console.error("Failed to save health metric:", error)
      alert("Failed to save health metric. Please try again.")
    }
  }

  const handleEdit = (metric: HealthMetric) => {
    setEditingMetric(metric)
    setFormData({
      metric_type: metric.metric_type,
      value: metric.value,
      unit: metric.unit,
      recorded_at: metric.recorded_at,
      notes: metric.notes || "",
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this health metric?")) return
    try {
      await deleteHealthMetric(id)
      loadMetrics()
    } catch (error) {
      console.error("Failed to delete health metric:", error)
      alert("Failed to delete health metric. Please try again.")
    }
  }

  const metricTypeOptions = [
    { value: "blood_pressure", label: "Blood Pressure", unit: "mmHg" },
    { value: "heart_rate", label: "Heart Rate", unit: "bpm" },
    { value: "weight", label: "Weight", unit: "kg" },
    { value: "temperature", label: "Temperature", unit: "°C" },
    { value: "blood_sugar", label: "Blood Sugar", unit: "mg/dL" },
    { value: "oxygen_saturation", label: "Oxygen Saturation", unit: "%" },
  ]

  if (isLoading) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <p>Loading health metrics...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, marginBottom: "8px" }}>Health Metrics</h1>
          <p style={{ color: T.gray, margin: 0 }}>Track your vital signs and health measurements</p>
        </div>
        <button
          onClick={() => {
            setEditingMetric(null)
            setFormData({
              metric_type: "blood_pressure",
              value: "",
              unit: "mmHg",
              recorded_at: new Date().toISOString(),
              notes: "",
            })
            setShowAddModal(true)
          }}
          style={{
            padding: "12px 24px",
            borderRadius: "12px",
            background: T.blue,
            border: "none",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Metric
        </button>
      </div>

      {metrics.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", background: T.lightGray, borderRadius: "16px" }}>
          <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={T.gray} strokeWidth={1.5} style={{ marginBottom: "16px" }}>
            <path d={ICONS.activity} />
          </svg>
          <h3 style={{ fontSize: "18px", fontWeight: 600, margin: 0, marginBottom: "8px" }}>No Health Metrics Yet</h3>
          <p style={{ color: T.gray, margin: 0 }}>Start tracking your health by adding your first metric</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {metrics.map((metric) => (
            <div
              key={metric.id}
              style={{
                padding: "20px",
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, textTransform: "capitalize" }}>
                    {metric.metric_type.replace(/_/g, " ")}
                  </h3>
                  <span style={{ padding: "4px 12px", background: T.lightGray, borderRadius: "20px", fontSize: "12px", fontWeight: 500 }}>
                    {new Date(metric.recorded_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: "24px", fontWeight: 700, color: T.blue, margin: 0 }}>
                  {metric.value} {metric.unit}
                </p>
                {metric.notes && (
                  <p style={{ color: T.gray, fontSize: "14px", margin: "8px 0 0 0" }}>{metric.notes}</p>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleEdit(metric)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: T.lightGray,
                    border: "none",
                    color: T.gray,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(metric.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "none",
                    border: "none",
                    color: T.red,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "32px", borderRadius: "16px", width: "100%", maxWidth: "480px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, margin: 0, marginBottom: "24px" }}>
              {editingMetric ? "Edit Health Metric" : "Add Health Metric"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Metric Type</label>
                <select
                  value={formData.metric_type}
                  onChange={(e) => {
                    const option = metricTypeOptions.find(opt => opt.value === e.target.value)
                    setFormData({ ...formData, metric_type: e.target.value, unit: option?.unit || "" })
                  }}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px" }}
                  required
                >
                  {metricTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Value</label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.recorded_at?.slice(0, 16) || ''}
                  onChange={(e) => setFormData({ ...formData, recorded_at: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px", minHeight: "80px" }}
                  rows={3}
                />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingMetric(null)
                  }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: T.lightGray,
                    border: "none",
                    color: T.gray,
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: T.blue,
                    border: "none",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {editingMetric ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
