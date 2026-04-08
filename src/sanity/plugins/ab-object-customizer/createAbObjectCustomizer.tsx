import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Dialog, Flex, Select, Stack, Text } from "@sanity/ui";
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
  DEFAULT_AB_TEST_TYPE_NAME,
  DEFAULT_STUDIO_API_VERSION,
  resolveAbFieldNames,
  type AbFieldNameOverrides,
} from "../abConfig";
import type { ObjectInputCustomizer } from "../composed-object-input";
import {
  cloneValue,
  getControlVariantSeed,
  getFieldMemberByName,
  pathToKey,
} from "./helpers";
import type { AbTestDocument, AbVariantItem } from "./types";

export type AbObjectCustomizerOptions = {
  abTestTypeName?: string;
  fieldNames?: AbFieldNameOverrides;
};

export function createAbObjectCustomizer(
  options: AbObjectCustomizerOptions = {},
): ObjectInputCustomizer {
  const fieldNames = resolveAbFieldNames(options.fieldNames);
  const abTestTypeName = options.abTestTypeName ?? DEFAULT_AB_TEST_TYPE_NAME;

  return {
    matchField: (member) => member.name === fieldNames.toggle,
    getClaimedFieldNames: () => [
      fieldNames.toggle,
      fieldNames.variants,
      fieldNames.testRef,
    ],
    render: (props, _member) => {
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
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isLoadingAbTests, setIsLoadingAbTests] = useState(false);
      const [abTests, setAbTests] = useState<AbTestDocument[]>([]);
      const [selectedAbTestId, setSelectedAbTestId] = useState("");
      const [selectedAbTestVariantCount, setSelectedAbTestVariantCount] = useState(0);

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
      const selectedAbTest = useMemo(
        () => abTests.find((test) => test._id === selectedAbTestId),
        [abTests, selectedAbTestId],
      );
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

      const openDialog = useCallback(async () => {
        setIsDialogOpen(true);
        setIsLoadingAbTests(true);

        try {
          const docs = await client.fetch<AbTestDocument[]>(
            `*[_type == "${abTestTypeName}"]{_id, name, variantCodes}`,
          );
          const safeDocs = Array.isArray(docs) ? docs : [];
          setAbTests(safeDocs);

          const fallbackTestId = safeDocs[0]?._id ?? "";
          const nextSelectedTestId = currentAbTestRef ?? fallbackTestId;
          setSelectedAbTestId(nextSelectedTestId);

          const selectedDoc = safeDocs.find((doc) => doc._id === nextSelectedTestId);
          setSelectedAbTestVariantCount(selectedDoc?.variantCodes?.length ?? 0);
        } finally {
          setIsLoadingAbTests(false);
        }
      }, [abTestTypeName, client, currentAbTestRef]);

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
        setIsDialogOpen(false);
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

          {isDialogOpen ? (
            <Dialog
              id="ab-variant-config-dialog"
              header="Configure AB variant"
              onClose={() => setIsDialogOpen(false)}
              width={1}
              footer={
                <Flex gap={2} justify="flex-end">
                  <Button
                    mode="bleed"
                    text="Cancel"
                    onClick={() => setIsDialogOpen(false)}
                  />
                  <Button
                    mode="default"
                    tone="primary"
                    text="Create AB variant copies"
                    disabled={isLoadingAbTests || !selectedAbTestId || variantCodes.length === 0}
                    onClick={handleEnableAbVariantWithSelection}
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
                      const nextTestId = event.currentTarget.value;
                      setSelectedAbTestId(nextTestId);
                      const nextVariantsCount =
                        abTests.find((doc) => doc._id === nextTestId)?.variantCodes
                          ?.length ?? 0;
                      setSelectedAbTestVariantCount(nextVariantsCount);
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
                    ? variantCodes.length > 0
                      ? `Will create ${variantCodes.length} AB copies (one per variant code).`
                      : "Selected AB test has no variant codes."
                    : selectedAbTestVariantCount > 0
                      ? `Will create ${selectedAbTestVariantCount} AB copies.`
                      : "Select an AB test to continue."}
                </Text>
              </Stack>
            </Dialog>
          ) : null}
        </Stack>
      );
    },
  };
}
