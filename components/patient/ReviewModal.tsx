'use client'

import { useState } from 'react'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

type ReviewModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (rating: number, comment: string) => void
  physicianName: string
  appointmentId: string
}

export default function ReviewModal({ isOpen, onClose, onSubmit, physicianName, appointmentId }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (rating === 0) return
    setIsSubmitting(true)
    try {
      await onSubmit(rating, comment)
      setRating(0)
      setComment('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,53,77,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Write a review"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: Sh.float,
          padding: '28px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>
              Write a Review
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>{physicianName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: '1px solid rgba(4,53,77,0.12)', borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.slate2 }}>
            Your Rating
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`Rate ${star} stars`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  transition: 'transform 0.12s',
                }}
              >
                <Ico
                  p={ICONS.star}
                  size={28}
                  sw={1.8}
                  color={(hoverRating || rating) >= star ? '#FFB800' : 'rgba(4,53,77,0.2)'}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.blue, fontWeight: 600 }}>
              {rating === 5 ? 'Excellent' : rating === 4 ? 'Very Good' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </p>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.slate2 }}>
            Your Review
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this provider..."
            rows={4}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(4,53,77,0.15)',
              background: 'rgba(255,255,255,0.9)',
              color: T.navy,
              fontSize: '14px',
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <HoverBtn
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            base={{
              flex: 1,
              minHeight: '46px',
              padding: '0 16px',
              borderRadius: '12px',
              border: 'none',
              background: rating > 0 && !isSubmitting ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)',
              color: rating > 0 && !isSubmitting ? '#fff' : T.slate2,
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: rating > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
              boxShadow: rating > 0 && !isSubmitting ? '0 5px 16px rgba(32,181,223,0.28)' : 'none',
            }}
            on={rating > 0 && !isSubmitting ? { transform: 'translateY(-1px)' } : {}}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </HoverBtn>
          <HoverBtn
            onClick={onClose}
            base={{
              minHeight: '46px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1px solid rgba(4,53,77,0.12)',
              background: 'rgba(255,255,255,0.9)',
              color: T.navy,
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            Cancel
          </HoverBtn>
        </div>
      </div>
    </div>
  )
}
