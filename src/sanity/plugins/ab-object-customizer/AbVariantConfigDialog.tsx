import { Button, Dialog, Flex, Select, Stack, Text } from "@sanity/ui";
import type { AbTestDocument } from "./types";

type AbVariantConfigDialogProps = {
  isOpen: boolean;
  isLoadingAbTests: boolean;
  abTests: AbTestDocument[];
  selectedAbTestId: string;
  selectedAbTestVariantCount: number;
  variantCodesCount: number;
  onClose: () => void;
  onConfirm: () => void;
  onSelectAbTest: (id: string) => void;
};

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
  } = props;

  if (!isOpen) {
    return null;
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
            disabled={isLoadingAbTests || !selectedAbTestId || variantCodesCount === 0}
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
            disabled={isLoadingAbTests || abTests.length === 0}
            onChange={(event) => {
              onSelectAbTest(event.currentTarget.value);
            }}
          >
            {abTests.length === 0 ? (
              <option value="">No AB tests found</option>
            ) : null}
            {abTests.map((abTest) => (
              <option key={abTest._id} value={abTest._id}>
                {abTest.name || abTest._id}
              </option>
            ))}
          </Select>
        </Stack>

        <Text muted size={1}>
          {selectedAbTestId
            ? variantCodesCount > 0
              ? `Will create ${variantCodesCount} AB copies (one per variant code).`
              : "Selected AB test has no variant codes."
            : selectedAbTestVariantCount > 0
              ? `Will create ${selectedAbTestVariantCount} AB copies.`
              : "Select an AB test to continue."}
        </Text>
      </Stack>
    </Dialog>
  );
}
