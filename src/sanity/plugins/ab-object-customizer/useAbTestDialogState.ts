import { useCallback, useMemo, useState } from "react";
import type { SanityClient } from "sanity";
import type { AbTestDocument } from "./types";

type UseAbTestDialogStateParams = {
  client: SanityClient;
  abTestTypeName: string;
  currentAbTestRef?: string;
};

export function useAbTestDialogState(params: UseAbTestDialogStateParams) {
  const { client, abTestTypeName, currentAbTestRef } = params;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingAbTests, setIsLoadingAbTests] = useState(false);
  const [abTests, setAbTests] = useState<AbTestDocument[]>([]);
  const [selectedAbTestId, setSelectedAbTestId] = useState("");
  const [selectedAbTestVariantCount, setSelectedAbTestVariantCount] = useState(0);

  const selectedAbTest = useMemo(
    () => abTests.find((test) => test._id === selectedAbTestId),
    [abTests, selectedAbTestId],
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

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const selectAbTest = useCallback(
    (nextTestId: string) => {
      setSelectedAbTestId(nextTestId);
      const nextVariantsCount =
        abTests.find((doc) => doc._id === nextTestId)?.variantCodes?.length ?? 0;
      setSelectedAbTestVariantCount(nextVariantsCount);
    },
    [abTests],
  );

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
  };
}
