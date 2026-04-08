import { useEffect, useMemo } from "react";
import { Button, Flex, Stack, Text } from "@sanity/ui";
import {
  MemberField,
  PatchEvent,
  set,
  setIfMissing,
  unset,
  useClient,
  type ObjectInputProps,
} from "sanity";
import {
  AB_CONFIG_ACTION_EVENT_NAME,
  DEFAULT_STUDIO_API_VERSION,
  type AbFieldNames,
} from "../abConfig";
import {
  cloneValue,
  getControlVariantSeed,
  getFieldMemberByName,
  pathToKey,
} from "./helpers";
import type { AbVariantItem } from "./types";
import { AbVariantConfigDialog } from "./AbVariantConfigDialog";
import { useAbTestDialogState } from "./useAbTestDialogState";

type AbObjectCustomizerFieldProps = {
  props: ObjectInputProps;
  fieldNames: AbFieldNames;
  abTestTypeName: string;
};

export function AbObjectCustomizerField({
  props,
  fieldNames,
  abTestTypeName,
}: AbObjectCustomizerFieldProps) {
  const {
    renderInput,
    renderField,
    renderItem,
    renderPreview,
    renderBlock,
    renderInlineBlock,
    renderAnnotation,
    onChange,
    value,
  } = props;
  const client = useClient({ apiVersion: DEFAULT_STUDIO_API_VERSION });

  const abVariantsField = getFieldMemberByName(props, fieldNames.variants);
  const valueRecord =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  const currentAbTestRef =
    valueRecord?.[fieldNames.testRef] &&
    typeof valueRecord[fieldNames.testRef] === "object"
      ? (valueRecord[fieldNames.testRef] as { _ref?: string })._ref
      : undefined;
  const currentVariants = Array.isArray(valueRecord?.[fieldNames.variants])
    ? (valueRecord[fieldNames.variants] as AbVariantItem[])
    : [];
  const currentExperimentName =
    currentVariants[0]?.abTestName?.trim() || currentAbTestRef;
  const controlVariantSeed = useMemo(
    () => getControlVariantSeed(valueRecord, fieldNames),
    [fieldNames, valueRecord],
  );
  const shouldShowAbVariant = Boolean(
    valueRecord &&
      typeof valueRecord[fieldNames.toggle] === "boolean" &&
      valueRecord[fieldNames.toggle],
  );

  const {
    isDialogOpen,
    isLoadingAbTests,
    abTests,
    selectedAbTestId,
    selectedAbTest,
    selectedAbTestVariantCount,
    openDialog,
    closeDialog,
    selectAbTest,
  } = useAbTestDialogState({
    client,
    abTestTypeName,
    currentAbTestRef,
  });
  const selectedAbTestName = selectedAbTest?.name || selectedAbTestId;
  const variantCodes = useMemo(
    () =>
      Array.from(
        new Set(
          (selectedAbTest?.variantCodes ?? []).filter(
            (code): code is string => Boolean(code && code.trim()),
          ),
        ),
      ),
    [selectedAbTest],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentPathKey = pathToKey(props.path);
    const handleOpenConfigDialog = (event: Event) => {
      const customEvent = event as CustomEvent<{
        targetPath?: unknown;
      }>;

      const eventTargetPath = customEvent.detail?.targetPath;
      if (pathToKey(eventTargetPath) !== currentPathKey) {
        return;
      }

      void openDialog();
    };

    window.addEventListener(
      AB_CONFIG_ACTION_EVENT_NAME,
      handleOpenConfigDialog as EventListener,
    );

    return () => {
      window.removeEventListener(
        AB_CONFIG_ACTION_EVENT_NAME,
        handleOpenConfigDialog as EventListener,
      );
    };
  }, [openDialog, props.path]);

  const handleEnableAbVariantWithSelection = () => {
    if (!selectedAbTestId || variantCodes.length === 0) {
      return;
    }

    const variants: AbVariantItem[] = variantCodes.map((code, index) => ({
      _key: `${Date.now()}-${index}-${code}`,
      _type: fieldNames.variantEntryType,
      abTestName: selectedAbTestName,
      variantCode: code,
      variant: cloneValue(controlVariantSeed),
    }));

    onChange(
      PatchEvent.from([
        setIfMissing({}, []),
        set(true, [fieldNames.toggle]),
        set(
          {
            _type: "reference",
            _ref: selectedAbTestId,
          },
          [fieldNames.testRef],
        ),
        set(variants, [fieldNames.variants]),
      ]),
    );
    closeDialog();
  };

  const handleDisableAbVariant = () => {
    onChange(
      PatchEvent.from([
        set(false, [fieldNames.toggle]),
        unset([fieldNames.testRef]),
        unset([fieldNames.variants]),
      ]),
    );
  };

  return (
    <Stack space={3}>
      <Flex gap={2}>
        {shouldShowAbVariant ? (
          <Button
            mode="ghost"
            tone="caution"
            text="Disable AB variant"
            onClick={handleDisableAbVariant}
          />
        ) : null}
      </Flex>

      {currentExperimentName ? (
        <Text muted size={1}>
          Experiment: {currentExperimentName}
        </Text>
      ) : null}

      {shouldShowAbVariant && abVariantsField ? (
        <Stack space={2}>
          <MemberField
            member={abVariantsField}
            renderInput={renderInput}
            renderField={renderField}
            renderItem={renderItem}
            renderPreview={renderPreview}
            renderBlock={renderBlock}
            renderInlineBlock={renderInlineBlock}
            renderAnnotation={renderAnnotation}
          />
        </Stack>
      ) : null}

      <AbVariantConfigDialog
        isOpen={isDialogOpen}
        isLoadingAbTests={isLoadingAbTests}
        abTests={abTests}
        selectedAbTestId={selectedAbTestId}
        selectedAbTestVariantCount={selectedAbTestVariantCount}
        variantCodesCount={variantCodes.length}
        onClose={closeDialog}
        onConfirm={handleEnableAbVariantWithSelection}
        onSelectAbTest={selectAbTest}
      />
    </Stack>
  );
}
