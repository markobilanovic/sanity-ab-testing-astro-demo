import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Dialog, Flex, Select, Stack, Text } from "@sanity/ui";
import {
  MemberField,
  PatchEvent,
  set,
  setIfMissing,
  unset,
  useClient,
  type FieldMember,
  type ObjectInputProps,
} from "sanity";
import type { ObjectInputCustomizer } from "./ComposedObjectInput";

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANTS_FIELD_NAME = "abVariants";
const AB_TEST_REF_FIELD_NAME = "abTestRef";
const AB_CONFIG_ACTION_EVENT_NAME = "abObjectCloning:openConfigDialog";

type AbTestDocument = {
  _id: string;
  name?: string;
  variantCodes?: string[];
};

type AbVariantItem = {
  _key: string;
  _type: "abVariantEntry";
  variantCode: string;
  variant: Record<string, unknown>;
};

function pathToKey(path: unknown): string {
  return JSON.stringify(path);
}

function getFieldMemberByName(
  props: ObjectInputProps,
  fieldName: string,
): FieldMember | undefined {
  return props.members.find(
    (member) => member.kind === "field" && member.name === fieldName,
  ) as FieldMember | undefined;
}

export const abObjectCustomizer: ObjectInputCustomizer = {
  matchField: (member) => member.name === AB_TOGGLE_FIELD_NAME,
  getClaimedFieldNames: () => [
    AB_TOGGLE_FIELD_NAME,
    AB_VARIANTS_FIELD_NAME,
    AB_TEST_REF_FIELD_NAME,
  ],
  render: (props) => {
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
    const client = useClient({ apiVersion: "2025-01-01" });
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoadingAbTests, setIsLoadingAbTests] = useState(false);
    const [abTests, setAbTests] = useState<AbTestDocument[]>([]);
    const [selectedAbTestId, setSelectedAbTestId] = useState("");
    const [selectedAbTestVariantCount, setSelectedAbTestVariantCount] = useState(0);

    const abVariantsField = getFieldMemberByName(props, AB_VARIANTS_FIELD_NAME);
    const valueRecord =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : undefined;
    const currentAbTestRef =
      valueRecord?.[AB_TEST_REF_FIELD_NAME] &&
      typeof valueRecord[AB_TEST_REF_FIELD_NAME] === "object"
        ? (valueRecord[AB_TEST_REF_FIELD_NAME] as { _ref?: string })._ref
        : undefined;
    const currentVariants = Array.isArray(valueRecord?.[AB_VARIANTS_FIELD_NAME])
      ? (valueRecord[AB_VARIANTS_FIELD_NAME] as Array<{ variantCode?: string }>)
      : [];
    const shouldShowAbVariant = Boolean(
      value &&
        typeof value === "object" &&
        AB_TOGGLE_FIELD_NAME in value &&
        (value as { showAbVariant?: boolean }).showAbVariant,
    );
    const selectedAbTest = useMemo(
      () => abTests.find((test) => test._id === selectedAbTestId),
      [abTests, selectedAbTestId],
    );
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
          '*[_type == "abTest"]{_id, name, variantCodes}',
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
    }, [client, currentAbTestRef]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const currentPathKey = pathToKey(props.path);
      const handleOpenConfigDialog = (event: Event) => {
        const customEvent = event as CustomEvent<{ path?: unknown }>;
        if (pathToKey(customEvent.detail?.path) !== currentPathKey) {
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
        _type: "abVariantEntry",
        variantCode: code,
        variant: {},
      }));

      onChange(
        PatchEvent.from([
          setIfMissing({}, []),
          set(true, [AB_TOGGLE_FIELD_NAME]),
          set(
            {
              _type: "reference",
              _ref: selectedAbTestId,
            },
            [AB_TEST_REF_FIELD_NAME],
          ),
          set(variants, [AB_VARIANTS_FIELD_NAME]),
        ]),
      );
      setIsDialogOpen(false);
    };

    const handleDisableAbVariant = () => {
      onChange(
        PatchEvent.from([
          set(false, [AB_TOGGLE_FIELD_NAME]),
          unset([AB_TEST_REF_FIELD_NAME]),
          unset([AB_VARIANTS_FIELD_NAME]),
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

        {currentAbTestRef ? (
          <Text muted size={1}>
            Active AB selection: {currentAbTestRef}
            {currentVariants.length > 0 ? ` (${currentVariants.length} variants)` : ""}
          </Text>
        ) : null}

        {shouldShowAbVariant && abVariantsField ? (
          <Stack space={2}>
            <Text muted size={1}>
              AB Variants
            </Text>
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
