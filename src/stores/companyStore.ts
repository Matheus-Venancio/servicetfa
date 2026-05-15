import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Empresa {
  id: string
  nome: string
  telefone?: string
  endereco?: string
}

interface CompanyState {
  selectedCompany: Empresa | null
  setSelectedCompany: (company: Empresa | null) => void
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      selectedCompany: null,
      setSelectedCompany: (company) => set({ selectedCompany: company }),
    }),
    {
      name: 'guardia-company-storage',
    }
  )
)
