import {useCallback, useMemo, useState} from 'react'
import type {SanityClient} from 'sanity'

import type {AbTestDocument} from './types'

type UseAbTestDialogStateParams = {
  client: SanityClient
  abTestTypeName: string
  currentAbTestRef?: string
}

export function useAbTestDialogState(params: UseAbTestDialogStateParams) {
  const {client, abTestTypeName, currentAbTestRef} = params
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoadingAbTests, setIsLoadingAbTests] = useState(false)
  const [abTests, setAbTests] = useState<AbTestDocument[]>([])
  const [selectedAbTestId, setSelectedAbTestId] = useState('')

  const selectedAbTest = useMemo(
    () => abTests.find((test) => test._id === selectedAbTestId),
    [abTests, selectedAbTestId],
  )
  const selectedAbTestVariantCount = useMemo(
    () => selectedAbTest?.variantCodes?.length ?? 0,
    [selectedAbTest],
  )

  const openDialog = useCallback(async () => {
    setIsDialogOpen(true)
    setIsLoadingAbTests(true)

    try {
      const docs = await client.fetch<AbTestDocument[]>(
        `*[_type == "${abTestTypeName}"]{_id, name, variantCodes}`,
      )
      const safeDocs = Array.isArray(docs) ? docs : []
      setAbTests(safeDocs)

      const fallbackTestId = safeDocs[0]?._id ?? ''
      const nextSelectedTestId = currentAbTestRef ?? fallbackTestId
      setSelectedAbTestId(nextSelectedTestId)
    } finally {
      setIsLoadingAbTests(false)
    }
  }, [abTestTypeName, client, currentAbTestRef])

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
  }, [])

  const selectAbTest = useCallback((nextTestId: string) => {
    setSelectedAbTestId(nextTestId)
  }, [])

  return {
    isDialogOpen,
    isLoadingAbTests,
    abTests,
    selectedAbTestId,
    selectedAbTest,
    selectedAbTestVariantCount,
    openDialog,
    closeDialog,
    selectAbTest,
  }
}
