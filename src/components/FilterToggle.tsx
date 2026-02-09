'use client'

import { useState, type ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react'

interface FilterToggleProps {
  title?: string
  description?: string
  children: ReactNode
  filtrosAtivos: number
  onLimparFiltros: () => void
  defaultOpen?: boolean
}

export function FilterToggle({
  title = 'Filtros',
  description,
  children,
  filtrosAtivos,
  onLimparFiltros,
  defaultOpen = false,
}: FilterToggleProps) {
  const [showFilters, setShowFilters] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title}
              {filtrosAtivos > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {filtrosAtivos} ativo{filtrosAtivos !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filtrosAtivos > 0 && (
            <Button variant="outline" size="sm" onClick={onLimparFiltros} className="gap-1">
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? 'Ocultar' : 'Mostrar'}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {showFilters && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
