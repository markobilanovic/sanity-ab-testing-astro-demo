import {Button, Dialog, Flex, Select, Stack, Text} from '@sanity/ui'

import type {AbTestDocument} from './types'

type AbVariantConfigDialogProps = {
  isOpen: boolean
  isLoadingAbTests: boolean
  abTests: AbTestDocument[]
  selectedAbTestId: string
  selectedAbTestVariantCount: number
  variantCodesCount: number
  onClose: () => void
  onConfirm: () => void
  onSelectAbTest: (id: string) => void
}

export function AbVariantConfigDialog(props: AbVariantConfigDialogProps) {
  const {
    isOpen,
    isLoadingAbTests,
    abTests,
    selectedAbTestId,
    selectedAbTestVariantCount,
    variantCodesCount,
    onClose,
    onConfirm,
    onSelectAbTest,
  } = props
  const hasTests = abTests.length > 0
  const canConfirm = !isLoadingAbTests && Boolean(selectedAbTestId) && variantCodesCount > 0
  let helperText = 'Select an AB test to continue.'
  if (selectedAbTestId) {
    if (variantCodesCount > 0) {
      helperText = `Will create ${variantCodesCount} AB copies (one per variant code).`
    } else {
      helperText = 'Selected AB test has no variant codes.'
    }
  } else if (selectedAbTestVariantCount > 0) {
    helperText = `Will create ${selectedAbTestVariantCount} AB copies.`
  }

  if (!isOpen) {
    return null
  }

  return (
    <Dialog
      id="ab-variant-config-dialog"
      header="Configure AB variant"
      onClose={onClose}
      width={1}
      footer={
        <Flex gap={2} justify="flex-end">
          <Button mode="bleed" text="Cancel" onClick={onClose} />
          <Button
            mode="default"
            tone="primary"
            text="Create AB variant copies"
            disabled={!canConfirm}
            onClick={onConfirm}
          />
        </Flex>
      }
    >
      <Stack space={4} padding={4}>
        <Stack space={2}>
          <Text size={1} weight="medium">
            AB Test document
          </Text>
          <Select
            value={selectedAbTestId}
            disabled={isLoadingAbTests || !hasTests}
            onChange={(event) => {
              onSelectAbTest(event.currentTarget.value)
            }}
          >
            {hasTests ? null : <option value="">No AB tests found</option>}
            {abTests.map((abTest) => (
              <option key={abTest._id} value={abTest._id}>
                {abTest.name || abTest._id}
              </option>
            ))}
          </Select>
        </Stack>

        <Text muted size={1}>
          {helperText}
        </Text>
      </Stack>
    </Dialog>
  )
}
