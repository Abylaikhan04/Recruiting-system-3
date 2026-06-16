import { useState } from 'react'
import api from '../api'

export function usePdfUpload(onSuccess: (text: string) => void) {
  const [pdfLoading, setPdfLoading] = useState(false)

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1]
        const res = await api.post<{ text: string }>('/parse-pdf', { pdf_base64: base64 })
        onSuccess(res.data.text)
      } catch {
        alert('Не удалось извлечь текст из PDF')
      } finally {
        setPdfLoading(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  return { pdfLoading, handlePdfUpload }
}
