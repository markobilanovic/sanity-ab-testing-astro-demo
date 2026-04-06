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
const AB_VARIANT_FIELD_NAME = "abVariant";
const AB_TEST_REF_FIELD_NAME = "abTestRef";
const AB_VARIANT_CODE_FIELD_NAME = "abVariantCode";
const AB_CONFIG_ACTION_EVENT_NAME = "abObjectCloning:openConfigDialog";

type AbTestDocument = {
  _id: string;
  name?: string;
  variantCodes?: string[];
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
    AB_VARIANT_FIELD_NAME,
    AB_TEST_REF_FIELD_NAME,
    AB_VARIANT_CODE_FIELD_NAME,
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
    const [selectedVariantCode, setSelectedVariantCode] = useState("");

    const abVariantField = getFieldMemberByName(props, AB_VARIANT_FIELD_NAME);
    const valueRecord =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : undefined;
    const currentAbTestRef =
      valueRecord?.[AB_TEST_REF_FIELD_NAME] &&
      typeof valueRecord[AB_TEST_REF_FIELD_NAME] === "object"
        ? (valueRecord[AB_TEST_REF_FIELD_NAME] as { _ref?: string })._ref
        : undefined;
    const currentVariantCode =
      typeof valueRecord?.[AB_VARIANT_CODE_FIELD_NAME] === "string"
        ? (valueRecord[AB_VARIANT_CODE_FIELD_NAME] as string)
        : undefined;
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
    const variantCodes = selectedAbTest?.variantCodes ?? [];

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
        const fallbackVariantCode = selectedDoc?.variantCodes?.[0] ?? "";
        setSelectedVariantCode(currentVariantCode ?? fallbackVariantCode);
      } finally {
        setIsLoadingAbTests(false);
      }
    }, [client, currentAbTestRef, currentVariantCode]);

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
      if (!selectedAbTestId || !selectedVariantCode) {
        return;
      }

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
          set(selectedVariantCode, [AB_VARIANT_CODE_FIELD_NAME]),
        ]),
      );
      setIsDialogOpen(false);
    };

    const handleDisableAbVariant = () => {
      onChange(
        PatchEvent.from([
          set(false, [AB_TOGGLE_FIELD_NAME]),
          unset([AB_TEST_REF_FIELD_NAME]),
          unset([AB_VARIANT_CODE_FIELD_NAME]),
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

        {currentAbTestRef && currentVariantCode ? (
          <Text muted size={1}>
            Active AB selection: {currentAbTestRef} / {currentVariantCode}
          </Text>
        ) : null}

        {shouldShowAbVariant && abVariantField ? (
          <Stack space={2}>
            <Text muted size={1}>
              AB Variant (B)
            </Text>
            <MemberField
              member={abVariantField}
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
                  text="Enable AB variant"
                  disabled={
                    isLoadingAbTests || !selectedAbTestId || !selectedVariantCode
                  }
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
                    const nextVariants =
                      abTests.find((doc) => doc._id === nextTestId)?.variantCodes ??
                      [];
                    setSelectedVariantCode(nextVariants[0] ?? "");
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

              <Stack space={2}>
                <Text size={1} weight="medium">
                  Variant code
                </Text>
                <Select
                  value={selectedVariantCode}
                  disabled={isLoadingAbTests || variantCodes.length === 0}
                  onChange={(event) =>
                    setSelectedVariantCode(event.currentTarget.value)
                  }
                >
                  {variantCodes.length === 0 ? (
                    <option value="">No variants available</option>
                  ) : null}
                  {variantCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </Stack>
            </Stack>
          </Dialog>
        ) : null}
      </Stack>
    );
  },
};
