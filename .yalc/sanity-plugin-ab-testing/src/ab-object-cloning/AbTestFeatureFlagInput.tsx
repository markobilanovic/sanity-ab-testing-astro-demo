import {Card, Select, Stack, Text} from '@sanity/ui'
import {useEffect, useMemo, useState} from 'react'
import {set, type StringInputProps, useClient, useFormValue} from 'sanity'

import {DEFAULT_STUDIO_API_VERSION} from '../abConfig'
import {AB_TEST_VARIANT_CODES_FIELD_NAME} from './constants'
import {areSameStringArrays, getSiblingPath, normalizeNonEmptyStrings} from './helpers'
import type {AbFeatureFlag, AbTestAdapter} from './types'

export function AbTestFeatureFlagInput(props: StringInputProps & {adapter?: AbTestAdapter}) {
  const {onChange, value, path, adapter, renderDefault} = props

  const client = useClient({apiVersion: DEFAULT_STUDIO_API_VERSION})
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [featureFlags, setFeatureFlags] = useState<AbFeatureFlag[]>([])
  const [isSyncingVariants, setIsSyncingVariants] = useState(false)
  const variantCodesPath = useMemo(
    () => getSiblingPath(path, AB_TEST_VARIANT_CODES_FIELD_NAME),
    [path],
  )
  const documentIdValue = useFormValue(['_id'])
  const documentId =
    typeof documentIdValue === 'string' && documentIdValue.trim() ? documentIdValue : undefined
  const currentVariantCodes = normalizeNonEmptyStrings(useFormValue(variantCodesPath))
  const selectedFlagId = typeof value === 'string' ? value : ''
  const selectedFlag = useMemo(
    () => featureFlags.find((featureFlag) => featureFlag.id === selectedFlagId),
    [featureFlags, selectedFlagId],
  )

  useEffect(() => {
    if (!adapter) {
      return
    }

    let isCancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    setLoadError(null)

    adapter
      .loadFeatureFlags()
      .then((flags) => {
        if (isCancelled) {
          return
        }

        setFeatureFlags(flags)
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return
        }

        setLoadError(
          error instanceof Error ? error.message : 'Failed to load feature flags from adapter.',
        )
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    // eslint-disable-next-line consistent-return
    return () => {
      isCancelled = true
    }
  }, [adapter])

  useEffect(() => {
    if (!adapter || !selectedFlag) {
      return
    }

    if (areSameStringArrays(currentVariantCodes, selectedFlag.variantCodes)) {
      return
    }

    if (!documentId) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSyncingVariants(true)
    client
      .patch(documentId)
      .set({[AB_TEST_VARIANT_CODES_FIELD_NAME]: selectedFlag.variantCodes})
      .commit()
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to sync variant codes.')
      })
      .finally(() => setIsSyncingVariants(false))
  }, [adapter, client, currentVariantCodes, documentId, selectedFlag])

  if (!adapter) {
    return renderDefault(props)
  }

  return (
    <Stack space={3}>
      <Select
        value={selectedFlagId}
        disabled={isLoading || featureFlags.length === 0}
        onChange={(event) => {
          const nextId = event.currentTarget.value
          const nextSelectedFlag = featureFlags.find((featureFlag) => featureFlag.id === nextId)

          if (!nextSelectedFlag) {
            return
          }

          onChange(set(nextSelectedFlag.id))
        }}
      >
        <option value="">
          {/* eslint-disable-next-line no-nested-ternary */}
          {isLoading
            ? 'Loading feature flags...'
            : featureFlags.length === 0
              ? 'No multivariate feature flags found'
              : 'Select a feature flag ID'}
        </option>
        {featureFlags.map((featureFlag) => (
          <option key={featureFlag.id} value={featureFlag.id}>
            {featureFlag.id}
            {featureFlag.name ? ` (${featureFlag.name})` : ''}
          </option>
        ))}
      </Select>

      <Text muted size={1}>
        Source: {adapter.sourceName}. Selecting an ID auto-syncs variant codes.
      </Text>
      {selectedFlag ? (
        <Text muted size={1}>
          Synced variants: {selectedFlag.variantCodes.join(', ')}
        </Text>
      ) : null}
      {isSyncingVariants ? (
        <Text muted size={1}>
          Syncing variants...
        </Text>
      ) : null}
      {loadError ? (
        <Card tone="critical" padding={2} radius={2}>
          <Text size={1}>{loadError}</Text>
        </Card>
      ) : null}
    </Stack>
  )
}
